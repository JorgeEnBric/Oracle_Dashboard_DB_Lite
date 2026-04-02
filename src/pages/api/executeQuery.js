
import oracledb from 'oracledb';


//Funcion que recibe un query y lo ejecuta, devolviendo el resultado
export async function POST({ request }) {
    const { query, params } = await request.json(); 
    const { usuario, password, host, port, service } = dbSession;
    let connection;
    try {
        connection = await oracledb.getConnection({
            user: usuario,
            password: password,
            connectString: `${host}:${port}/${service}`
        });
        const result = await connection.execute(query, params);
        return result.rows;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error al cerrar la conexión:', err);
            }
        }
    }
}
