const { Pool } = require('pg');

// Agregar search_path a la URL de conexión si no está presente
let connectionString = process.env.DATABASE_URL;
if (connectionString && !connectionString.includes('search_path=')) {
    const separator = connectionString.includes('?') ? '&' : '?';
    connectionString = `${connectionString}${separator}search_path=public`;
}

// Configuración del pool de conexiones para PostgreSQL/Neon
const pool = new Pool({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false // Necesario para Neon
    },
    // Configuración optimizada para serverless
    max: 20, // Máximo de conexiones en el pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// Manejo de errores del pool
pool.on('error', (err) => {
    console.error('Error inesperado en el pool de PostgreSQL:', err);
});

// Crear tablas si no existen
const initDatabase = async () => {
    const client = await pool.connect();
    try {
        // Asegurar que el search_path esté configurado
        await client.query('SET search_path TO public');
        await client.query('BEGIN');

        const tables = [
            // Tabla para parseadores simples
            `CREATE TABLE IF NOT EXISTS parseadores (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                tiene_delimitador BOOLEAN NOT NULL,
                delimitador TEXT,
                cantidad_columnas INTEGER NOT NULL,
                incluye_secciones BOOLEAN NOT NULL,
                esFormatoJson BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Tabla para columnas de parseadores
            `CREATE TABLE IF NOT EXISTS columnas_parseador (
                id SERIAL PRIMARY KEY,
                parseador_id INTEGER,
                nombre TEXT NOT NULL,
                cantidad_caracteres INTEGER,
                orden INTEGER NOT NULL,
                FOREIGN KEY (parseador_id) REFERENCES parseadores(id) ON DELETE CASCADE
            )`,

            // Tabla para secciones
            `CREATE TABLE IF NOT EXISTS secciones (
                id SERIAL PRIMARY KEY,
                parseador_id INTEGER,
                nombre TEXT NOT NULL,
                header TEXT NOT NULL,
                tiene_delimitador BOOLEAN NOT NULL,
                delimitador TEXT,
                cantidad_columnas INTEGER NOT NULL,
                orden INTEGER NOT NULL,
                FOREIGN KEY (parseador_id) REFERENCES parseadores(id) ON DELETE CASCADE
            )`,

            // Tabla para columnas de secciones
            `CREATE TABLE IF NOT EXISTS columnas_seccion (
                id SERIAL PRIMARY KEY,
                seccion_id INTEGER,
                nombre TEXT NOT NULL,
                cantidad_caracteres INTEGER,
                orden INTEGER NOT NULL,
                FOREIGN KEY (seccion_id) REFERENCES secciones(id) ON DELETE CASCADE
            )`
        ];

        // Crear índices para mejorar el rendimiento
        const indexes = [
            `CREATE INDEX IF NOT EXISTS idx_parseador_id ON columnas_parseador(parseador_id)`,
            `CREATE INDEX IF NOT EXISTS idx_seccion_parseador_id ON secciones(parseador_id)`,
            `CREATE INDEX IF NOT EXISTS idx_seccion_id ON columnas_seccion(seccion_id)`
        ];

        // Ejecutar creación de tablas
        for (const sql of tables) {
            await client.query(sql);
        }

        // Ejecutar creación de índices
        for (const sql of indexes) {
            await client.query(sql);
        }

        await client.query('COMMIT');
        console.log('Base de datos PostgreSQL inicializada correctamente');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al inicializar la base de datos:', err);
        throw err;
    } finally {
        client.release();
    }
};

// Inicializar la base de datos solo si no estamos en entorno serverless
// En Vercel, las tablas ya deben existir
if (process.env.NODE_ENV !== 'production') {
    initDatabase().catch(err => {
        console.error('Error fatal al inicializar la base de datos:', err);
        // No hacer process.exit() en serverless
        if (process.env.NODE_ENV !== 'production') {
            process.exit(1);
        }
    });
}

// Función helper para queries con manejo de errores
pool.queryWithClient = async (callback) => {
    const client = await pool.connect();
    try {
        return await callback(client);
    } finally {
        client.release();
    }
};

// Graceful shutdown (no se usa en serverless, pero útil para desarrollo local)
const shutdown = async () => {
    console.log('Cerrando pool de conexiones PostgreSQL...');
    await pool.end();
    console.log('Pool cerrado correctamente');
};

process.on('SIGINT', async () => {
    await shutdown();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await shutdown();
    process.exit(0);
});

module.exports = pool;
