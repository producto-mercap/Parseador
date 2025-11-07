// Cargar variables de entorno
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

// Para desarrollo local
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en puerto ${PORT}`);
    });
}

// Exportar para Vercel (serverless)
module.exports = app;
