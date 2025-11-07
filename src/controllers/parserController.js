const ParserDB = require('../models/ParserDB');
const Parser = require('../models/Parser');
const multer = require('multer');
const path = require('path');

// Reemplazar por un procesamiento en memoria
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024 // límite de 50MB
    }
});

exports.getIndex = async (req, res) => {
    try {
        const parsers = await ParserDB.getAll();
        res.render('index', {
            parsers: parsers || [],
            data: []
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

function validateParserData(data) {
    if (!data.nombre) {
        throw new Error('El nombre del parseador es requerido');
    }

    if (data.esFormatoJson) {
        // Si es formato JSON, no necesitamos validar columnas ni secciones
        return {
            ...data,
            columnas: [],
            secciones: []
        };
    }

    if (!data.incluyeSecciones) {
        // Validar parseador simple
        if (!Array.isArray(data.columnas) || data.columnas.length === 0) {
            throw new Error('Debe especificar al menos una columna');
        }

        data.columnas.forEach((col, index) => {
            if (!col.nombre) {
                throw new Error(`El nombre de la columna ${index + 1} es requerido`);
            }
            if (!data.tieneDelimitador && !col.caracteres) {
                throw new Error(`La cantidad de caracteres de la columna ${index + 1} es requerida`);
            }
        });
    } else {
        // Validar parseador con secciones
        if (!Array.isArray(data.secciones) || data.secciones.length === 0) {
            throw new Error('Debe especificar al menos una sección');
        }

        data.secciones.forEach((seccion, secIndex) => {
            if (!seccion.nombre) {
                throw new Error(`El nombre de la sección ${secIndex + 1} es requerido`);
            }
            if (!seccion.header) {
                throw new Error(`El header de la sección ${secIndex + 1} es requerido`);
            }
            if (!Array.isArray(seccion.columnas) || seccion.columnas.length === 0) {
                throw new Error(`Debe especificar al menos una columna en la sección ${secIndex + 1}`);
            }

            seccion.columnas.forEach((col, colIndex) => {
                if (!col.nombre) {
                    throw new Error(`El nombre de la columna ${colIndex + 1} en la sección ${secIndex + 1} es requerido`);
                }
                if (!seccion.tieneDelimitador && !col.caracteres) {
                    throw new Error(`La cantidad de caracteres de la columna ${colIndex + 1} en la sección ${secIndex + 1} es requerida`);
                }
            });
        });
    }

    return data;
}

exports.createParser = async (req, res) => {
    try {
        console.log('Datos recibidos en createParser:', req.body);
        
        // Determinar si los datos vienen como JSON o como form-data
        const parserData = req.headers['content-type']?.includes('application/json') 
            ? req.body 
            : processFormData(req.body);
            
        console.log('Datos procesados:', parserData);
        
        // Validar los datos antes de crear el parser
        const validatedData = validateParserData(parserData);
        console.log('Datos validados:', validatedData);
        
        const parser = await ParserDB.create(validatedData);
        console.log('Parser creado:', parser);
        
        res.json({
            success: true,
            parser: parser
        });
    } catch (error) {
        console.error('Error en createParser:', error);
        res.status(400).json({ 
            success: false,
            error: error.message 
        });
    }
};

exports.deleteParser = async (req, res) => {
    try {
        const parserId = req.params.id;
        
        // Verificar que el parseador existe
        const parser = await ParserDB.getById(parserId);
        if (!parser) {
            return res.status(404).json({ 
                success: false, 
                error: 'Parseador no encontrado' 
            });
        }

        // Eliminar el parseador
        await ParserDB.delete(parserId);
        
        res.json({ 
            success: true,
            message: 'Parseador eliminado correctamente'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Error al eliminar el parseador'
        });
    }
};

// Función auxiliar para procesar los datos del formulario
function processFormData(formData) {
    const parser = {
        nombre: formData.nombre,
        tieneDelimitador: formData.tieneDelimitador === 'true',
        delimitador: formData.delimitador,
        cantidadColumnas: parseInt(formData.cantidadColumnas),
        incluyeSecciones: formData.incluyeSecciones === 'true',
        esFormatoJson: formData.esFormatoJson === 'true',
        columnas: [],
        secciones: []
    };

    if (parser.esFormatoJson) {
        // Si es formato JSON, no necesitamos procesar columnas ni secciones
        return parser;
    }

    if (!parser.incluyeSecciones) {
        // Procesar columnas del parseador simple
        for (let i = 0; i < parser.cantidadColumnas; i++) {
            parser.columnas.push({
                nombre: formData[`columna_${i}`],
                caracteres: parser.tieneDelimitador ? null : parseInt(formData[`caracteres_${i}`])
            });
        }
    } else {
        // Procesar secciones y sus columnas
        const cantidadSecciones = parseInt(formData.cantidadSecciones);
        for (let i = 0; i < cantidadSecciones; i++) {
            const seccion = {
                nombre: formData[`seccion_${i}_nombre`],
                header: formData[`seccion_${i}_header`],
                tieneDelimitador: formData[`seccion_${i}_tiene_delimitador`] === 'true',
                delimitador: formData[`seccion_${i}_delimitador`],
                cantidadColumnas: parseInt(formData[`seccion_${i}_cantidad_columnas`]),
                columnas: []
            };

            for (let j = 0; j < seccion.cantidadColumnas; j++) {
                seccion.columnas.push({
                    nombre: formData[`seccion_${i}_columna_${j}`],
                    caracteres: seccion.tieneDelimitador ? null : parseInt(formData[`seccion_${i}_caracteres_${j}`])
                });
            }

            parser.secciones.push(seccion);
        }
    }

    return parser;
}

// Controlador para parseo manual
exports.parseManual = async (req, res) => {
    try {
        const { parserId, text } = req.body;
        console.log('=== parseManual llamado ===');
        console.log('parserId:', parserId);
        console.log('text length:', text?.length);
        
        const parserData = await ParserDB.getById(parserId);
        if (!parserData) {
            console.log('Parser no encontrado');
            return res.status(404).json({ error: 'Parser no encontrado' });
        }

        console.log('Parser encontrado:', parserData.nombre, 'esFormatoJson:', parserData.esFormatoJson);
        const parser = new Parser(parserData);
        const resultado = await parser.parseManual(text);

        console.log('Resultado parseManual:', {
            tieneData: !!resultado.data,
            dataLength: Array.isArray(resultado.data) ? resultado.data.length : 'no es array',
            tieneColumnas: !!resultado.columnas,
            columnasLength: Array.isArray(resultado.columnas) ? resultado.columnas.length : 'no es array',
            porSeccion: resultado.porSeccion
        });

        if (Array.isArray(resultado.data) && resultado.data.length > 0) {
            console.log('Primer elemento de data:', JSON.stringify(resultado.data[0], null, 2));
            console.log('Claves del primer elemento:', Object.keys(resultado.data[0]));
        }

        const response = {
            success: true,
            porSeccion: resultado.porSeccion,
            ...(resultado.porSeccion 
                ? { secciones: resultado.secciones }
                : { 
                    data: Array.isArray(resultado.data) ? resultado.data : [resultado.data],
                    columns: resultado.columnas || []
                }
            )
        };

        console.log('Enviando respuesta:', {
            success: response.success,
            dataLength: Array.isArray(response.data) ? response.data.length : 'no es array',
            columnsLength: Array.isArray(response.columns) ? response.columns.length : 'no es array'
        });

        res.json(response);
    } catch (error) {
        console.error('Error en parseManual:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.parseFile = [upload.single('file'), async (req, res) => {
    try {
        const parserId = req.body.parserId;
        
        const parser = await ParserDB.getById(parserId);
        if (!parser) {
            return res.status(404).json({ success: false, error: 'Parseador no encontrado' });
        }

        if (!req.file) {
            throw new Error('No se subió ningún archivo');
        }

        const fileContent = req.file.buffer.toString('utf-8');
        const parsedData = await parseContent(fileContent, parser);
        
        res.json({
            success: true,
            data: parsedData
        });
    } catch (error) {
        res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
}];

exports.getParser = async (req, res) => {
    try {
        const parser = await ParserDB.getById(req.params.id);
        if (!parser) {
            throw new Error('Parseador no encontrado');
        }
        res.json({ success: true, parser });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.updateParser = async (req, res) => {
    try {
        if (!req.body || !req.params.id) {
            return res.status(400).json({ 
                success: false, 
                error: 'Datos incompletos para la actualización' 
            });
        }

        await ParserDB.update(req.params.id, req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ 
            success: false, 
            error: error.message || 'Error al actualizar el parseador' 
        });
    }
}; 