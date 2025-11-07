const pool = require('./database');
const Parser = require('./Parser');

class ParserDB {
    static async create(parserData) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Insertar parseador principal
            const parserResult = await client.query(
                `INSERT INTO parseadores (
                    nombre, 
                    tiene_delimitador, 
                    delimitador, 
                    cantidad_columnas, 
                    incluye_secciones,
                    esFormatoJson
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id`,
                [
                    parserData.nombre,
                    parserData.tieneDelimitador || false,
                    parserData.delimitador,
                    parserData.columnas?.length || parserData.cantidadColumnas || 0,
                    parserData.incluyeSecciones || false,
                    parserData.esFormatoJson || false
                ]
            );

            const parserId = parserResult.rows[0].id;

            if (!parserData.incluyeSecciones && parserData.columnas) {
                // Insertar columnas para parseador simple
                for (let index = 0; index < parserData.columnas.length; index++) {
                    const columna = parserData.columnas[index];
                    await client.query(
                        `INSERT INTO columnas_parseador (
                            parseador_id,
                            nombre,
                            cantidad_caracteres,
                            orden
                        ) VALUES ($1, $2, $3, $4)`,
                        [parserId, columna.nombre, columna.caracteres, index]
                    );
                }
            }

            if (parserData.incluyeSecciones && parserData.secciones) {
                // Insertar secciones y sus columnas
                for (let secIndex = 0; secIndex < parserData.secciones.length; secIndex++) {
                    const seccion = parserData.secciones[secIndex];
                    
                    const seccionResult = await client.query(
                        `INSERT INTO secciones (
                            parseador_id,
                            nombre,
                            header,
                            tiene_delimitador,
                            delimitador,
                            cantidad_columnas,
                            orden
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                        RETURNING id`,
                        [
                            parserId,
                            seccion.nombre,
                            seccion.header,
                            seccion.tieneDelimitador || false,
                            seccion.delimitador,
                            seccion.cantidadColumnas || seccion.columnas?.length || 0,
                            secIndex
                        ]
                    );

                    const seccionId = seccionResult.rows[0].id;

                    // Insertar columnas de la sección
                    if (seccion.columnas) {
                        for (let colIndex = 0; colIndex < seccion.columnas.length; colIndex++) {
                            const col = seccion.columnas[colIndex];
                            await client.query(
                                `INSERT INTO columnas_seccion (
                                    seccion_id,
                                    nombre,
                                    cantidad_caracteres,
                                    orden
                                ) VALUES ($1, $2, $3, $4)`,
                                [seccionId, col.nombre, col.caracteres, colIndex]
                            );
                        }
                    }
                }
            }

            await client.query('COMMIT');
            return { id: parserId, ...parserData };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async getAll() {
        try {
            const result = await pool.query(
                `SELECT * FROM parseadores ORDER BY created_at DESC`
            );

            const parsers = result.rows;

            // Obtener datos relacionados para cada parser
            const parsersWithDetails = await Promise.all(parsers.map(async parser => {
                if (!parser.incluye_secciones) {
                    parser.columnas = await this.getColumnasByParserId(parser.id);
                } else {
                    parser.secciones = await this.getSeccionesByParserId(parser.id);
                }
                return parser;
            }));

            return parsersWithDetails;
        } catch (error) {
            throw error;
        }
    }

    static async getParserById(id) {
        try {
            const result = await pool.query(
                `SELECT * FROM parseadores WHERE id = $1`,
                [id]
            );

            if (result.rows.length === 0) {
                return null;
            }

            const parser = result.rows[0];
            
            // Convertir nombres de columnas
            parser.tieneDelimitador = parser.tiene_delimitador;
            parser.incluyeSecciones = parser.incluye_secciones;
            
            return parser;
        } catch (error) {
            throw error;
        }
    }

    static async getById(id) {
        try {
            const parser = await this.getParserById(id);
            if (!parser) {
                return null;
            }

            // Obtener columnas o secciones según corresponda
            if (!parser.incluyeSecciones) {
                const columnas = await this.getColumnasByParserId(id);
                parser.columnas = columnas.map(col => ({
                    id: col.id,
                    nombre: col.nombre,
                    caracteres: col.caracteres,
                    orden: col.orden
                }));
            } else {
                parser.secciones = await this.getSeccionesByParserId(id);
            }

            return parser;
        } catch (error) {
            throw error;
        }
    }

    static async delete(id) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // PostgreSQL con ON DELETE CASCADE hace esto automáticamente,
            // pero lo hacemos explícito por claridad
            
            // Eliminar columnas del parseador
            await client.query('DELETE FROM columnas_parseador WHERE parseador_id = $1', [id]);

            // Eliminar columnas de las secciones asociadas
            await client.query(
                `DELETE FROM columnas_seccion 
                 WHERE seccion_id IN (
                     SELECT id FROM secciones WHERE parseador_id = $1
                 )`,
                [id]
            );

            // Eliminar secciones
            await client.query('DELETE FROM secciones WHERE parseador_id = $1', [id]);

            // Eliminar el parseador
            const result = await client.query('DELETE FROM parseadores WHERE id = $1', [id]);

            await client.query('COMMIT');
            
