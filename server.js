const express = require('express');
const session = require('express-session');
const oracledb = require('oracledb');
const https = require('https');
const fs = require('fs');
const app = express();

// Configurar EJS como motor de vistas
app.set('view engine', 'ejs');
app.set('views', './views');

// Middleware para parsear el body de las peticiones POST
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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

// Ruta para test de conexión
app.get('/test-connection', async (req, res) => {
    const { usuario, password, host, port, service } = req.query;
    try {
        const connection = await oracledb.getConnection({
            user: usuario,
            password: password,
            connectString: `${host}:${port}/${service}`
        });
        await connection.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error en test de conexión:', err);
        res.json({ success: false, error: err.message });
    }
});

// Ruta para conectar
app.post('/connect', async (req, res) => {
    const { usuario, password, host, port, service } = req.body;
    try {
        const connection = await oracledb.getConnection({
            user: usuario,
            password: password,
            connectString: `${host}:${port}/${service}`
        });
        req.session.dbConnection = { usuario, password, host, port, service };
        await connection.close();
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.send('Error al conectar a la base de datos: ' + err.message);
    }
});

// Ruta del dashboard
app.get('/dashboard', async (req, res) => {
    if (!req.session.dbConnection) {
        return res.redirect('/');
    }
    const { usuario, password, host, port, service } = req.session.dbConnection;
    try {
        const connection = await oracledb.getConnection({
            user: usuario,
            password: password,
            connectString: `${host}:${port}/${service}`
        });
        const result = await connection.execute('SELECT name, open_mode FROM v$database');
        await connection.close();
        res.render('dashboard', { tables: result.rows, alertLogs: [], error: null });
    } catch (err) {
        console.error(err);
        res.send('Error al consultar la base de datos: ' + err.message);
    }
});

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
    const { startDate, endDate } = req.body;
    const { usuario, password, host, port, service } = req.session.dbConnection;
    try {
        const connection = await oracledb.getConnection({
            user: usuario,
            password: password,
            connectString: `${host}:${port}/${service}`
        });
        // Consulta para alert log (últimas líneas en rango)
        const alertQuery = `SELECT originating_timestamp, message_text FROM V$DIAG_ALERT_EXT WHERE originating_timestamp BETWEEN TO_DATE(:start, 'YYYY-MM-DD HH24:MI') AND TO_DATE(:end, 'YYYY-MM-DD HH24:MI') ORDER BY originating_timestamp DESC FETCH FIRST 50 ROWS ONLY`;
        const alertResult = await connection.execute(alertQuery, { start: startDate.replace('T', ' '), end: endDate.replace('T', ' ') });
        await connection.close();
        res.render('dashboard', { tables: [], alertLogs: alertResult.rows, error: null });
    } catch (err) {
        console.error('Error al analizar:', err);
        res.render('dashboard', { tables: [], alertLogs: [], error: err.message });
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
