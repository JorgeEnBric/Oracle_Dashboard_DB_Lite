// src/pages/api/generate-awr.ts
import type { APIRoute } from 'astro';
import { getAWRReport, executeQuery } from '../../oracledb.js';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const session = cookies.get('db_session')?.json();

    if (!session) {
      return new Response(JSON.stringify({ error: 'No hay sesión activa.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { snapStart, snapEnd } = body;

    if (!snapStart || !snapEnd) {
      return new Response(JSON.stringify({ error: 'Parámetros snap_start y snap_end requeridos.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (parseInt(snapStart) > parseInt(snapEnd)) {
      return new Response(JSON.stringify({ error: 'El Snap de Inicio no puede ser mayor al Snap de Fin.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener DBID e INSTANCE_NUMBER
    const bd_id = await executeQuery(
      "SELECT dbid, instance_number FROM v$database, v$instance",
      session
    );
    const { DBID, INSTANCE_NUMBER } = bd_id?.[0];

    // Generar el reporte (operación costosa)
    const awrData = await getAWRReport(DBID, INSTANCE_NUMBER, session, snapStart, snapEnd);

    return new Response(JSON.stringify({ html: awrData }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Error generando AWR:', err);
    return new Response(JSON.stringify({ error: err?.message || 'Error interno del servidor.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};