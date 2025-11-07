class Parser {
    constructor(data) {
        this.id = data.id;
        this.nombre = data.nombre;
        this.tieneDelimitador = data.tiene_delimitador || data.tieneDelimitador;
        this.delimitador = data.delimitador;
        this.cantidadColumnas = data.cantidad_columnas;
        this.incluyeSecciones = data.incluye_secciones || data.incluyeSecciones;
        this.esFormatoJson = data.esFormatoJson || false;
        
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
                columnas: this.columnas
            };
        }
        
        const lineas = text.split('\n').filter(linea => linea.trim());
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
        return lineas.map(linea => {
            const resultado = {};

            if (this.tieneDelimitador) {
                const valores = linea.split(this.delimitador);
                this.columnas.forEach((columna, idx) => {
                    resultado[columna.nombre] = valores[idx]?.trim() || '';
                });
            } else {
                let posicion = 0;
                this.columnas.forEach(columna => {
                    const valor = linea.substr(posicion, columna.cantidad_caracteres);
                    resultado[columna.nombre] = valor ? valor.trim() : '';
                    posicion += columna.cantidad_caracteres;
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
            resultado[columna.nombre] = valores[index]?.trim() || '';
        });
        
        return resultado;
    }

    parsearLineaPorLongitud(linea) {
        const resultado = {};
        let posicion = 0;
        
        this.columnas.forEach(columna => {
            const valor = linea.substr(posicion, columna.cantidad_caracteres);
            resultado[columna.nombre] = valor ? valor.trim() : '';
            posicion += columna.cantidad_caracteres;
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
                    resultado[columna.nombre] = valores[idx]?.trim() || '';
                });
            } else {
                let posicion = 0;
                seccion.columnas.forEach(columna => {
                    const longitud = columna.caracteres || columna.cantidad_caracteres;
                    resultado[columna.nombre] = linea.substr(posicion, longitud).trim();
                    posicion += longitud;
                });
            }

            return resultado;
        });
    }

    procesarJson(contenido) {
        try {
            const jsonData = JSON.parse(contenido);
            const resultados = [];
            const todasLasClaves = new Set();

            const aplanarObjeto = (obj, path = '', resultado = {}) => {
                for (const [key, value] of Object.entries(obj)) {
                    const newPath = path ? `${path}.${key}` : key;
                    
                    if (value && typeof value === 'object' && !Array.isArray(value)) {
                        aplanarObjeto(value, newPath, resultado);
                    } else if (Array.isArray(value)) {
                        value.forEach((item, index) => {
                            if (item && typeof item === 'object') {
                                aplanarObjeto(item, `${newPath}[${index}]`, resultado);
                            } else {
                                resultado[`${newPath}[${index}]`] = item;
                                todasLasClaves.add(`${newPath}[${index}]`);
                            }
                        });
                    } else {
                        resultado[newPath] = value;
                        todasLasClaves.add(newPath);
                    }
                }
                return resultado;
            };

            if (Array.isArray(jsonData)) {
                jsonData.forEach(item => {
                    if (item && typeof item === 'object') {
                        resultados.push(aplanarObjeto(item));
                    }
                });
            } else if (jsonData && typeof jsonData === 'object') {
                resultados.push(aplanarObjeto(jsonData));
            }

            this.columnas = Array.from(todasLasClaves).map(clave => ({
                nombre: clave,
                tipo: 'string'
            }));

            return resultados;
        } catch (error) {
            throw new Error(`Error al procesar JSON: ${error.message}`);
        }
    }
}

module.exports = Parser; 