// src/ai-chat.js
// Motor del asistente: carga Gemma 2B, mantiene el historial y resuelve
// llamadas a la herramienta de consulta SQL (solo lectura) en un bucle acotado.
import { LlamaChatSession, LlamaJsonSchemaGrammar } from 'node-llama-cpp';
import { getModel, getLlamaInstance } from './llm.js';
import {
    runReadOnlyQuery,
    formatResultForLlm,
    getDatabaseInfo
} from './db-tools.js';

const MAX_TOOL_TURNS = 3;
const MAX_HISTORY_ITEMS = 8;
const CONTEXT_SIZE = 8192;
const MAX_TOKENS = 1024;

const DB_RELATED_RE =
    /tabla|esquema|columna|indice|índice|vista|usuario|sesio|session|rendimiento|performance|\bsql\b|select|query|consulta|base de datos|dba_|all_|user_|owner|backup|rman|awr|ash|procedimiento|trigg|package|paquete|data|datos|constraint|privileg|\brole\b|tablespace|segmento|bloqueo|\block\b|evento|wait|memoria|sga|pga|oracle|deadlock|colga|count|list|schema|table|column|index/i;

const dbInfoCache = new Map();
let toolCallGrammarPromise = null;

function isDbRelated(text) {
    return DB_RELATED_RE.test(text);
}

function getToolCallGrammar() {
    if (!toolCallGrammarPromise) {
        toolCallGrammarPromise = getLlamaInstance().then((llama) => {
            return new LlamaJsonSchemaGrammar(llama, {
                type: 'object',
                properties: {
                    tool: { type: 'string', enum: ['ejecutar_sql'] },
                    sql: { type: 'string' },
                    razon: { type: 'string' }
                },
                required: ['tool', 'sql']
            });
        });
    }
    return toolCallGrammarPromise;
}

function buildSystemPrompt(dbInfo) {
    const server = dbInfo ? `\nServidor conectado: ${dbInfo}` : '';
    return `Eres "DBA Assistant", un asistente experto en administración de bases de datos Oracle. Tienes una CONEXIÓN REAL y ACTUAL a una base de datos Oracle.${server}

Siempre que el usuario pregunte algo sobre la base de datos (esquemas, tablas, columnas, usuarios, sesiones, rendimiento, SQL, backups, etc.), DEBES consultarla con la herramienta ejecutar_sql.

Para consultar, responde ÚNICAMENTE con este JSON, sin texto adicional, ni antes ni después:
{"tool": "ejecutar_sql", "sql": "<tu consulta SELECT o WITH>", "razon": "<motivo breve>"}

Ejemplo. Pregunta: "¿qué tablas tiene el esquema HR?"
Respuesta exacta:
{"tool": "ejecutar_sql", "sql": "SELECT table_name FROM all_tables WHERE owner = 'HR' ORDER BY table_name", "razon": "Listar tablas del esquema HR"}

Puedes investigar TODO usando el diccionario de datos (DBA_TABLES, DBA_TAB_COLUMNS, DBA_USERS, DBA_INDEXES, DBA_PROCEDURES, ALL_*, USER_*, etc.) y las vistas del sistema (V$, GV$, DBA_HIST_*, V$SESSION, V$SGA_TARGET_ADVICE, V$PGA_TARGET_ADVICE, V$RMAN_BACKUP_JOB_DETAILS...). Cuando el usuario mencione un esquema concreto, filtra por su OWNER.

Cuando recibas los resultados de la herramienta, responde en español, claro y conciso, resumiendo los hallazgos con markdown (tablas o listas cuando ayude).

REGLAS ESTRICTAS:
1) NUNCA digas que no tienes acceso a la base de datos. Ante cualquier duda usa la herramienta ejecutar_sql.
2) NUNCA inventes datos, tablas o esquemas: solo habla de lo que devuelvan los resultados.
3) Solo SELECT o WITH ... SELECT (solo lectura). Nunca intentes modificar la base de datos.
4) Si una consulta falla o no tienes permisos (por ejemplo en DBA_*), explica el error y propón la variante ALL_* o USER_*.
5) Si el usuario pregunta algo NO relacionado con la base de datos, responde normalmente en texto.`;
}

