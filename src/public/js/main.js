import * as XLSX from 'xlsx';

document.addEventListener('DOMContentLoaded', function() {
    // Manejador para el formulario de nuevo parseador
    const parserForm = document.getElementById('parserForm');
    if (parserForm) {
        parserForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Obtener los datos del formulario usando Alpine.js
            const formElement = e.target;
            const alpineData = Alpine.evaluate(formElement, '$data');
            
            const parserData = {
                nombre: formElement.nombre.value,
                tieneDelimitador: alpineData.tieneDelimitador,
                delimitador: formElement.delimitador?.value || ';',
                cantidadColumnas: parseInt(alpineData.cantidadColumnas),
                incluyeSecciones: alpineData.incluyeSecciones,
                columnas: [],
                secciones: []
            };

            // Procesar columnas si no incluye secciones
            if (!parserData.incluyeSecciones) {
                for (let i = 0; i < parserData.cantidadColumnas; i++) {
                    const nombreColumna = formElement[`columna_${i}`]?.value?.trim();
                    if (!nombreColumna) {
                        alert(`El nombre de la columna ${i + 1} es requerido`);
                        return;
                    }
                    
                    const caracteres = parserData.tieneDelimitador ? null : 
                                      parseInt(formElement[`caracteres_${i}`]?.value);
                    if (!parserData.tieneDelimitador && !caracteres) {
                        alert(`La cantidad de caracteres de la columna ${i + 1} es requerida`);
                        return;
                    }

                    parserData.columnas.push({
                        nombre: nombreColumna,
                        caracteres: caracteres
                    });
                }
            } else {
                // Procesar secciones
                const cantidadSecciones = parseInt(alpineData.cantidadSecciones);
                if (!cantidadSecciones) {
                    alert('Debe especificar la cantidad de secciones');
                    return;
                }

                for (let i = 0; i < cantidadSecciones; i++) {
                    const nombreSeccion = formElement[`seccion_${i}_nombre`]?.value?.trim();
                    const header = formElement[`seccion_${i}_header`]?.value?.trim();
                    
                    if (!nombreSeccion) {
                        alert(`El nombre de la sección ${i + 1} es requerido`);
                        return;
                    }
                    if (!header) {
                        alert(`El header de la sección ${i + 1} es requerido`);
                        return;
                    }

                    const seccion = {
                        nombre: nombreSeccion,
                        header: header,
                        tieneDelimitador: formElement[`seccion_${i}_tiene_delimitador`]?.checked,
                        delimitador: formElement[`seccion_${i}_delimitador`]?.value || ';',
                        cantidadColumnas: parseInt(formElement[`seccion_${i}_cantidad_columnas`]?.value),
                        columnas: []
                    };

                    for (let j = 0; j < seccion.cantidadColumnas; j++) {
                        const nombreColumna = formElement[`seccion_${i}_columna_${j}`]?.value?.trim();
                        if (!nombreColumna) {
                            alert(`El nombre de la columna ${j + 1} en la sección ${i + 1} es requerido`);
                            return;
                        }

                        const caracteres = seccion.tieneDelimitador ? null :
                                         parseInt(formElement[`seccion_${i}_caracteres_${j}`]?.value);
                        if (!seccion.tieneDelimitador && !caracteres) {
                            alert(`La cantidad de caracteres de la columna ${j + 1} en la sección ${i + 1} es requerida`);
                            return;
                        }

                        seccion.columnas.push({
                            nombre: nombreColumna,
                            caracteres: caracteres
                        });
                    }

                    parserData.secciones.push(seccion);
                }
            }

            try {
                const response = await fetch('/parser', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(parserData)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                
                if (result.success) {
                    // Cerrar el modal
                    Alpine.evaluate(document.body, 'showModal = false');
                    // Recargar la página para mostrar el nuevo parseador
                    window.location.reload();
                } else {
                    alert('Error al crear el parseador: ' + result.error);
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error al crear el parseador: ' + error.message);
            }
        });
    }

    // Manejador para subir y parsear archivo
    const parseForm = document.getElementById('parseForm');
    if (parseForm) {
        parseForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            
            try {
                const response = await fetch('/parse', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();
                
                if (result.success) {
                    // Actualizar la tabla con los datos parseados
                    updateTable(result.data);
                } else {
                    alert('Error al parsear el archivo: ' + result.error);
                }
            } catch (error) {
                alert('Error al parsear el archivo: ' + error.message);
            }
        });
    }

    // Agregar al x-data inicial
    Alpine.data('parseadorApp', () => ({
        showModal: false,
        showSeccionesForm: false,
        selectedParser: null,
        manualInput: '',
        selectedFile: null,
        fileContent: null,

        handleFileSelect(event) {
            const file = event.target.files[0];
            if (file) {
                this.selectedFile = file;
                // Vista previa del archivo
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.manualInput = e.target.result;
                };
                reader.readAsText(file);
            }
        },

        async parsearContenido() {
            if (!this.selectedParser) {
                alert('Por favor seleccione un parseador');
                return;
            }

            if (!this.manualInput.trim() && !this.selectedFile) {
                alert('Por favor ingrese texto o seleccione un archivo');
                return;
            }

            try {
                let response;
                if (this.selectedFile) {
                    const formData = new FormData();
                    formData.append('file', this.selectedFile.file);
                    formData.append('parserId', this.selectedParser.id);

                    response = await fetch('/parse', {
                        method: 'POST',
                        body: formData
                    });
                } else {
                    response = await fetch('/parse/manual', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            parserId: this.selectedParser.id,
                            text: this.manualInput
                        })
                    });
                }

                const result = await response.json();
                
                if (result.success) {
                    updateTable(result.data);
                } else {
                    alert('Error al parsear: ' + result.error);
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error al parsear: ' + error.message);
            }
        },

        async exportarXLS() {
            const dataTable = document.querySelector('.data-table');
            if (!dataTable) {
                alert('No hay datos para exportar');
                return;
            }

            try {
                // Crear un nuevo libro de Excel
                const wb = XLSX.utils.book_new();
                
                if (this.selectedParser.incluyeSecciones) {
                    // Agrupar datos por sección
                    const sections = {};
                    const tables = dataTable.querySelectorAll('.overflow-x-auto table');
                    
                    tables.forEach(table => {
                        const sectionName = table.closest('[x-show]').getAttribute('x-show').split("'")[1];
                        const data = [];
                        
                        // Obtener headers
                        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
                        data.push(headers);
                        
                        // Obtener datos
                        table.querySelectorAll('tbody tr').forEach(tr => {
                            const row = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
                            data.push(row);
                        });
                        
                        sections[sectionName] = data;
                    });
                    
                    // Crear una hoja para cada sección
                    Object.entries(sections).forEach(([sectionName, data]) => {
                        const ws = XLSX.utils.aoa_to_sheet(data);
                        XLSX.utils.book_append_sheet(wb, ws, sectionName);
                    });
                } else {
                    // Para parseador simple, crear una sola hoja
                    const table = dataTable.querySelector('table');
                    const data = [];
                    
                    // Obtener headers
                    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
                    data.push(headers);
                    
                    // Obtener datos
                    table.querySelectorAll('tbody tr').forEach(tr => {
                        const row = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
                        data.push(row);
                    });
                    
                    const ws = XLSX.utils.aoa_to_sheet(data);
                    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
                }
                
                // Generar el archivo y descargarlo
                const fileName = `${this.selectedParser.nombre}_${new Date().toISOString().split('T')[0]}.xlsx`;
                XLSX.writeFile(wb, fileName);
                
            } catch (error) {
                console.error('Error al exportar a Excel:', error);
                alert('Error al exportar a Excel: ' + error.message);
            }
        }
    }));
});

