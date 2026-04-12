
import { executeQuery } from '../../oracledb.js';

export async function POST({ request, cookies }) {
  const sessionCookie = cookies.get('db_session')?.json();


  try {

    const data = await request.json();
    const sqlKill = `ALTER SYSTEM KILL SESSION '${data.sid}, ${data.serial}, @${data.instance}'  IMMEDIATE`;
    const result = await executeQuery(
      sqlKill,
      sessionCookie
    );

    return new Response(
      JSON.stringify({
        message: "Sesion terminada exitosamente",
        received: data,
        success: true
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
        success: false
      }
    );
  }
}
