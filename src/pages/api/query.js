// src/pages/api/query.js
//import contention from '../../components/Contention.jsx';
import { executeQuery } from '../../oracledb.js';



// Agrega aquí todas tus queries con un nombre clave
const QUERIES = {
    active_sessions_chart: `
            SELECT   
            TO_CHAR(SAMPLE_TIME, 'DD-MON HH24:MI', 'NLS_DATE_LANGUAGE = AMERICAN') AS TIEMPO,
                NVL(WAIT_CLASS, 'CPU_ON')                                                 AS TIPO,
                COUNT(*)                                                               AS SESIONES
            FROM (
                -- Casos donde isRelative es 1: Usamos la vista en vivo (ASH)
                SELECT SAMPLE_TIME, WAIT_CLASS
                FROM V$ACTIVE_SESSION_HISTORY
                WHERE :isRelative = 1 
                AND SAMPLE_TIME >= SYSDATE - (:hours / 24)
                UNION ALL
                -- Casos donde isRelative es 0: Usamos la vista histórica (AWR)
                SELECT SAMPLE_TIME, WAIT_CLASS
                FROM DBA_HIST_ACTIVE_SESS_HISTORY
                WHERE :isRelative = 0 
                AND SAMPLE_TIME BETWEEN TO_DATE(:fStart, 'DD-MON-YYYY HH24:MI', 'NLS_DATE_LANGUAGE = AMERICAN') 
                                    AND TO_DATE(:fEnd, 'DD-MON-YYYY HH24:MI', 'NLS_DATE_LANGUAGE = AMERICAN')
            )
            GROUP BY TO_CHAR(SAMPLE_TIME, 'DD-MON HH24:MI', 'NLS_DATE_LANGUAGE = AMERICAN'), NVL(WAIT_CLASS, 'CPU_ON')
            ORDER BY MIN(SAMPLE_TIME) ASC
    `,
    active_sessions_details: `
        SELECT 
        IDENTIFICADOR,
        SQL_ID,
        TIEMPO,
        TIPO,
        SESIONES_CONCURRENTES,
        MINUTOS_ACTIVIDAD,
        SQL_TEXT_SHORT
    FROM (
        SELECT 
            CASE 
                WHEN FORCE_MATCHING_SIGNATURE = 0 THEN 'Internal/PLSQL'
                ELSE TO_CHAR(FORCE_MATCHING_SIGNATURE) 
            END AS IDENTIFICADOR,
            ash.SQL_ID,
            TO_CHAR(ash.SAMPLE_TIME, 'DD-MON HH24:MI', 'NLS_DATE_LANGUAGE = AMERICAN') AS TIEMPO,
            NVL(ash.WAIT_CLASS, 'CPU_ON') AS TIPO,
            COUNT(*) AS SESIONES_CONCURRENTES,
            ROUND(SUM(CASE WHEN ORIGEN = 'LIVE' THEN 1 ELSE 10 END) / 60, 2) AS MINUTOS_ACTIVIDAD,
            MAX(ash.SQL_TEXT_SHORT) AS SQL_TEXT_SHORT
        FROM (
            -- Rama LIVE (V$SQL)
            SELECT a.FORCE_MATCHING_SIGNATURE, a.SQL_ID, a.SAMPLE_TIME, a.WAIT_CLASS, a.USER_ID, 'LIVE' AS ORIGEN,
                (SELECT CAST(DBMS_LOB.SUBSTR(st.SQL_TEXT, 100, 1) AS VARCHAR2(100)) 
                    FROM V$SQL st 
                    WHERE st.SQL_ID = a.SQL_ID AND ROWNUM = 1) AS SQL_TEXT_SHORT
            FROM V$ACTIVE_SESSION_HISTORY a
            WHERE :isRelative = 1 AND a.SAMPLE_TIME >= SYSDATE - (:hours / 24)
            AND a.USER_ID <> 0 
            AND a.SQL_ID IS NOT NULL

            UNION ALL

            -- Rama HISTÓRICA (DBA_HIST_SQLTEXT)
            SELECT a.FORCE_MATCHING_SIGNATURE, a.SQL_ID, a.SAMPLE_TIME, a.WAIT_CLASS, a.USER_ID, 'HIST' AS ORIGEN,
                (SELECT CAST(DBMS_LOB.SUBSTR(st.SQL_TEXT, 100, 1) AS VARCHAR2(100)) 
                    FROM DBA_HIST_SQLTEXT st 
                    WHERE st.SQL_ID = a.SQL_ID AND ROWNUM = 1) AS SQL_TEXT_SHORT
            FROM DBA_HIST_ACTIVE_SESS_HISTORY a
            WHERE :isRelative = 0 AND a.SAMPLE_TIME BETWEEN TO_DATE(:fStart, 'DD-MON-YYYY HH24:MI', 'NLS_DATE_LANGUAGE = AMERICAN') 
                                                AND TO_DATE(:fEnd, 'DD-MON-YYYY HH24:MI', 'NLS_DATE_LANGUAGE = AMERICAN')
            AND a.USER_ID <> 0 
            AND a.SQL_ID IS NOT NULL
        ) ash
        GROUP BY 
            TO_CHAR(ash.SAMPLE_TIME, 'DD-MON HH24:MI', 'NLS_DATE_LANGUAGE = AMERICAN'), 
            NVL(ash.WAIT_CLASS, 'CPU_ON'), 
            FORCE_MATCHING_SIGNATURE,
            ash.SQL_ID
    )
    ORDER BY MINUTOS_ACTIVIDAD, TIEMPO DESC
    `,
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
    sesiones_activas: `
    select
    s.inst_id,
    s.sid,
    s.serial#,  
        s.SQL_ID, 
        s.WAIT_CLASS, 
        TO_CHAR(TRUNC(s.LAST_CALL_ET/3600),'FM9900') || ':' ||
        TO_CHAR(TRUNC(MOD(s.LAST_CALL_ET,3600)/60),'FM00') || ':' ||
        TO_CHAR(MOD(s.LAST_CALL_ET,60),'FM00') AS duration,
        s.MACHINE, 
        substr(s.PROGRAM, 1, 15) as PROGRAM, 
        substr(sql.SQL_TEXT, 1, 40) as SQL_TEXT 
    FROM gv$session s 
    LEFT JOIN gv$sql sql 
        ON s.SQL_ID = sql.SQL_ID 
        AND s.inst_id = sql.inst_id
    WHERE s.type != 'BACKGROUND' 
    AND s.status = 'ACTIVE'
    ORDER BY s.LAST_CALL_ET DESC
    `,
    statusdb: `
            SELECT 
            i.inst_id,
            d.name AS db_name,
            -- Identificador del modo activo
            CASE 
                WHEN (SELECT TO_NUMBER(VALUE) FROM gv$parameter WHERE name = 'memory_target' AND inst_id = i.inst_id) > 0 THEN 'AMM (Automatic)'
                WHEN (SELECT TO_NUMBER(VALUE) FROM gv$parameter WHERE name = 'sga_target' AND inst_id = i.inst_id) > 0 THEN 'ASMM (SGA/PGA Target)'
                ELSE 'MANUAL'
            END AS memory_mode,
            -- MEM_TARGET: Solo muestra valor si es > 0
            NULLIF((SELECT ROUND(VALUE / 1024 / 1024, 2) FROM gv$parameter WHERE name = 'memory_target' AND inst_id = i.inst_id), 0) AS mem_target_mb,
            -- SGA_TARGET: Solo muestra valor si es > 0
            NULLIF((SELECT ROUND(VALUE / 1024 / 1024, 2) FROM gv$parameter WHERE name = 'sga_target' AND inst_id = i.inst_id), 0) AS sga_target_mb,
            -- SGA ACTUAL: Siempre relevante
            (SELECT ROUND(SUM(value) / 1024 / 1024, 2) FROM gv$sga s WHERE s.inst_id = i.inst_id) AS sga_actual_mb,
            -- PGA_TARGET: Solo muestra valor si es > 0
            NULLIF((SELECT ROUND(VALUE / 1024 / 1024, 2) FROM gv$parameter WHERE name = 'pga_aggregate_target' AND inst_id = i.inst_id), 0) AS pga_target_mb,
            -- PGA ACTUAL: Siempre relevante
            (SELECT ROUND(value / 1024 / 1024, 2) FROM gv$pgastat p 
            WHERE p.inst_id = i.inst_id AND p.name = 'total PGA allocated') AS pga_allocated_mb,
            -- Memoria Física
            (SELECT ROUND(value / 1024 / 1024, 2) FROM gv$osstat o 
            WHERE o.inst_id = i.inst_id AND o.STAT_NAME = 'PHYSICAL_MEMORY_BYTES') AS host_mem_mb
        FROM 
            gv$database d,
            gv$instance i
        WHERE 
            d.inst_id = i.inst_id
        ORDER BY 
            i.inst_id
    `,
    infoSGA_PGA: `
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
    contention: `
    SELECT gvs.inst_id,DECODE (request, 0, 'Holder: ', 'waiter:')|| gvl.sid SESS, 
        gvs.sid as sid,
        gvs.serial# as serial#,
        status,
         username,
         event,
         gvs.seconds_in_wait,
         gvl.TYPE, 
         sql_id
    FROM gv$lock gvl, gv$session gvs
   WHERE     
   (id1, id2, gvl.TYPE)  IN (SELECT id1, id2, TYPE FROM gv$lock WHERE request > 0)
   AND 
         gvl.sid = gvs.sid and gvl.inst_id=gvs.inst_id
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




    const session = cookies.get('db_session')?.json();
    const queryName = url.searchParams.get('q');

    // Parámetros de la URL
    const hours = url.searchParams.get('hours');
    const start = url.searchParams.get('fStart');
    const end = url.searchParams.get('fEnd');

    if (queryName === 'active_sessions_chart' || queryName === 'active_sessions_details') {
        try {
            const binds = {
                isRelative: start && end ? 0 : 1,
                hours: Number(hours || 1),
                fStart: start || '', // default dummy
                fEnd: end || ''     // default dummy
            };
            console.log("##Ejecutando query con binds:", binds);
            const data = await executeQuery(QUERIES[queryName], session, binds);
            return new Response(JSON.stringify(data), { status: 200 });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
    } else {
        const data = await executeQuery(QUERIES[queryName], session);
        return new Response(JSON.stringify(data), { status: 200 });
    }

}