// Actualizar la función updateTable para mostrar mejor los resultados
function updateTable(data) {
    const table = document.querySelector('.data-table');
    if (!table) return;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
        table.innerHTML = '<p class="text-gray-500 text-center py-4">No hay datos para mostrar</p>';
        return;
    }

    // Agrupar datos por sección
    const groupedData = data.reduce((acc, row) => {
        const section = row.seccion || 'default';
        if (!acc[section]) acc[section] = [];
        acc[section].push(row);
        return acc;
    }, {});

    const sections = Object.keys(groupedData);
    const firstSection = sections[0];

    // Actualizar el HTML
    table.innerHTML = `
        <div x-data="{ activeTab: '${firstSection}' }">
            <div class="border-b border-gray-200">
                <nav class="flex -mb-px">
                    ${sections.map(section => `
                        <button 
                            @click="activeTab = '${section}'"
                            :class="{
                                'border-b-2 border-blue-500 text-blue-600': activeTab === '${section}',
                                'text-gray-500 hover:text-gray-700': activeTab !== '${section}'
                            }"
                            class="px-4 py-2 font-medium text-sm focus:outline-none">
                            ${section}
                        </button>
                    `).join('')}
                </nav>
            </div>

            ${Object.entries(groupedData).map(([section, rows]) => `
                <div x-show="activeTab === '${section}'" class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                ${Object.keys(rows[0])
                                    .filter(key => key !== 'seccion')
                                    .map(key => `
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            ${key}
                                        </th>
                                    `).join('')}
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${rows.map(row => `
                                <tr>
                                    ${Object.entries(row)
                                        .filter(([key]) => key !== 'seccion')
                                        .map(([_, value]) => `
                                            <td class="px-4 py-2 text-sm text-gray-900">
                                                ${value || ''}
                                            </td>
                                        `).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `).join('')}
        </div>
    `;
}

// Función para editar parseador
async function editarParser(event, parserId) {
    event.preventDefault();
    event.stopPropagation();

    try {
        const response = await fetch(`/parser/${parserId}`);
        const data = await response.json();
        
        if (data.success) {
            // Mostrar modal y llenar formulario
            const modal = document.getElementById('editModal');
            fillEditForm(data.parser);
            modal.style.display = 'flex';
        }
    } catch (error) {
        console.error('Error al cargar parseador:', error);
        alert('Error al cargar parseador: ' + error.message);
    }
}

// Función para actualizar parseador
async function updateParser(event) {
    event.preventDefault();
    
    const form = event.target;
    const parserId = form.dataset.parserId;
    const formData = new FormData(form);
    
    try {
        const response = await fetch(`/parser/${parserId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(Object.fromEntries(formData))
        });
        
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('editModal').style.display = 'none';
            window.location.reload();
        }
    } catch (error) {
        console.error('Error al actualizar parseador:', error);
        alert('Error al actualizar parseador: ' + error.message);
    }
}

// Función auxiliar para llenar el formulario de edición
function fillEditForm(parser) {
    const form = document.getElementById('editParserForm');
    form.dataset.parserId = parser.id;
    
    // Llenar campos básicos
    form.querySelector('[name="nombre"]').value = parser.nombre;
    form.querySelector('[name="tieneDelimitador"]').checked = parser.tieneDelimitador;
    form.querySelector('[name="delimitador"]').value = parser.delimitador || '';
    
    // Llenar columnas o secciones según corresponda
    if (parser.incluyeSecciones) {
        // Llenar secciones
    } else {
        // Llenar columnas
    }
} 