// src/db-tools.js
// Herramientas de solo lectura para que el asistente investigue la base de datos Oracle.
import oracledb from 'oracledb';

const MAX_ROWS = 100;
const MAX_CHARS = 6000;

const READ_ONLY_RE = /^\s*(SELECT|WITH|EXPLAIN)\b/i;
const FORBIDDEN_RE =
    /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|MERGE|GRANT|REVOKE|CALL|BEGIN|DECLARE|EXEC|EXECUTE|COMMIT|ROLLBACK|SAVEPOINT|PURGE|PACKAGE|ADMINISTER|RENAME|COMMENT|FLASHBACK)\b/i;

export function validateReadOnlySql(sql) {
    const clean = String(sql || '').trim().replace(/;+\s*$/i, '');
    if (!READ_ONLY_RE.test(clean)) {
        throw new Error(
            'Solo se permiten consultas de solo lectura (SELECT o WITH ... SELECT).'
        );
    }
    if (FORBIDDEN_RE.test(clean)) {
        throw new Error(
            'La consulta contiene sentencias no permitidas. Solo lectura (SELECT/WITH).'
        );
    }
    return clean;
}

function serializeValue(value) {
    if (value === undefined) return null;
    if (value === null) return null;
    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return value.toString('base64');
    if (typeof value === 'object' && typeof value.toJSON === 'function') {
        return value.toJSON();
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
}

// Ejecuta una consulta SOLO SELECT contra la BD del usuario de la sesión.
export async function runReadOnlyQuery(session, sql, maxRows = MAX_ROWS) {
    const clean = validateReadOnlySql(sql);
    const { usuario, password, host, port, service } = session;

    let connection;
    try {
        const base = {
            user: usuario,
            password,
            connectString: `${host}:${port}/${service}`
        };
        try {
            connection = await oracledb.getConnection({ ...base, readonly: true });
        } catch {
            // Cliente antiguo sin soporte de readonly: reintentamos normal.
            connection = await oracledb.getConnection(base);
        }

        const result = await connection.execute(clean, {}, {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
            maxRows,
            fetchArraySize: 100,
            fetchAsString: [oracledb.CLOB, oracledb.NCLOB]
        });

        const rows = (result.rows || []).map((row) => {
            const plain = {};
            for (const [key, value] of Object.entries(row)) {
                plain[key] = serializeValue(value);
            }
            return plain;
        });

        return {
            sql: clean,
            rows,
            meta: result.metaData,
            truncated: rows.length >= maxRows
        };
    } finally {
        if (connection) await connection.close();
    }
}

// Convierte el resultado de una consulta en un texto compacto para el modelo.
export function formatResultForLlm(result) {
    const { rows, truncated } = result;
    if (!rows.length) {
        return 'La consulta no devolvió filas (0 filas).';
    }

    let out = `Resultado de la consulta (${rows.length} fila(s)${
        truncated ? ', truncado a las primeras ' + rows.length : ''
    }):\n\n`;

    let chars = 0;
    const lines = [];
    for (const row of rows) {
        const line = JSON.stringify(row);
        chars += line.length + 1;
        if (chars > MAX_CHARS) {
            lines.push('...(resultado truncado por tamaño)');
            break;
        }
        lines.push(line);
    }
    out += lines.join('\n');
    return out;
}

// Consulta información básica de la instancia para enriquecer el prompt del asistente.
export async function getDatabaseInfo(session) {
    try {
        const rows = await runReadOnlyQuery(
            session,
            `SELECT d.name AS nombre, d.version AS version,
                    i.instance_name AS instancia, i.host_name AS host,
                    i.status AS estado
             FROM v$database d, v$instance i
             WHERE ROWNUM = 1`,
            5
        );
        if (rows.rows && rows.rows[0]) {
            const r = rows.rows[0];
            return `Base de datos: ${r.NOMBRE || '?'} (${r.VERSION || '?'}), instancia ${r.INSTANCIA || '?'} en ${r.HOST || '?'}, estado ${r.ESTADO || '?'}`;
        }
    } catch {
        // Sin acceso al diccionario: no es crítico.
    }
    return '';
}
