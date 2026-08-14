// src/pages/api/chat.js
// Endpoint SSE del asistente IA para investigar la base de datos Oracle.
import { runAiChat } from '../../ai-chat.js';

export async function POST({ request, cookies }) {
    const session = cookies.get('db_session')?.json();
    if (!session || !session.usuario || !session.host) {
        return new Response(
            JSON.stringify({ error: 'No hay sesión activa' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Cuerpo inválido' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const messages = Array.isArray(body?.messages) ? body.messages : null;
    const last = messages?.[messages.length - 1];
    if (!messages || !messages.length || last?.role !== 'user' || !last?.content?.trim()) {
        return new Response(JSON.stringify({ error: 'Mensaje inválido' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const emit = (obj) =>
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)
                );

            try {
                emit({ type: 'thinking' });
                await runAiChat(session, messages, emit);
                emit({ type: 'done' });
            } catch (err) {
                console.error('Error en el chat IA:', err);
                emit({ type: 'error', message: err?.message || 'Error interno' });
                emit({ type: 'done' });
            } finally {
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive'
        }
    });
}
