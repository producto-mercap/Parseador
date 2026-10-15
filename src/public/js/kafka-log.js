/**
 * Extracción de mensajes desde logs del REST proxy de Kafka (ej. rest-http-ws-*.log de Databox).
 *
 * Las respuestas a GET .../records traen un array JSON con registros de la forma
 *   {"topic":"...","key":"...","value":"<base64>","partition":0,"offset":32}
 * Esta función devuelve los "value" (mensajes en Base64) sin duplicados: como el
 * consumer no confirma offsets automáticamente, el mismo registro puede volver
 * en varios polls.
 *
 * Se usa tanto en el navegador (al cargar un archivo) como en el servidor (Parser.js).
 */
(function (global) {
    // Un registro Kafka con su "value"; el JSON de cada respuesta va en una sola línea
    const ARRAY_REGEX = /\[\s*\{[\s\S]*?"value"[\s\S]*\}\s*\]/;
    const VALUE_REGEX = /"value"\s*:\s*"([A-Za-z0-9+/=_-]+)"/g;

    /**
     * Indica si el texto parece un log con registros Kafka (y no mensajes Base64 sueltos)
     */
    function esLogKafka(texto) {
        return typeof texto === 'string' && /"value"\s*:\s*"/.test(texto);
    }

    /**
     * @param {string} texto - Contenido del log
     * @returns {{ mensajes: string[], registros: number, duplicados: number }}
     */
    function extraerMensajesKafka(texto) {
        const vistos = new Set();
        const mensajes = [];
        let registros = 0;
        let duplicados = 0;

        const agregar = (value, clave) => {
            registros++;
            const id = clave || value;
            if (vistos.has(id)) {
                duplicados++;
                return;
            }
            vistos.add(id);
            mensajes.push(value);
        };

        // Los logs pueden venir con saltos de línea \r\n, \n o \r solo
        const lineas = texto.split(/\r\n|\r|\n/);
        for (const linea of lineas) {
            if (linea.indexOf('"value"') === -1) continue;

            const match = linea.match(ARRAY_REGEX);
            let array = null;
            if (match) {
                try {
                    array = JSON.parse(match[0]);
                } catch (e) {
                    array = null;
                }
            }

            if (Array.isArray(array)) {
                array.forEach(registro => {
                    if (!registro || typeof registro.value !== 'string') return;
                    const clave = registro.offset !== undefined
                        ? `${registro.topic}|${registro.partition}|${registro.offset}`
                        : null;
                    agregar(registro.value, clave);
                });
            } else {
                // Línea con formato inesperado: tomar los "value" directamente
                for (const m of linea.matchAll(VALUE_REGEX)) {
                    agregar(m[1], null);
                }
            }
        }

        return { mensajes, registros, duplicados };
    }

    const api = { esLogKafka, extraerMensajesKafka };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        global.kafkaLog = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
