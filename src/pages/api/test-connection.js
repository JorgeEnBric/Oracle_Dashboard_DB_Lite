import oracledb from 'oracledb';

export async function POST({ request }) {
    const { usuario, password, host, port, service } = await request.json();

    try {
        const connection = await oracledb.getConnection({
            user: usuario,
            password: password,
            connectString: `${host}:${port}/${service}`
        });
        await connection.close();
        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error('Error en test de conexión:', err);
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}