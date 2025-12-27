const pool = require('../models/database');

/**
 * Migración para agregar columna config_json a la tabla parseadores
 * Esta columna almacenará la configuración del parseador JSON:
 * - separador: '.' o '_' para claves anidadas
 * - arrayPrimitivos: 'expandir' o 'serializar'
 * - arrayObjetos: 'normalizar' o 'aplanar'
 */
async function runMigration() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verificar si la columna ya existe
        const checkColumn = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'parseadores' 
            AND column_name = 'config_json'
        `);

        if (checkColumn.rows.length === 0) {
            // Agregar la columna config_json como JSONB
            await client.query(`
                ALTER TABLE parseadores 
                ADD COLUMN config_json JSONB DEFAULT '{}'::jsonb
            `);

            console.log('✓ Columna config_json agregada exitosamente');
        } else {
            console.log('✓ Columna config_json ya existe, omitiendo...');
        }

        await client.query('COMMIT');
        console.log('✓ Migración 002 completada exitosamente');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('✗ Error en la migración 002:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Ejecutar la migración si se llama directamente
if (require.main === module) {
    runMigration()
        .then(() => {
            console.log('Migración completada');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error fatal:', error);
            process.exit(1);
        });
}

module.exports = runMigration;

