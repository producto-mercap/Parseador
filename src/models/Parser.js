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
        
        // Configuración del parseador JSON (valores por defecto)
        this.configJson = data.configJson || data.config_json || {
            separador: '.',           // Separador para claves anidadas: '.' o '_'
            arrayPrimitivos: 'expandir', // 'expandir' o 'serializar'
            arrayObjetos: 'normalizar'   // 'normalizar' o 'aplanar'
        };
        
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
        if (this.esFormatoJson) {
            const resultados = this.procesarJson(text);
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
                    
                    posicion += longitud;
                });
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
            const contenidoLimpio = contenido.trim();
            const jsonData = JSON.parse(contenidoLimpio);
            const separador = this.configJson.separador || '.';
            const arrayPrimitivos = this.configJson.arrayPrimitivos || 'expandir';
            const arrayObjetos = this.configJson.arrayObjetos || 'normalizar';

            // Conjunto para almacenar todas las claves encontradas en todos los registros
            const todasLasClaves = new Set();
            const filas = [];

            /**
             * Aplana un objeto anidado en un objeto plano usando el separador configurado
             */
            const aplanarObjeto = (obj, path = '') => {
                if (!obj || typeof obj !== 'object') {
                    return {};
                }

                const resultado = {};

                for (const [key, value] of Object.entries(obj)) {
                    const newPath = path ? `${path}${separador}${key}` : key;

                    // Manejar valores null o undefined
                    if (value === null || value === undefined) {
                        resultado[newPath] = null;
                        todasLasClaves.add(newPath);
                        continue;
                    }

                    // Si es un array
                    if (Array.isArray(value)) {
                        if (value.length === 0) {
                            // Array vacío: serializar o dejar vacío según configuración
                            if (arrayPrimitivos === 'serializar') {
                                resultado[newPath] = JSON.stringify([]);
                            } else {
                                resultado[newPath] = null;
                            }
                            todasLasClaves.add(newPath);
                        } else {
                            // Verificar si el array contiene objetos o primitivos
                            const tieneObjetos = value.some(item => 
                                item && typeof item === 'object' && !Array.isArray(item)
                            );

                            if (tieneObjetos && arrayObjetos === 'normalizar') {
                                // Arrays de objetos: generar múltiples filas (se maneja después)
                                // Por ahora, marcamos que este campo contiene un array de objetos
                                resultado[`${newPath}_is_array`] = true;
                                todasLasClaves.add(`${newPath}_is_array`);
                            } else if (tieneObjetos && arrayObjetos === 'aplanar') {
                                // Arrays de objetos: aplanar cada objeto
                                value.forEach((item, index) => {
                                    if (item && typeof item === 'object' && !Array.isArray(item)) {
                                        const aplanado = aplanarObjeto(item, `${newPath}_${index}`);
                                        Object.assign(resultado, aplanado);
                                    }
                                });
                            } else {
                                // Array de primitivos
                                if (arrayPrimitivos === 'expandir') {
                                    // Expandir en columnas: campo_0, campo_1, etc.
                                    value.forEach((item, index) => {
                                        const columna = `${newPath}_${index}`;
                                        resultado[columna] = item;
                                        todasLasClaves.add(columna);
                                    });
                                } else {
                                    // Serializar el array completo
                                    resultado[newPath] = JSON.stringify(value);
                                    todasLasClaves.add(newPath);
                                }
                            }
                        }
                    }
                    // Si es un objeto anidado (pero no array)
                    else if (typeof value === 'object' && !Array.isArray(value)) {
                        const aplanado = aplanarObjeto(value, newPath);
                        Object.assign(resultado, aplanado);
                    }
                    // Valor primitivo (string, number, boolean)
                    else {
                        resultado[newPath] = value;
                        todasLasClaves.add(newPath);
                    }
                }

                return resultado;
            };

            /**
             * Procesa un array de objetos generando múltiples filas (normalización)
             */
            const procesarArrayObjetos = (array, pathBase = '') => {
                const filasGeneradas = [];
                
                array.forEach((item, arrayIndex) => {
                    if (item && typeof item === 'object' && !Array.isArray(item)) {
                        const fila = aplanarObjeto(item, pathBase);
                        
                        // Agregar índice del array si es necesario
                        if (pathBase) {
                            fila[`${pathBase}_index`] = arrayIndex;
                            todasLasClaves.add(`${pathBase}_index`);
                        }
                        
                        filasGeneradas.push(fila);
                    }
                });
                
                return filasGeneradas;
            };

            /**
             * Procesa un objeto o array principal, manejando arrays de objetos anidados
             */
            const procesarDato = (dato, pathBase = '', objetoPadre = null) => {
                if (Array.isArray(dato)) {
                    // Si es un array en el nivel raíz
                    if (arrayObjetos === 'normalizar') {
                        // Generar múltiples filas (una por cada objeto en el array)
                        const filasArray = procesarArrayObjetos(dato, pathBase);
                        filas.push(...filasArray);
                    } else {
                        // Aplanar: tratar como un solo objeto con índices
                        const fila = {};
                        dato.forEach((item, index) => {
                            if (item && typeof item === 'object' && !Array.isArray(item)) {
                                const aplanado = aplanarObjeto(item, `${pathBase}_${index}`);
                                Object.assign(fila, aplanado);
                            } else {
                                fila[`${pathBase}_${index}`] = item;
                                todasLasClaves.add(`${pathBase}_${index}`);
                            }
                        });
                        if (Object.keys(fila).length > 0) {
                            filas.push(fila);
                        }
                    }
                } else if (dato && typeof dato === 'object') {
                    // Es un objeto - primero aplanar
                    const filaBase = aplanarObjeto(dato, pathBase);
                    
                    // Buscar arrays de objetos que necesiten normalización
                    const arraysParaNormalizar = [];
                    
                    const buscarArraysObjetos = (obj, pathActual = '') => {
                        for (const [key, value] of Object.entries(obj)) {
                            const pathCompleto = pathActual ? `${pathActual}${separador}${key}` : key;
                            
                            if (Array.isArray(value) && value.length > 0) {
                                const tieneObjetos = value.some(item => 
                                    item && typeof item === 'object' && !Array.isArray(item)
                                );
                                
                                if (tieneObjetos && arrayObjetos === 'normalizar') {
                                    arraysParaNormalizar.push({
                                        path: pathCompleto,
                                        array: value
                                    });
                                }
                            } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                                buscarArraysObjetos(value, pathCompleto);
                            }
                        }
                    };
                    
                    buscarArraysObjetos(dato, pathBase);
                    
                    // Si hay arrays de objetos para normalizar, generar múltiples filas
                    if (arraysParaNormalizar.length > 0) {
                        // Usar el primer array encontrado para generar filas
                        const primerArray = arraysParaNormalizar[0];
                        
                        primerArray.array.forEach((itemObj, idx) => {
                            if (itemObj && typeof itemObj === 'object' && !Array.isArray(itemObj)) {
                                const nuevaFila = { ...filaBase };
                                
                                // Eliminar marcadores de arrays
                                Object.keys(nuevaFila).forEach(key => {
                                    if (key.endsWith('_is_array')) {
                                        delete nuevaFila[key];
                                    }
                                });
                                
                                // Agregar campos del objeto del array
                                const aplanadoArray = aplanarObjeto(itemObj, primerArray.path);
                                Object.assign(nuevaFila, aplanadoArray);
                                
                                // Agregar índice
                                nuevaFila[`${primerArray.path}_index`] = idx;
                                todasLasClaves.add(`${primerArray.path}_index`);
                                
                                filas.push(nuevaFila);
                            }
                        });
                    } else {
                        // No hay arrays de objetos, usar la fila base
                        // Eliminar marcadores de arrays si existen
                        Object.keys(filaBase).forEach(key => {
                            if (key.endsWith('_is_array')) {
                                delete filaBase[key];
                            }
                        });
                        filas.push(filaBase);
                    }
                }
            };

            // Procesar según el tipo de dato raíz
            if (Array.isArray(jsonData)) {
                procesarDato(jsonData);
            } else if (jsonData && typeof jsonData === 'object') {
                procesarDato(jsonData);
            }

            // Asegurar que todas las filas tengan las mismas columnas (rellenar con null)
            const columnasOrdenadas = Array.from(todasLasClaves).sort();
            const filasNormalizadas = filas.map(fila => {
                const filaNormalizada = {};
                columnasOrdenadas.forEach(columna => {
                    filaNormalizada[columna] = fila.hasOwnProperty(columna) 
                        ? fila[columna] 
                        : null;
                });
                return filaNormalizada;
            });

            // Si no se generaron filas, crear una fila vacía con todas las columnas
            if (filasNormalizadas.length === 0 && columnasOrdenadas.length > 0) {
                const filaVacia = {};
                columnasOrdenadas.forEach(columna => {
                    filaVacia[columna] = null;
                });
                filasNormalizadas.push(filaVacia);
            }

            // Crear columnas basadas en todas las claves encontradas
            this.columnas = columnasOrdenadas.map(clave => ({
                nombre: clave,
                tipo: 'string'
            }));

            return filasNormalizadas;
        } catch (error) {
            console.error('Error en procesarJson:', error);
            throw new Error(`Error al procesar JSON: ${error.message}`);
        }
    }
}

module.exports = Parser; 