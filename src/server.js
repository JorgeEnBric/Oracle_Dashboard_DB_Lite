
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



//Función que recibe un query y lo ejecuta, devolviendo el resultado
export async function executeQuery(query, session) {

    console.log('Ejecutando query:', query);
    console.log('Información de la sesión:', session);
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



function getAlertLogErrors(session, startDate, endDate) {
    return executeQuery(session, 
        "SELECT originating_timestamp, message_text FROM v$diag_alert_ext WHERE message_text LIKE '%ORA-%' AND originating_timestamp BETWEEN TO_TIMESTAMP(:1, 'YYYY-MM-DD HH24:MI:SS') AND TO_TIMESTAMP(:2, 'YYYY-MM-DD HH24:MI:SS') ORDER BY originating_timestamp DESC", 
        [startDate.replace('T', ' '), endDate.replace('T', ' ')]);
}

//Funcion para obtener información general de la base de datos
function getDatabaseInfo(session) {
    return executeQuery(session, "SELECT name, open_mode FROM v$database");
}




// Ruta para logout
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error('Error al cerrar sesión:', err);
        res.redirect('/');
    });
});

// Ruta para analizar
app.post('/analyze', async (req, res) => {
    if (!req.session.dbConnection) {
        return res.redirect('/');
    }
    try {
        const result = await executeQuery(req.session, 
            "SELECT originating_timestamp, message_text FROM v$diag_alert_ext WHERE message_text LIKE '%ORA-%' AND originating_timestamp BETWEEN TO_TIMESTAMP(:1, 'YYYY-MM-DD HH24:MI:SS') AND TO_TIMESTAMP(:2, 'YYYY-MM-DD HH24:MI:SS') ORDER BY originating_timestamp DESC", 
            [req.body.startDate.replace('T', ' '), req.body.endDate.replace('T', ' ')]);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error leer el alertlog', err);
        res.json({ success: false, error: err.message });
    }
    
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
