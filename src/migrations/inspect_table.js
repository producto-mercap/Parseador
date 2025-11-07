const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Conectar a la base de datos
const db = new sqlite3.Database(path.join(__dirname, '../database/parseador.db'), (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err);
        process.exit(1);
    }
});

// Obtener la estructura de la tabla parseadores
db.all("PRAGMA table_info(parseadores)", (err, rows) => {
    if (err) {
        console.error('Error al obtener la estructura de la tabla:', err);
        process.exit(1);
    }
    
    console.log('Estructura de la tabla parseadores:');
    rows.forEach(row => {
        console.log(`${row.name} (${row.type})`);
    });
    
    process.exit(0);
}); 