const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Conectar a la base de datos
const db = new sqlite3.Database(path.join(__dirname, '../database/parseador.db'), (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err);
        process.exit(1);
    }
});

// Ejecutar la migración
db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    try {
        // Agregar la columna esFormatoJson a la tabla parseadores
        db.run(
            'ALTER TABLE parseadores ADD COLUMN esFormatoJson BOOLEAN DEFAULT 0',
            (err) => {
                if (err) {
                    console.error('Error al agregar la columna esFormatoJson:', err);
                    db.run('ROLLBACK');
                    process.exit(1);
                }
                
                console.log('Columna esFormatoJson agregada exitosamente');
                db.run('COMMIT');
                process.exit(0);
            }
        );
    } catch (error) {
        console.error('Error en la migración:', error);
        db.run('ROLLBACK');
        process.exit(1);
    }
}); 