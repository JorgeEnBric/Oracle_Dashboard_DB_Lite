// src/pages/api/query.js
import contention from '../../components/Contention.jsx';
import { executeQuery } from '../../oracledb.js';

// Agrega aquí todas tus queries con un nombre clave
const QUERIES = {
    alertlog: `
        SELECT originating_timestamp, message_text 
        FROM v$diag_alert_ext 
        WHERE message_text LIKE '%ORA-%' 
        AND rownum <= 10 
        ORDER BY originating_timestamp DESC
    `,
    eventos_activos: `
    select SubStr(S.Event,1,30) Event,count(1) as "Cantidad"
        From gV$SESSION S, V$SESSION_WAIT W, V$PROCESS P
        Where S.SID = W.SID(+)
        And S.PAddr(+) = P.Addr
        And (S.Status = 'ACTIVE')
        And S.Username is not null
        group by S.event`,
    ash: `
     SELECT 
    ash.event,
    ash.FORCE_MATCHING_SIGNATURE, 
    ROUND(COUNT(*) / 60, 2) AS ESTIMATED_WAIT_MINUTES,
    ROUND(SUM(ash.TIME_WAITED) / 1000000 / 60, 2) AS RECORDED_WAIT_MINUTES,
    COUNT(*) AS SAMPLES,
    MAX(ash.SQL_ID) AS SQL_ID,
    MAX(DBMS_LOB.SUBSTR(sq.SQL_TEXT, 100, 1)) AS SQL_TEXT_SHORT
    FROM gv$active_session_history ash
    JOIN gv$sqlarea sq 
        ON  ash.SQL_ID = sq.SQL_ID 
        AND ash.INST_ID = sq.INST_ID
    WHERE ash.sample_time > SYSDATE - 1/24 
    AND ash.FORCE_MATCHING_SIGNATURE > 0
    AND ash.event IS NOT NULL
    GROUP BY ash.FORCE_MATCHING_SIGNATURE, ash.event
    HAVING (COUNT(*) / 60) > 5
    ORDER BY ESTIMATED_WAIT_MINUTES DESC
    `,
    statusdb: `SELECT name, open_mode, log_mode FROM v$database`,
    infoSGA_PGA : `
WITH pga_actual AS (
    SELECT 
        inst_id,
        MAX(CASE WHEN pga_target_factor = 1 THEN estd_pga_cache_hit_percentage END) AS cache_hit_actual,
        MAX(CASE WHEN pga_target_factor = 1 THEN ROUND(pga_target_for_estimate/1024/1024, 2) END) AS pga_actual_mb
    FROM gv$pga_target_advice
    WHERE pga_target_for_estimate IS NOT NULL
    GROUP BY inst_id
),
sga_advice AS (
    SELECT
        inst_id,
        CASE 
            WHEN COUNT(CASE WHEN sga_size_factor > 1 
                            AND estd_db_time_factor < 0.95 THEN 1 END) > 0 
            THEN 
                'MEJORA: Ganancia de rendimiento ajustando desde ' || 
                MIN(CASE WHEN sga_size_factor > 1 
                         AND estd_db_time_factor < 0.95 THEN sga_size END) || 
                ' MB hasta ' || 
                MAX(CASE WHEN sga_size_factor > 1 
                         AND estd_db_time_factor < 0.95 THEN sga_size END) || 
                ' MB. Tamaño actual: ' || 
                MAX(CASE WHEN sga_size_factor = 1 THEN sga_size END) || ' MB.' ||
                ' (DB Time Factor minimo: ' ||
                MIN(CASE WHEN sga_size_factor > 1 
                         AND estd_db_time_factor < 0.95 
                         THEN ROUND(estd_db_time_factor, 3) END) || ')'
            ELSE 
                'El tamaño actual (' || 
                MAX(CASE WHEN sga_size_factor = 1 THEN sga_size END) || 
                ' MB) ya es óptimo para la carga actual de esta instancia'
        END AS advice_sga
    FROM gv$sga_target_advice
    WHERE sga_size IS NOT NULL
    GROUP BY inst_id
),
pga_advice AS (
    SELECT
        a.inst_id,
        CASE 
            WHEN COUNT(CASE WHEN a.pga_target_factor > 1 
                            AND a.estd_pga_cache_hit_percentage > p.cache_hit_actual
                            AND a.estd_overalloc_count = 0 THEN 1 END) > 0 
            THEN 
                'MEJORA: Ganancia de rendimiento ajustando desde ' || 
                MIN(CASE WHEN a.pga_target_factor > 1 
                         AND a.estd_overalloc_count = 0 THEN 
                         ROUND(a.pga_target_for_estimate/1024/1024, 2) END) || 
                ' MB hasta ' || 
                MAX(CASE WHEN a.pga_target_factor > 1 
                         AND a.estd_overalloc_count = 0 THEN 
                         ROUND(a.pga_target_for_estimate/1024/1024, 2) END) || 
                ' MB. Tamaño actual: ' || p.pga_actual_mb || 
                ' MB. (Cache Hit actual: ' || p.cache_hit_actual || 
                '% → Máximo estimado: ' ||
                MAX(CASE WHEN a.pga_target_factor > 1 
                         AND a.estd_overalloc_count = 0 
                    THEN a.estd_pga_cache_hit_percentage END) || '%)'
            ELSE 
                'El tamaño actual (' || p.pga_actual_mb || 
                ' MB) ya es óptimo para la carga actual de esta instancia. Cache Hit: ' || 
                p.cache_hit_actual || '%'
        END AS advice_pga
    FROM gv$pga_target_advice a
    JOIN pga_actual p ON a.inst_id = p.inst_id
    WHERE a.pga_target_for_estimate IS NOT NULL
    GROUP BY a.inst_id, p.cache_hit_actual, p.pga_actual_mb
)
SELECT
    s.inst_id                                    AS INSTANCIA,
    'REVISIÓN SGA (Instancia ' || s.inst_id || '): ' || s.advice_sga  AS ADVICE_SGA,
    'REVISIÓN PGA (Instancia ' || p.inst_id || '): ' || p.advice_pga  AS ADVICE_PGA
FROM sga_advice s
JOIN pga_advice p ON s.inst_id = p.inst_id
ORDER BY s.inst_id 
`,
contention: `SELECT gvs.inst_id,DECODE (request, 0, 'Holder: ', 'waiter:')|| gvl.sid SESS, gvl.sid, gvs.serial#,
         status,
         username,
         event,
         gvs.seconds_in_wait,
         gvl.TYPE, 
         gvs.SADDR,
         sql_id,
        'select inst_id,sid,sql_id,sql_text,LAST_SQL_ACTIVE_TIME,CURSOR_TYPE from gv$open_cursor 
        where saddr='''||gvs.SADDR||''' and inst_id='||gvs.inst_id||';' SEARCH_CURSORS,
        'alter system kill session '''||gvs.sid||','||gvs.serial#||',@'||gvs.inst_id||''' immediate;' KILL_SESS
    FROM gv$lock gvl, gv$session gvs
   WHERE     (id1, id2, gvl.TYPE) IN (SELECT id1, id2, TYPE
                                        FROM gv$lock
                                       WHERE request > 0)
         AND gvl.sid = gvs.sid and gvl.inst_id=gvs.inst_id
ORDER BY request
`,
backups: `SELECT
       TO_CHAR(r.start_time, 'YYYY-MM-DD')     Fecha_INICIO
      ,TO_CHAR(r.start_time, 'HH24:MI:SS')     Hora_INICIO
      ,TO_CHAR(r.end_time, 'YYYY-MM-DD')     Fecha_FIN
      ,TO_CHAR(r.end_time, 'HH24:MI:SS')     Hora_fin
      , r.time_taken_display                   Tiempo_TOMADO
      , substr(r.status,1,25)                  ESTADO
      , r.input_type                           Tipo
      , rpad(r.output_device_type,11,chr(126))   Dispositivo
      , lpad(r.input_bytes_display,11,chr(126))  Tam_Entrada
      , lpad(r.output_bytes_display,11,chr(126)) Tam_Salida
    FROM
        (select
             command_id
           , start_time
           , end_time
           , time_taken_display
           , status
           , input_type
           , output_device_type
           , input_bytes_display
           , output_bytes_display
           , output_bytes_per_sec_display
         from v$rman_backup_job_details
         order by start_time DESC
        ) r
    WHERE
        r.start_time > sysdate - 15
`

};

export async function GET({ cookies, url }) {
    // Leer sesión Oracle desde la cookie
    const session = cookies.get('db_session')?.json();

    if (!session) {
        return new Response(JSON.stringify({ error: 'Sin sesión' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Leer el parámetro ?q=alertlog
    const queryName = url.searchParams.get('q');

    if (!queryName || !QUERIES[queryName]) {
        return new Response(JSON.stringify({ error: `Query '${queryName}' no encontrada` }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const data = await executeQuery(QUERIES[queryName], session);
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error(`Error ejecutando query '${queryName}':`, e.message);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}