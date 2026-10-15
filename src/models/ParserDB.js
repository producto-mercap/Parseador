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
                    esformatojson,
                    codificacion_base64
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id`,
                [
                    parserData.nombre,
                    parserData.tieneDelimitador || false,
                    parserData.delimitador,
                    parserData.columnas?.length || parserData.cantidadColumnas || 0,
                    parserData.incluyeSecciones || false,
                    Boolean(parserData.esFormatoJson),
                    Boolean(parserData.codificacionBase64)
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

    /**
     * Trae parseadores junto con sus columnas y secciones en UNA sola consulta.
     * Cada ida y vuelta a Neon cuesta ~150 ms, así que evitamos el N+1
     * (antes la carga de la página hacía una consulta por parseador y por sección).
     */
    static async queryParsersConDetalle(where = '', params = []) {
        const result = await pool.query(
            `SELECT p.*,
                COALESCE((
                    SELECT json_agg(json_build_object(
                        'id', c.id,
                        'nombre', c.nombre,
                        'caracteres', c.cantidad_caracteres,
                        'orden', c.orden
                    ) ORDER BY c.orden)
                    FROM columnas_parseador c
                    WHERE c.parseador_id = p.id
                ), '[]'::json) AS columnas_json,
                COALESCE((
                    SELECT json_agg(json_build_object(
                        'id', s.id,
                        'nombre', s.nombre,
                        'header', s.header,
                        'tieneDelimitador', s.tiene_delimitador,
                        'delimitador', s.delimitador,
                        'cantidadColumnas', s.cantidad_columnas,
                        'orden', s.orden,
                        'columnas', COALESCE((
                            SELECT json_agg(json_build_object(
                                'id', cs.id,
                                'nombre', cs.nombre,
                                'caracteres', cs.cantidad_caracteres,
                                'orden', cs.orden
                            ) ORDER BY cs.orden)
                            FROM columnas_seccion cs
                            WHERE cs.seccion_id = s.id
                        ), '[]'::json)
                    ) ORDER BY s.orden)
                    FROM secciones s
                    WHERE s.parseador_id = p.id
                ), '[]'::json) AS secciones_json
             FROM parseadores p
             ${where}
             ORDER BY p.nombre ASC`,
            params
        );

        return result.rows.map(row => {
            const { columnas_json, secciones_json, ...parser } = row;
            if (parser.incluye_secciones) {
                parser.secciones = secciones_json;
            } else {
                parser.columnas = columnas_json;
            }
            return parser;
        });
    }

    static async getAll() {
        return this.queryParsersConDetalle();
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
            parser.esFormatoJson = Boolean(parser.esformatojson);
            parser.codificacionBase64 = Boolean(parser.codificacion_base64);
            
            return parser;
        } catch (error) {
            throw error;
        }
    }

    static async getById(id) {
        const [parser] = await this.queryParsersConDetalle('WHERE p.id = $1', [id]);
        if (!parser) {
            return null;
        }

        // Convertir nombres de columnas
        parser.tieneDelimitador = parser.tiene_delimitador;
        parser.incluyeSecciones = parser.incluye_secciones;
        parser.esFormatoJson = Boolean(parser.esformatojson);
        parser.codificacionBase64 = Boolean(parser.codificacion_base64);

        return parser;
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
                    esformatojson = COALESCE($6, esformatojson),
                    codificacion_base64 = COALESCE($7, codificacion_base64)
                WHERE id = $8`,
                [
                    parserData.nombre,
                    parserData.tieneDelimitador || false,
                    parserData.delimitador,
                    parserData.incluyeSecciones ? 0 : parserData.columnas?.length || 0,
                    parserData.incluyeSecciones || false,
                    // Si el cliente no envía el flag se conserva el valor guardado
                    parserData.esFormatoJson === undefined ? null : Boolean(parserData.esFormatoJson),
                    parserData.codificacionBase64 === undefined ? null : Boolean(parserData.codificacionBase64),
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

                // Insertar secciones actualizadas usando bulk insert
                if (parserData.secciones.length > 0) {
                    // Preparar valores para bulk insert de secciones
                    const seccionesValues = parserData.secciones.map((seccion, index) => [
                        id,
                        seccion.nombre,
                        seccion.header,
                        seccion.tieneDelimitador || false,
                        seccion.delimitador,
                        seccion.columnas?.length || 0,
                        index
                    ]);

                    // Bulk insert de secciones
                    const seccionesPlaceholders = seccionesValues.map((_, idx) => {
                        const base = idx * 7;
                        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
                    }).join(', ');

                    const seccionesFlatValues = seccionesValues.flat();
                    const seccionesResult = await client.query(
                        `INSERT INTO secciones (
                            parseador_id,
                            nombre,
                            header,
                            tiene_delimitador,
                            delimitador,
                            cantidad_columnas,
                            orden
                        ) VALUES ${seccionesPlaceholders}
                        RETURNING id, orden`,
                        seccionesFlatValues
                    );

                    // Preparar valores para bulk insert de columnas de secciones
                    const columnasSeccionValues = [];
                    parserData.secciones.forEach((seccion, seccionIndex) => {
                        if (!seccion.columnas || !Array.isArray(seccion.columnas)) {
                            throw new Error(`La sección ${seccion.nombre} no tiene columnas válidas`);
                        }
                        const seccionId = seccionesResult.rows[seccionIndex].id;
                        seccion.columnas.forEach((columna, colIndex) => {
                            columnasSeccionValues.push([seccionId, columna.nombre, columna.caracteres, colIndex]);
                        });
                    });

                    // Bulk insert de columnas de secciones
                    if (columnasSeccionValues.length > 0) {
                        const columnasPlaceholders = columnasSeccionValues.map((_, idx) => {
                            const base = idx * 4;
                            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
                        }).join(', ');

                        const columnasFlatValues = columnasSeccionValues.flat();
                        await client.query(
                            `INSERT INTO columnas_seccion (
                                seccion_id,
                                nombre,
                                cantidad_caracteres,
                                orden
                            ) VALUES ${columnasPlaceholders}`,
                            columnasFlatValues
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
                
                // Insertar todas las columnas nuevas usando bulk insert
                if (parserData.columnas.length > 0) {
                    // Preparar valores para bulk insert
                    const columnasValues = parserData.columnas.map((columna, index) => {
                        if (!columna || typeof columna.nombre === 'undefined') {
                            throw new Error(`Columna ${index + 1} no tiene los datos requeridos`);
                        }
                        return [id, columna.nombre, columna.caracteres, index];
                    });

                    // Bulk insert
                    const placeholders = columnasValues.map((_, idx) => {
                        const base = idx * 4;
                        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
                    }).join(', ');

                    const flatValues = columnasValues.flat();
                    await client.query(
                        `INSERT INTO columnas_parseador (
                            parseador_id,
                            nombre,
                            cantidad_caracteres,
                            orden
                        ) VALUES ${placeholders}`,
                        flatValues
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
