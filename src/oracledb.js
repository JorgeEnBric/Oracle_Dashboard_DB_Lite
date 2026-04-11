
import oracledb from 'oracledb';
export async function getAWRReport(bd_id, session, bid, eid) {
    let connection;
  
    try {
        const { usuario, password, host, port, service } = session;
        //connection = await oracledb.getConnection(session);
        const connection = await oracledb.getConnection({
            user: usuario,
            password: password,
            connectString: `${host}:${port}/${service}`
        });
        
        const sql = `
            SELECT output FROM TABLE(
                dbms_workload_repository.awr_global_report_html(${bd_id}, '',  :bid, :eid)
            )`;

        const result = await connection.execute(sql, {
            bid: bid, // Snapshot inicial
            eid: eid  // Snapshot final
        });

        // El AWR viene como un array de líneas, las unimos todas
        const fullHtml = result.rows.map(row => row[0]).join('\n');
        
        await connection.close();
        return fullHtml;
    } catch (err) {
        if (connection) await connection.close();
        throw err;
    }
}

//Función que recibe un query y lo ejecuta, devolviendo el resultado
export async function executeQuery(query, session, params = {}) {

    console.log('params que llegan a executeQuery:', params);
    console.log('tipo de params:', typeof params);
    console.log('keys:', Object.keys(params));

    //console.log('Ejecutando query:', query);
    //console.log('Información de la sesión:', session);
    const { usuario, password, host, port, service } = session;
    try {
        const connection = await oracledb.getConnection({
            user: usuario,
            password: password,
            connectString: `${host}:${port}/${service}`
        });
        //const result = await connection.execute(query);
        const result = await connection.execute(
            query, 
            params, 
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        await connection.close();
        return result.rows;
    } catch (err) {
        console.error('Error al ejecutar query:', err);
        throw err;
    }
}