            return result.rowCount > 0;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async update(id, parserData) {
        if (!parserData) {
            throw new Error('No se proporcionaron datos para actualizar');
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Actualizar parseador principal
            await client.query(
                `UPDATE parseadores SET 
                    nombre = $1, 
                    tiene_delimitador = $2, 
                    delimitador = $3, 
                    cantidad_columnas = $4, 
                    incluye_secciones = $5,
                    esFormatoJson = $6
                WHERE id = $7`,
                [
                    parserData.nombre,
                    parserData.tieneDelimitador || false,
                    parserData.delimitador,
                    parserData.incluyeSecciones ? 0 : parserData.columnas?.length || 0,
                    parserData.incluyeSecciones || false,
                    parserData.esFormatoJson || false,
                    id
                ]
            );

            if (parserData.incluyeSecciones) {
                // Validar que existan secciones
                if (!Array.isArray(parserData.secciones)) {
                    throw new Error('No se proporcionaron secciones válidas');
                }

                // Eliminar columnas de secciones primero
                await client.query(
                    'DELETE FROM columnas_seccion WHERE seccion_id IN (SELECT id FROM secciones WHERE parseador_id = $1)', 
                    [id]
                );
                
                // Luego eliminar las secciones
                await client.query('DELETE FROM secciones WHERE parseador_id = $1', [id]);

                // Insertar secciones actualizadas
                for (let index = 0; index < parserData.secciones.length; index++) {
                    const seccion = parserData.secciones[index];
                    
                    if (!seccion.columnas || !Array.isArray(seccion.columnas)) {
                        throw new Error(`La sección ${seccion.nombre} no tiene columnas válidas`);
                    }

                    const seccionResult = await client.query(
                        `INSERT INTO secciones (
                            parseador_id,
                            nombre,
                            header,
                            tiene_delimitador,
                            delimitador,
                            cantidad_columnas,
                            orden
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                        RETURNING id`,
                        [
                            id,
                            seccion.nombre,
                            seccion.header,
                            seccion.tieneDelimitador || false,
                            seccion.delimitador,
                            seccion.columnas.length,
                            index
                        ]
                    );

                    const seccionId = seccionResult.rows[0].id;

                    // Insertar columnas de la sección
                    for (let colIndex = 0; colIndex < seccion.columnas.length; colIndex++) {
                        const columna = seccion.columnas[colIndex];
                        await client.query(
                            `INSERT INTO columnas_seccion (
                                seccion_id,
                                nombre,
                                cantidad_caracteres,
                                orden
                            ) VALUES ($1, $2, $3, $4)`,
                            [seccionId, columna.nombre, columna.caracteres, colIndex]
                        );
                    }
                }
            } else {
                // Actualizar columnas para parseador simple
                // Primero eliminar todas las columnas existentes
                await client.query('DELETE FROM columnas_parseador WHERE parseador_id = $1', [id]);
                
                // Validar que existan columnas
                if (!Array.isArray(parserData.columnas)) {
                    throw new Error('No se proporcionaron columnas válidas');
                }
                
                // Insertar todas las columnas nuevas
                for (let index = 0; index < parserData.columnas.length; index++) {
                    const columna = parserData.columnas[index];
                    
                    if (!columna || typeof columna.nombre === 'undefined') {
                        throw new Error(`Columna ${index + 1} no tiene los datos requeridos`);
                    }

                    await client.query(
                        `INSERT INTO columnas_parseador (
                            parseador_id,
                            nombre,
                            cantidad_caracteres,
                            orden
                        ) VALUES ($1, $2, $3, $4)`,
                        [id, columna.nombre, columna.caracteres, index]
                    );
                }
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Métodos auxiliares
    static async getColumnasByParserId(parserId) {
        try {
            const result = await pool.query(
                `SELECT 
                    id,
                    nombre,
                    cantidad_caracteres as caracteres,
                    orden
                 FROM columnas_parseador 
                 WHERE parseador_id = $1
                 ORDER BY orden`,
                [parserId]
            );

            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    static async getSeccionesByParserId(parserId) {
        try {
            const result = await pool.query(
                `SELECT 
                    id,
                    parseador_id,
                    nombre,
                    header,
                    tiene_delimitador,
                    delimitador,
                    cantidad_columnas,
                    orden
                 FROM secciones 
                 WHERE parseador_id = $1
                 ORDER BY orden`,
                [parserId]
            );

            const secciones = result.rows;

            // Obtener columnas para cada sección
            const seccionesConColumnas = await Promise.all(secciones.map(async seccion => {
                const columnas = await this.getColumnasBySeccionId(seccion.id);
                
                return {
                    id: seccion.id,
                    nombre: seccion.nombre,
                    header: seccion.header,
                    tieneDelimitador: seccion.tiene_delimitador,
                    delimitador: seccion.delimitador,
                    cantidadColumnas: seccion.cantidad_columnas,
                    orden: seccion.orden,
                    columnas: columnas.map(col => ({
                        id: col.id,
                        nombre: col.nombre,
                        caracteres: col.caracteres,
                        orden: col.orden
                    }))
                };
            }));

            return seccionesConColumnas;
        } catch (error) {
            throw error;
        }
    }

    static async getColumnasBySeccionId(seccionId) {
        try {
            const result = await pool.query(
                `SELECT 
                    id,
                    nombre,
                    cantidad_caracteres as caracteres,
                    orden
                 FROM columnas_seccion 
                 WHERE seccion_id = $1
                 ORDER BY orden`,
                [seccionId]
            );

            return result.rows;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = ParserDB;
