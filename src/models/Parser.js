class Parser {
    constructor(data) {
        this.id = data.id;
        this.nombre = data.nombre;
        this.tieneDelimitador = data.tiene_delimitador || data.tieneDelimitador;
        this.delimitador = data.delimitador;
        this.cantidadColumnas = data.cantidad_columnas;
        this.incluyeSecciones = data.incluye_secciones || data.incluyeSecciones;
        // PostgreSQL puede retornar el campo en minúsculas o camelCase
        this.esFormatoJson = data.esFormatoJson !== undefined ? data.esFormatoJson : 
                            (data.esformatojson !== undefined ? data.esformatojson : false);
        
        console.log('Parser constructor - esFormatoJson:', this.esFormatoJson, 'data:', {
            esFormatoJson: data.esFormatoJson,
            esformatojson: data.esformatojson
        });
        
        // Asegurarnos que las columnas y secciones se inicializan correctamente
        if (this.incluyeSecciones) {
            this.secciones = data.secciones.map(seccion => ({
                id: seccion.id,
                nombre: seccion.nombre,
                header: seccion.header,
                tieneDelimitador: seccion.tieneDelimitador,
                delimitador: seccion.delimitador,
                cantidadColumnas: seccion.cantidadColumnas,
                orden: seccion.orden,
                columnas: seccion.columnas
            }));
        } else {
            this.columnas = data.columnas || [];
        }
    }

    static getAll() {
        // Por ahora retornamos un array vacío
        // Más adelante podemos implementar persistencia en DB
        return [];
    }

    static create(parserData) {
        const { name, type, config } = parserData;
        return new Parser(parserData);
    }

    async parse(input) {
        // Determinar si el input es un archivo o texto
        const contenido = input.buffer ? input.buffer.toString('utf8') : input;
        
        if (this.esFormatoJson) {
            return this.procesarJson(contenido);
        }
        
        const lineas = contenido.split('\n').filter(linea => linea.trim());
        
        if (this.incluyeSecciones) {
            return this.procesarLineasConSecciones(lineas);
        } else {
            return this.procesarLineasSimple(lineas);
        }
    }

    async parseManual(text) {
        console.log('=== parseManual - Inicio ===');
        console.log('Tipo de texto:', typeof text);
        console.log('Longitud del texto:', text?.length);
        console.log('Primeros 100 caracteres recibidos:', JSON.stringify(text?.substring(0, 100)));
        console.log('Parser tiene delimitador:', this.tieneDelimitador);
        console.log('Parser incluye secciones:', this.incluyeSecciones);
        console.log('Número de columnas:', this.columnas?.length);
        
        if (this.esFormatoJson) {
            const resultados = this.procesarJson(text);
            console.log('Resultados procesarJson:', resultados);
            console.log('Columnas:', this.columnas);
            return {
                data: resultados,
                columnas: this.columnas || []
            };
        }
        
        // Para parseadores sin delimitador, NO debemos filtrar líneas vacías con trim()
        // porque los espacios son parte de los datos. Solo dividir por saltos de línea.
        const lineas = this.tieneDelimitador 
            ? text.split('\n').filter(linea => linea.trim())
            : text.split('\n').filter(linea => linea.length > 0); // Solo eliminar líneas completamente vacías
        
        console.log('Número de líneas después de split:', lineas.length);
        if (lineas.length > 0) {
            console.log('Longitud primera línea:', lineas[0].length);
            console.log('Primeros 100 caracteres primera línea:', JSON.stringify(lineas[0].substring(0, 100)));
        }
        
        let resultados;
        
        if (this.incluyeSecciones) {
            resultados = this.procesarLineasConSecciones(lineas);
            const resultadosPorSeccion = {};
            
            this.secciones.forEach(seccion => {
                resultadosPorSeccion[seccion.nombre] = {
                    datos: [],
                    columnas: seccion.columnas.map(col => ({
                        nombre: col.nombre,
                        tipo: 'string'
                    }))
                };
            });

            resultados.forEach(resultado => {
                const nombreSeccion = resultado.seccion;
                if (resultadosPorSeccion[nombreSeccion]) {
                    const { seccion, header, ...datosLimpios } = resultado;
                    resultadosPorSeccion[nombreSeccion].datos.push(datosLimpios);
                }
            });

            return {
                porSeccion: true,
                secciones: resultadosPorSeccion
            };
        } else {
            resultados = this.procesarLineasSimple(lineas);
            return {
                data: resultados,
                columnas: this.columnas
            };
        }
    }

    procesarLineasSimple(lineas) {
        return lineas.map((linea, lineaIndex) => {
            const resultado = {};

            if (this.tieneDelimitador) {
                const valores = linea.split(this.delimitador);
                this.columnas.forEach((columna, idx) => {
                    // Usar ID de columna como clave única para evitar sobrescritura con nombres duplicados
                    const claveUnica = columna.id ? `col_${columna.id}` : `col_${idx}`;
                    resultado[claveUnica] = valores[idx]?.trim() || '';
                    // También mantener el nombre para compatibilidad (aunque se sobrescriba si hay duplicados)
                    resultado[columna.nombre] = valores[idx]?.trim() || '';
                });
            } else {
                // Para parseadores sin delimitador, NO debemos hacer trim de la línea completa
                // porque los espacios son parte de los datos de posición fija
                console.log(`Procesando línea ${lineaIndex + 1}, longitud: ${linea.length}`);
                console.log(`Primeros 100 caracteres: "${linea.substring(0, 100)}"`);
                console.log(`Caracteres en posiciones clave: 0-3="${linea.substring(0, 4)}", 4="${linea.substring(4, 5)}", 5-7="${linea.substring(5, 8)}"`);
                
                let posicion = 0;
                this.columnas.forEach((columna, colIndex) => {
                    const longitud = columna.caracteres || columna.cantidad_caracteres || 0;
                    
                    // Usar substring en lugar de substr (deprecado)
                    // substring(start, end) donde end es exclusivo
                    const valor = linea.substring(posicion, posicion + longitud);
                    
                    // Usar ID de columna como clave única para evitar sobrescritura con nombres duplicados
                    const claveUnica = columna.id ? `col_${columna.id}` : `col_${colIndex}`;
                    resultado[claveUnica] = valor || '';
                    // También mantener el nombre para compatibilidad (aunque se sobrescriba si hay duplicados)
                    resultado[columna.nombre] = valor || '';
                    
                    console.log(`Columna ${colIndex} (${columna.nombre}, ID: ${columna.id}): pos=${posicion}, long=${longitud}, valor="${valor}"`);
                    
                    posicion += longitud;
                });
                
                console.log(`Total procesado: ${posicion} caracteres de ${linea.length} disponibles`);
                if (posicion < linea.length) {
                    console.log(`ADVERTENCIA: Quedan ${linea.length - posicion} caracteres sin procesar`);
                }
            }

            return resultado;
        });
    }

    procesarLineasConSecciones(lineas) {
        if (!lineas?.length || !this.secciones?.length) {
            return [];
        }

        const resultados = [];
        let seccionActual = null;
        let lineasSeccion = [];

        // Preprocesar las líneas una sola vez
        const lineasLimpias = lineas.map(l => l.trim()).filter(Boolean);

        for (const linea of lineasLimpias) {
            const lineaInicio = linea.substring(0, 2);
            const seccionEncontrada = this.secciones.find(s => lineaInicio === s.header);
            
            if (seccionEncontrada) {
                if (seccionActual && lineasSeccion.length > 0) {
                    resultados.push(...this.procesarDatosSeccion(lineasSeccion, seccionActual));
                }
                seccionActual = seccionEncontrada;
                lineasSeccion = [linea];
            } else if (seccionActual) {
                lineasSeccion.push(linea);
            }
        }

        // Procesar las últimas líneas
        if (seccionActual && lineasSeccion.length > 0) {
            resultados.push(...this.procesarDatosSeccion(lineasSeccion, seccionActual));
        }

        return resultados;
    }

    parsearLineaConDelimitador(linea) {
        const valores = linea.split(this.delimitador);
        
        const resultado = {};
        this.columnas.forEach((columna, index) => {
            // Usar ID de columna como clave única para evitar sobrescritura con nombres duplicados
            const claveUnica = columna.id ? `col_${columna.id}` : `col_${index}`;
            resultado[claveUnica] = valores[index]?.trim() || '';
            // También mantener el nombre para compatibilidad
            resultado[columna.nombre] = valores[index]?.trim() || '';
        });
        
        return resultado;
    }

    parsearLineaPorLongitud(linea) {
        const resultado = {};
        let posicion = 0;
        
        this.columnas.forEach((columna, index) => {
            const longitud = columna.caracteres || columna.cantidad_caracteres || 0;
            // Usar substring en lugar de substr (deprecado)
            const valor = linea.substring(posicion, posicion + longitud);
            // Usar ID de columna como clave única para evitar sobrescritura con nombres duplicados
            const claveUnica = columna.id ? `col_${columna.id}` : `col_${index}`;
            resultado[claveUnica] = valor || '';
            // También mantener el nombre para compatibilidad
            resultado[columna.nombre] = valor || '';
            posicion += longitud;
        });
        
        return resultado;
    }

    procesarDatosSeccion(lineas, seccion) {
        return lineas.map(linea => {
            const resultado = {
                seccion: seccion.nombre,
                header: linea.substring(0, 2)
            };

            if (seccion.tieneDelimitador || seccion.tiene_delimitador) {
                const valores = linea.split(seccion.delimitador || ';');
                seccion.columnas.forEach((columna, idx) => {
                    // Usar ID de columna como clave única para evitar sobrescritura con nombres duplicados
                    const claveUnica = columna.id ? `col_${columna.id}` : `col_${idx}`;
                    resultado[claveUnica] = valores[idx]?.trim() || '';
                    // También mantener el nombre para compatibilidad
                    resultado[columna.nombre] = valores[idx]?.trim() || '';
                });
            } else {
                let posicion = 0;
                seccion.columnas.forEach((columna, idx) => {
                    const longitud = columna.caracteres || columna.cantidad_caracteres || 0;
                    // Usar substring en lugar de substr (deprecado)
                    const valor = linea.substring(posicion, posicion + longitud);
                    // Usar ID de columna como clave única para evitar sobrescritura con nombres duplicados
                    const claveUnica = columna.id ? `col_${columna.id}` : `col_${idx}`;
                    resultado[claveUnica] = valor || '';
                    // También mantener el nombre para compatibilidad
                    resultado[columna.nombre] = valor || '';
                    posicion += longitud;
                });
            }

            return resultado;
        });
    }

    procesarJson(contenido) {
        try {
            // Limpiar el contenido de espacios en blanco al inicio y final
            const contenidoLimpio = contenido.trim();
            const jsonData = JSON.parse(contenidoLimpio);
            const todasLasClaves = new Set();
            const resultadoAplanado = {};

            const aplanarObjeto = (obj, path = '') => {
                // Si no es un objeto válido, retornar
                if (!obj || typeof obj !== 'object') {
                    return;
                }

                // Si es un array, procesar cada elemento
                if (Array.isArray(obj)) {
                    obj.forEach((item, index) => {
                        const newPath = path ? `${path}[${index}]` : `[${index}]`;
                        if (item && typeof item === 'object' && !Array.isArray(item)) {
                            aplanarObjeto(item, newPath);
                        } else {
                            resultadoAplanado[newPath] = item;
                            todasLasClaves.add(newPath);
                        }
                    });
                    return;
                }

                // Procesar objeto normal
                for (const [key, value] of Object.entries(obj)) {
                    const newPath = path ? `${path}.${key}` : key;
                    
                    // Manejar valores null o undefined
                    if (value === null || value === undefined) {
                        resultadoAplanado[newPath] = value;
                        todasLasClaves.add(newPath);
                        continue;
                    }
                    
                    // Si es un objeto anidado (pero no array)
                    if (typeof value === 'object' && !Array.isArray(value)) {
                        aplanarObjeto(value, newPath);
                    } 
                    // Si es un array
                    else if (Array.isArray(value)) {
                        if (value.length === 0) {
                            resultadoAplanado[newPath] = [];
                            todasLasClaves.add(newPath);
                        } else {
                            value.forEach((item, index) => {
                                if (item && typeof item === 'object' && !Array.isArray(item)) {
                                    aplanarObjeto(item, `${newPath}[${index}]`);
                                } else {
                                    resultadoAplanado[`${newPath}[${index}]`] = item;
                                    todasLasClaves.add(`${newPath}[${index}]`);
                                }
                            });
                        }
                    } 
                    // Valor primitivo (string, number, boolean)
                    else {
                        resultadoAplanado[newPath] = value;
                        todasLasClaves.add(newPath);
                    }
                }
            };

            // Procesar según el tipo de dato
            if (Array.isArray(jsonData)) {
                jsonData.forEach((item, index) => {
                    if (item && typeof item === 'object' && !Array.isArray(item)) {
                        aplanarObjeto(item);
                    }
                });
            } else if (jsonData && typeof jsonData === 'object' && !Array.isArray(jsonData)) {
                aplanarObjeto(jsonData);
            }

            // Debug: verificar qué se está creando
            console.log('Resultado aplanado:', resultadoAplanado);
            console.log('Claves encontradas:', Array.from(todasLasClaves));
            console.log('Número de propiedades:', Object.keys(resultadoAplanado).length);

            // Crear columnas basadas en todas las claves encontradas
            this.columnas = Array.from(todasLasClaves)
                .sort()
                .map(clave => ({
                    nombre: clave,
                    tipo: 'string'
                }));

            // Retornar un array con un solo objeto aplanado
            const resultadoFinal = Object.keys(resultadoAplanado).length > 0 ? [resultadoAplanado] : [];
            console.log('Resultado final a retornar:', resultadoFinal);
            console.log('Columnas creadas:', this.columnas.length);
            return resultadoFinal;
        } catch (error) {
            console.error('Error en procesarJson:', error);
            throw new Error(`Error al procesar JSON: ${error.message}`);
        }
    }
}

module.exports = Parser; 