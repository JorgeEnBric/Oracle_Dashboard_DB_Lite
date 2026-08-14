import { useState, useRef, useEffect } from 'react';
import '../estilos/AIChat.css';

const SUGGESTIONS = [
    '¿Qué tablas existen en el esquema HR?',
    'Lista los usuarios y su estado en la base de datos',
    'Muestra las sesiones activas actuales',
    '¿Qué tablas tienen más filas?'
];

const QUERYING_HINTS = [
    'Consultando la base de datos…',
    'Ejecutando consulta en Oracle…',
    'Analizando diccionario de datos…'
];

export default function AIChat() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [hint, setHint] = useState(null);
    const [error, setError] = useState(null);
    const endRef = useRef(null);
    const hintTimer = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, hint]);

    useEffect(() => () => clearInterval(hintTimer.current), []);

    function rotateHint() {
        setHint((prev) => {
            const i = QUERYING_HINTS.indexOf(prev ?? QUERYING_HINTS[0]);
            return QUERYING_HINTS[(i + 1) % QUERYING_HINTS.length];
        });
    }

    function startHintRotator() {
        setHint(QUERYING_HINTS[0]);
        clearInterval(hintTimer.current);
        hintTimer.current = setInterval(rotateHint, 3000);
    }

    function stopHintRotator() {
        clearInterval(hintTimer.current);
        setHint(null);
    }

    async function sendMessage(content) {
        const text = (content ?? input).trim();
        if (!text || busy) return;

        setInput('');
        setError(null);
        const userMsg = { role: 'user', content: text };
        const history = [...messages, userMsg];
        setMessages((m) => [...m, userMsg]);

        setBusy(true);
        startHintRotator();

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: history })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || `Error HTTP ${res.status}`);
            }
            if (!res.body) throw new Error('Respuesta sin cuerpo');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let assistantText = '';
            let streaming = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const events = buffer.split('\n\n');
                buffer = events.pop();

                for (const evt of events) {
                    const line = evt.trim();
                    if (!line.startsWith('data:')) continue;
                    let data;
                    try {
                        data = JSON.parse(line.slice(5).trim());
                    } catch {
                        continue;
                    }

                    if (data.type === 'thinking') {
                        setHint('Pensando…');
                    } else if (data.type === 'querying') {
                        setHint('Ejecutando consulta en Oracle…');
                    } else if (data.type === 'chunk') {
                        assistantText += data.text ?? '';
                        streaming = true;
                        setMessages((m) => {
                            const copy = [...m];
                            const last = copy[copy.length - 1];
                            if (last?.role === 'assistant') {
                                last.content = assistantText;
                            } else {
                                copy.push({ role: 'assistant', content: assistantText });
                            }
                            return copy;
                        });
                    } else if (data.type === 'error') {
                        setError(data.message || 'Error desconocido');
                    }
                }
            }

            if (!streaming && !assistantText) {
                assistantText = '';
            }
        } catch (e) {
            console.error('Chat error:', e);
            setError(e.message || 'No se pudo contactar al asistente');
        } finally {
            setBusy(false);
            stopHintRotator();
        }
    }

    return (
        <div className="ai-chat">
            <div className="ai-chat-header">
                <div>
                    <h3>Asistente DBA</h3>
                    <p className="ai-chat-subtitle">
                        Gemma 2 2B local · Investigación de tu base de datos Oracle
                    </p>
                </div>
                <span className="ai-chat-badge">IA local</span>
            </div>

            <div className="ai-chat-messages">
                {messages.length === 0 && (
                    <div className="ai-chat-empty">
                        <p>
                            Pregúntame sobre tu base de datos: esquemas, tablas,
                            rendimiento, sesiones, backups…
                        </p>
                        <div className="ai-chat-suggestions">
                            {SUGGESTIONS.map((s) => (
                                <button
                                    key={s}
                                    className="ai-chat-chip"
                                    onClick={() => sendMessage(s)}
                                    disabled={busy}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((m, i) => (
                    <div
                        key={i}
                        className={`ai-msg ${m.role === 'user' ? 'user' : 'assistant'}`}
                    >
                        <div className="ai-msg-content">
                            <pre className="ai-msg-text">{m.content}</pre>
                        </div>
                    </div>
                ))}

                {busy && (
                    <div className="ai-msg assistant">
                        <div className="ai-msg-content ai-msg-busy">
                            <span className="ai-spinner" />
                            <span>{hint}</span>
                        </div>
                    </div>
                )}

                {error && <div className="ai-msg-error">{error}</div>}
                <div ref={endRef} />
            </div>

            <div className="ai-chat-inputbar">
                <input
                    type="text"
                    placeholder="Escribe tu pregunta sobre la base de datos…"
                    value={input}
                    disabled={busy}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') sendMessage();
                    }}
                />
                <button
                    className="ai-chat-send"
                    onClick={() => sendMessage()}
                    disabled={busy || !input.trim()}
                >
                    Enviar
                </button>
            </div>
        </div>
    );
}
