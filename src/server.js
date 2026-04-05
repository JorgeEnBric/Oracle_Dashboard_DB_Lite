
const app = express();

//Convirtiendo  require a import para usar ES Modules
import express from 'express';
import session from 'express-session';
import oracledb from 'oracledb';
import https from 'https';
import fs from 'fs';




// Middleware para parsear el body de las peticiones POST
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const checkAuth = (req, res, next) => {
    if (req.session && req.session.dbConnection) {
        console.log('Sesion activa', req.session);
        return next(); // Todo bien, continúa a la siguiente función
    }
    res.redirect('/'); // No hay sesión, fuera de aquí
};

// Configurar sesiones
app.use(session({
    secret: 'tu_secreto_aqui', // Cambia esto por algo seguro
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true } // Usar true con HTTPS
}));

// Ruta principal
app.get('/', (req, res) => {
    res.render('index');
});



// Ruta del dashboard
app.get('/dashboard', checkAuth, async (req, res) => {
    try {
        const databaseInfo = await getDatabaseInfo(req.session);
        // Renderizar el dashboard con la información de la base de datos en div class="central-zone"
        console.log('Información de la base de datos:', databaseInfo);
        res.render('dashboard', { databaseInfo: databaseInfo});
    } catch (err) {
        console.error('Error al cargar información de la base de datos:', err);
        res.status(500).send('Error al cargar información de la base de datos');
    }
}); 

export async function getAWRReport(bd_id, inst_id, session, bid, eid) {
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
                dbms_workload_repository.awr_report_html(${bd_id}, ${inst_id},  :bid, :eid)
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
export async function executeQuery(query, session) {

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
            [], 
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        await connection.close();
        return result.rows;
    } catch (err) {
        console.error('Error al ejecutar query:', err);
        throw err;
    }
}



// Ruta para logout
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error('Error al cerrar sesión:', err);
        res.redirect('/');
    });
});


// Puerto del servidor
const PORT = process.env.PORT || 3000;

// Opciones para HTTPS
const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};

// Crear servidor HTTPS
https.createServer(options, app).listen(PORT, () => {
    console.log(`Servidor HTTPS corriendo en https://localhost:${PORT}`);
});
