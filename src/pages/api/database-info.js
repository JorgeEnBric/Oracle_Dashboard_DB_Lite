import oracledb from 'oracledb';

export async function GET({ request }) {
    // Get session from cookie
    const cookies = request.headers.get('cookie') || '';
    const dbSessionCookie = cookies.split(';').find(c => c.trim().startsWith('db_session='));
    if (!dbSessionCookie) {
        return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    const dbSession = JSON.parse(dbSessionCookie.split('=')[1]);
    const { usuario, password, host, port, service } = dbSession;

    try {
        const connection = await oracledb.getConnection({
            user: usuario,
            password: password,
            connectString: `${host}:${port}/${service}`
        });
        const result = await connection.execute("SELECT name, open_mode FROM v$database");
        await connection.close();
        return new Response(JSON.stringify(result.rows), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error('Error al ejecutar query:', err);
        return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}