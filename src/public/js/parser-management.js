/**
 * Módulo para gestión de parsers (crear, editar, eliminar, actualizar)
 */

const parserManagement = {
    async actualizarParsers() {
        console.log('Actualizando lista de parsers');
        try {
            const response = await fetch('/debug/parsers', {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const result = await response.json();
            console.log('Resultado de actualización de parsers:', result);

            if (result.success) {
                return result.parsers;
            } else {
                throw new Error(result.error || 'Error al actualizar la lista de parseadores');
            }
        } catch (error) {
            console.error('Error al actualizar parseadores:', error);
            alert('Error al actualizar la lista de parseadores: ' + error.message);
            return null;
        }
    },

    async eliminarParser(parserId) {
        if (confirm('¿Está seguro de eliminar este parseador?')) {
            try {
                const response = await fetch(`/parser/${parserId}`, {
                    method: 'DELETE'
                });

                const result = await response.json();
                
                if (result.success) {
                    return true;
                } else {
                    alert('Error al eliminar el parseador: ' + result.error);
                    return false;
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error al eliminar el parseador: ' + error.message);
                return false;
            }
        }
        return false;
    },

    async crearParser(formData) {
        const data = {
            nombre: formData.get('nombre'),
            tieneDelimitador: formData.get('tieneDelimitador') === 'on',
            delimitador: formData.get('delimitador'),
            cantidadColumnas: parseInt(formData.get('cantidadColumnas')),
            incluyeSecciones: formData.get('incluyeSecciones') === 'on',
            esFormatoJson: formData.get('esFormatoJson') === 'on',
            columnas: [],
            secciones: []
        };
        
        if (data.esFormatoJson) {
            try {
                const response = await fetch('/parser', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                console.log('Respuesta del servidor:', result);
                
                if (result.success) {
                    return true;
                } else {
                    throw new Error(result.error || 'Error al crear el parseador');
                }
            } catch (error) {
                console.error('Error al crear parseador:', error);
                alert('Error al crear el parseador: ' + error.message);
                return false;
            }
        }
        
        if (!data.incluyeSecciones) {
            for (let i = 0; i < data.cantidadColumnas; i++) {
                data.columnas.push({
                    nombre: formData.get(`columna_${i}`),
                    caracteres: data.tieneDelimitador ? null : parseInt(formData.get(`caracteres_${i}`))
                });
            }
        } else {
            for (let i = 0; i < data.cantidadSecciones; i++) {
                const seccion = {
                    nombre: formData.get(`seccion_${i}_nombre`),
                    header: formData.get(`seccion_${i}_header`),
                    tieneDelimitador: formData.get(`seccion_${i}_tiene_delimitador`) === 'on',
                    delimitador: formData.get(`seccion_${i}_delimitador`) || ';',
                    cantidadColumnas: parseInt(formData.get(`seccion_${i}_cantidad_columnas`)),
                    columnas: []
                };
                
                for (let j = 0; j < seccion.cantidadColumnas; j++) {
                    seccion.columnas.push({
                        nombre: formData.get(`seccion_${i}_columna_${j}`),
                        caracteres: seccion.tieneDelimitador ? null : parseInt(formData.get(`seccion_${i}_caracteres_${j}`))
                    });
                }
                
                data.secciones.push(seccion);
            }
        }
        
        try {
            const response = await fetch('/parser', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            if (result.success) {
                return true;
            } else {
                alert('Error al crear el parseador: ' + result.error);
                return false;
            }
        } catch (error) {
            alert('Error al crear el parseador: ' + error.message);
            return false;
        }
    },

    async editarParser(parserId) {
        console.log('Iniciando edición del parser:', parserId);

        try {
            const response = await fetch(`/parser/${parserId}`, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            console.log('Datos recibidos del parser:', data);
            
            if (data.success) {
                if (!data.parser.incluyeSecciones && Array.isArray(data.parser.columnas)) {
                    data.parser.columnas = data.parser.columnas.map(col => ({
                        ...col,
                        id: col.id || Date.now() + Math.random(),
                        caracteres: col.caracteres || 1
                    }));
                }
                
                if (data.parser.incluyeSecciones && Array.isArray(data.parser.secciones)) {
                    data.parser.secciones = data.parser.secciones.map(seccion => ({
                        ...seccion,
                        selectedColumnIndex: seccion.selectedColumnIndex || ''
                    }));
                }
                
                console.log('Datos procesados para edición:', data.parser);
                return { 
                    ...data.parser,
                    selectedColumnIndex: ''
                };
            } else {
                throw new Error(data.error || 'Error al cargar el parseador');
            }
        } catch (error) {
            console.error('Error al cargar parseador:', error);
            alert('Error al cargar parseador: ' + error.message);
            return null;
        }
    },

    async updateParser(editingData) {
        console.log('Iniciando updateParser');
        
        if (!editingData) {
            console.error('No hay datos para actualizar');
            return false;
        }

        try {
            const datosParaEnviar = {
                id: editingData.id,
                nombre: editingData.nombre,
                delimitador: editingData.delimitador,
                cantidad_columnas: editingData.columnas?.length || 0,
                esFormatoJson: editingData.esFormatoJson ? 1 : 0,
                tieneDelimitador: editingData.tieneDelimitador ? 1 : 0,
                incluyeSecciones: editingData.incluyeSecciones ? 1 : 0,
                columnas: Array.isArray(editingData.columnas) 
                    ? editingData.columnas.map((col, index) => ({
                        id: col.id,
                        nombre: col.nombre?.trim(),
                        caracteres: editingData.tieneDelimitador ? null : (col.caracteres || 1),
                        orden: index
                    }))
                    : [],
                secciones: editingData.incluyeSecciones && Array.isArray(editingData.secciones)
                    ? editingData.secciones.map(seccion => ({
                        nombre: seccion.nombre?.trim(),
                        header: seccion.header?.trim(),
                        tieneDelimitador: seccion.tieneDelimitador ? 1 : 0,
                        delimitador: seccion.delimitador || ';',
                        cantidadColumnas: seccion.columnas?.length || 0,
                        columnas: Array.isArray(seccion.columnas)
                            ? seccion.columnas.map((col, colIndex) => ({
                                nombre: col.nombre?.trim(),
                                caracteres: seccion.tieneDelimitador ? null : (col.caracteres || 1),
                                orden: colIndex
                            }))
                            : []
                    }))
                    : []
            };

            if (!datosParaEnviar.nombre?.trim()) {
                throw new Error('El nombre del parseador es requerido');
            }

            if (!datosParaEnviar.incluyeSecciones && (!Array.isArray(datosParaEnviar.columnas) || datosParaEnviar.columnas.length === 0)) {
                throw new Error('Debe haber al menos una columna');
            }

            const response = await fetch(`/parser/${datosParaEnviar.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                body: JSON.stringify(datosParaEnviar)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const result = await response.json();
            console.log('Respuesta del servidor:', result);

            if (!result.success) {
                throw new Error(result.error || 'Error al actualizar el parseador');
            }

            return true;
        } catch (error) {
            console.error('Error en updateParser:', error);
            alert('Error al actualizar parseador: ' + error.message);
            return false;
        }
    }
};

// Hacer disponible globalmente
window.parserManagement = parserManagement;

