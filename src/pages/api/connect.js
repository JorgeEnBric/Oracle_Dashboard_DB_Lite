import oracledb from 'oracledb';

export async function POST({ request }) {
    const data = await request.formData();
    const usuario = data.get('usuario');
    const password = data.get('password');
    const host = data.get('host');
    const port = data.get('port');
    const service = data.get('service');

    try {
        const connection = await oracledb.getConnection({
            user: usuario,
            password: password,
            connectString: `${host}:${port}/${service}`
        });
        await connection.close();

        const sessionData = JSON.stringify({ usuario, password, host, port, service });

        // For session, set a cookie with connection info or token
        // For simplicity, set a cookie
        const response = new Response(null, {
            status: 302,
            headers: { Location: '/dashboard' }
        });
        //response.headers.set('Set-Cookie', `db_session=${JSON.stringify({ usuario, password, host, port, service })}; Path=/; HttpOnly`);
        response.headers.append(
            'Set-Cookie',
            `db_session=${encodeURIComponent(sessionData)}; Path=/; HttpOnly; SameSite=Strict`
        );
       
       
        return response;
    } catch (err) {
        console.error(err);
        return new Response(`Error al conectar a la base de datos: ${err.message}`, {
            status: 500
        });
    }
}