async function getCachedDbInfo(session) {
    const key = `${session.usuario}@${session.host}:${session.port}/${session.service}`;
    if (!dbInfoCache.has(key)) {
        try {
            dbInfoCache.set(key, await getDatabaseInfo(session));
        } catch {
            dbInfoCache.set(key, '');
        }
    }
    return dbInfoCache.get(key);
}

function toChatHistoryItem(msg) {
    if (msg.role === 'user') return { type: 'user', text: msg.content };
    if (msg.role === 'assistant') {
        return { type: 'model', response: [String(msg.content)] };
    }
    return null;
}

// Intenta extraer una llamada a herramienta del texto generado.
export function parseToolCall(text) {
    const trimmed = String(text || '')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '');

    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return null;

    try {
        const obj = JSON.parse(trimmed.slice(start, end + 1));
        if (
            obj &&
            obj.tool === 'ejecutar_sql' &&
            typeof obj.sql === 'string' &&
            obj.sql.trim()
        ) {
            return {
                sql: obj.sql.trim(),
                razon: typeof obj.razon === 'string' ? obj.razon : ''
            };
        }
    } catch {
        // no es JSON válido
    }
    return null;
}

const promptOptions = {
    maxTokens: MAX_TOKENS,
    temperature: 0.6,
    topP: 0.9
};

// Ejecuta el asistente y emite eventos vía `emit`.
export async function runAiChat(session, messages, emit) {
    const model = await getModel();
    const context = await model.createContext({
        contextSize: CONTEXT_SIZE,
        flashAttention: true
    });

    try {
        const systemPrompt = buildSystemPrompt(await getCachedDbInfo(session));
        const chatSession = new LlamaChatSession({
            contextSequence: context.getSequence(),
            systemPrompt
        });

        const history = messages
            .slice(0, -1)
            .slice(-MAX_HISTORY_ITEMS)
            .map(toChatHistoryItem)
            .filter(Boolean);
        chatSession.setChatHistory(history);

        const lastUser = messages[messages.length - 1];

        let pendingPrompt = lastUser.content;
        let pendingGrammar = null;
        for (let turn = 0; turn <= MAX_TOOL_TURNS; turn++) {
            let buffer = '';
            await chatSession.prompt(pendingPrompt, {
                ...promptOptions,
                grammar: pendingGrammar,
                onTextChunk: (chunk) => {
                    buffer += chunk;
                }
            });

            const toolCall = parseToolCall(buffer);
            if (toolCall && turn < MAX_TOOL_TURNS) {
                emit({ type: 'querying', sql: toolCall.sql, razon: toolCall.razon });
                try {
                    const result = await runReadOnlyQuery(session, toolCall.sql);
                    pendingPrompt =
                        formatResultForLlm(result) +
                        '\n\nResponde ahora al usuario en español, resumiendo estos hallazgos de forma clara y concisa.';
                } catch (err) {
                    pendingPrompt =
                        'Ocurrió un error al ejecutar la consulta en Oracle:\n' +
                        (err?.message || String(err)) +
                        '\n\nExplica brevemente el error al usuario en español y, si es posible, propón la consulta corregida. Si el error fue de permisos en DBA_*, sugiere usar ALL_* o USER_*.';
                }
                pendingGrammar = null;
                continue;
            }

            // Red de seguridad: si la pregunta era de BD pero el modelo no
            // emitió la llamada, forzamos un turno con gramática JSON.
            if (turn === 0 && !toolCall && isDbRelated(lastUser.content)) {
                pendingPrompt =
                    'Para responder a la pregunta del usuario DEBES consultar la base de datos Oracle. ' +
                    'Responde SOLO con el JSON de la herramienta, sin texto adicional. ' +
                    'Si el usuario menciona un esquema concreto, usa DBA_TABLES o ALL_TABLES filtrando por OWNER.';
                pendingGrammar = await getToolCallGrammar();
                continue;
            }

            emit({ type: 'chunk', text: buffer });
            return;
        }
    } finally {
        context.dispose();
    }
}
