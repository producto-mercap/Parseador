// Cargar variables de entorno (primero archivo de Vercel, luego local)
require('dotenv').config({ path: '/vercel/share/.env.project' });
require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();

// ConfiguraciÃ³n
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Aumentar lÃ­mites para el procesamiento de datos
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rutas
const parserRoutes = require('./routes/parserRoutes');
app.use('/', parserRoutes);

// Manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor' 
    });
});

// Iniciar el servidor cuando NO estamos en el entorno serverless de Vercel.
// En Vercel (serverless) la variable de entorno VERCEL está definida y solo
// exportamos la app. En local o en la preview levantamos un servidor real.
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || process.env.DEV_PORT || 3001;
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en puerto ${PORT}`);
    });
}

// Exportar para Vercel (serverless)
module.exports = app;
