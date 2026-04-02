import oracledb from 'oracledb';

export async function POST({ request }) {
    const cookies = request.headers.get('cookie') || '';
    const dbSessionCookie = cookies.split(';').find(c => c.trim().startsWith('db_session='));
    if (!dbSessionCookie) {
        return new Response(JSON.stringify({ success: false, error: 'No session' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    const dbSession = JSON.parse(dbSessionCookie.split('=')[1]);
    const { usuario, password, host, port, service } = dbSession;
    const data = await request.json();
    const { startDate, endDate } = data;

    try {
        const connection = await oracledb.getConnection({
            user: usuario,
            password: password,
            connectString: `${host}:${port}/${service}`
        });
        const result = await connection.execute(
            "SELECT originating_timestamp, message_text FROM v$diag_alert_ext WHERE message_text LIKE '%ORA-%' AND originating_timestamp BETWEEN TO_TIMESTAMP(:1, 'YYYY-MM-DD HH24:MI:SS') AND TO_TIMESTAMP(:2, 'YYYY-MM-DD HH24:MI:SS') ORDER BY originating_timestamp DESC",
            [startDate.replace('T', ' '), endDate.replace('T', ' ')]
        );
        await connection.close();
        return new Response(JSON.stringify({ success: true, data: result.rows }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error('Error leer el alertlog', err);
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}