/**
 * Componente principal Alpine.js para la aplicación Parseador
 * Este archivo contiene toda la lógica de negocio de la aplicación
 */

document.addEventListener('alpine:init', () => {
    Alpine.data('parseadorApp', () => ({
        init() {
            // Los parsers se inicializan desde el servidor vía variable global
            this.parsers = window.INITIAL_PARSERS || [];
            this.activeTab = Object.keys(this.groupedData)?.[0] || 'sec1';
            this.activeEditTab = 0;
            this.esFormatoJson = false;

            // Sincronizar la barra de resultados con la tabla (que se renderiza fuera de Alpine)
            document.addEventListener('table-rendered', (e) => {
                this.resultCount = e.detail.rows;
                this.renderedRows = e.detail.renderedRows;
                this.tableColumns = e.detail.columns;
                if (this.viewMode === 'json') {
                    window.renderJsonView(document.getElementById('jsonViewContainer'));
                }
            });
            document.addEventListener('table-rows-appended', (e) => {
                this.renderedRows = e.detail.renderedRows;
            });
            document.addEventListener('columns-visibility-changed', (e) => {
                this.hiddenColumnKeys = e.detail.hidden;
            });

            // Configurar detección de scroll para el panel principal
            setTimeout(() => {
                if (typeof setupMainPanelScrollDetection !== 'undefined') {
                    setupMainPanelScrollDetection();
                }
            }, 100);
            
        },
        showModal: false,
        showEditModal: false,
        showSeccionesForm: false,
        selectedParser: null,
        editingData: null,
        // Columna después de la cual insertar una nueva en el modal de edición
        selectedColumnIndex: '',
        activeEditTab: 0,
        manualInput: '',
        selectedFile: null,
        fileContent: null,
        parsers: [],
        activeTab: 'sec1',
        groupedData: {},
        esFormatoJson: false,
        columns: [],
        draggedItem: null,
        draggedIndex: null,
        tableData: [],
        sortColumn: null,
        sortDirection: 'asc',
        sidebarCollapsed: false,
        saving: false,
        isParsing: false,
        inputCollapsed: false,
        // Aviso sobre el contenido cargado (ej. mensajes extraídos de un log)
        inputAviso: '',
        // Barra de resultados
        viewMode: 'tabla',
        resultCount: 0,
        renderedRows: 0,
        tableColumns: [],
        hiddenColumnKeys: [],
        columnsMenuOpen: false,
        columnsFilter: '',
        copiadoTodo: false,

        // Opciones de visualización de la tabla según el parseador seleccionado
        tableOptions() {
            const parser = this.selectedParser || {};
            return { esFormatoJson: Boolean(parser.esFormatoJson ?? parser.esformatojson) };
        },

        renderTable(data, columns) {
            if (!window.updateTable) return;
            const sortState = {
                sortColumn: this.sortColumn,
                sortDirection: this.sortDirection
            };
            window.updateTable(Alpine.raw(data), Alpine.raw(columns), (colName) => this.sortTable(colName), null, sortState, this.tableOptions());
        },

        setViewMode(modo) {
            this.viewMode = modo;
            this.columnsMenuOpen = false;
            if (modo === 'json') {
                window.renderJsonView(document.getElementById('jsonViewContainer'));
            }
        },

        mostrarTodasLasColumnas() {
            window.setHiddenColumns([]);
        },

        ocultarColumnasVacias() {
            window.setHiddenColumns([...new Set([...this.hiddenColumnKeys, ...window.getEmptyColumnKeys()])]);
        },

        async copiarTodoJson() {
            await navigator.clipboard.writeText(window.getTableJson());
            this.copiadoTodo = true;
            setTimeout(() => { this.copiadoTodo = false; }, 1200);
        },

        async actualizarParsers() {
            const parsers = await window.parserManagement?.actualizarParsers();
            if (parsers) {
                this.parsers = parsers;
                return true;
            }
            return false;
        },

        async eliminarParser(event, parserId) {
            event.preventDefault();
            event.stopPropagation();

            const success = await window.parserManagement?.eliminarParser(parserId);
            if (success) {
                // Cerrar el modal de edición
                this.showEditModal = false;
                this.editingData = null;
                
                // Limpiar el parser seleccionado si es el que se eliminó
                if (this.selectedParser?.id === parserId) {
                    this.selectedParser = null;
                }
                
                // Refrescar la página para actualizar la lista
                window.location.reload();
            }
        },

        async crearParser(formData) {
            const success = await window.parserManagement?.crearParser(formData);
            if (success) {
                this.showModal = false;
                await this.actualizarParsers();
            }
        },

        async handleFileSelect(event) {
            const result = await window.fileHandling?.handleFileSelect(event);
            // Permitir volver a elegir el mismo archivo (si no, el change no se dispara)
            event.target.value = '';
            this.inputAviso = '';
            if (result) {
                this.selectedFile = {
                    name: result.name,
                    file: result.file
                };
                this.manualInput = this.extraerMensajesDeLog(result.content || '', result.name);
            } else {
                this.selectedFile = null;
                this.manualInput = '';
            }
        },

        esParserBase64() {
            const parser = this.selectedParser || {};
            return Boolean(parser.codificacionBase64 ?? parser.codificacion_base64);
        },

        /**
         * Para parseadores con entrada Base64 (ej. Databox): si el contenido es un log
         * del REST proxy de Kafka, se queda solo con los mensajes, uno por línea.
         * Se hace en el navegador para no enviar el log completo al servidor.
         */
        extraerMensajesDeLog(texto, origen) {
            if (!this.esParserBase64() || !window.kafkaLog?.esLogKafka(texto)) {
                return texto;
            }

            const { mensajes, duplicados } = window.kafkaLog.extraerMensajesKafka(texto);
            if (mensajes.length === 0) {
                this.inputAviso = 'El log no contiene mensajes en las respuestas de Kafka';
                return texto;
            }

            const cantidad = mensajes.length === 1 ? '1 mensaje' : `${mensajes.length} mensajes`;
            this.inputAviso = `Se extrajeron ${cantidad} ${origen ? `de "${origen}"` : 'del log'}` +
                (duplicados ? ` (${duplicados} repetido${duplicados === 1 ? '' : 's'} omitido${duplicados === 1 ? '' : 's'})` : '');
            return mensajes.join('\n');
        },

        async parsearContenido() {
            try {
                // Activar indicador de carga
                this.isParsing = true;
                
                // Contraer el panel lateral al parsear
                this.sidebarCollapsed = true;

                // Si se pegó un log de Kafka en un parseador Base64, quedarse con los mensajes
                this.manualInput = this.extraerMensajesDeLog(this.manualInput);

                const response = await fetch('/parse/manual', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        parserId: this.selectedParser.id,
                        text: this.manualInput
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Error al parsear el contenido');
                }

                if (!result.success) {
                    throw new Error(result.error || 'Error al parsear el contenido');
                }

                if (result.aviso) {
                    this.inputAviso = result.aviso;
                }

                if (result.porSeccion) {
                    // Manejar datos agrupados por sección
                    this.groupedData = result.secciones;
                    // Establecer la primera sección como activa
                    this.activeTab = Object.keys(result.secciones)[0];
                    
                    // Actualizar la tabla con los datos de la primera sección
                    const primeraSeccion = result.secciones[this.activeTab];
                    this.columns = primeraSeccion.columnas;
                    this.tableData = primeraSeccion.datos; // Actualizar tableData
                    this.updateTableWithSections(result.secciones);
                } else {
                    // Manejar datos sin secciones (caso anterior)
                    this.groupedData = result.data;
                    this.columns = result.columns;
                    this.tableData = result.data; // Actualizar tableData
                    this.renderTable(result.data, result.columns);
                }
                
            } catch (error) {
                console.error('Error al parsear:', error);
                alert(error.message);
            } finally {
                // Desactivar indicador de carga
                this.isParsing = false;
            }
        },

        updateTableWithSections(secciones) {
            // Eliminar pestañas existentes si las hay (evitar duplicación)
            const existingTabs = document.querySelector('.section-tabs-container');
            if (existingTabs) {
                existingTabs.remove();
            }

            // Crear pestañas para cada sección
            const tabsContainer = document.createElement('div');
            tabsContainer.className = 'section-tabs-container flex border-b border-gray-200 mb-4';
            
            Object.keys(secciones).forEach(seccionNombre => {
                const tab = document.createElement('button');
                tab.className = `px-4 py-2 text-sm font-medium ${this.activeTab === seccionNombre ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`;
                tab.textContent = `Sección ${seccionNombre}`;
                tab.dataset.sectionName = seccionNombre;
                tab.onclick = () => {
                    this.activeTab = seccionNombre;
                    this.columns = secciones[seccionNombre].columnas;
                    this.tableData = secciones[seccionNombre].datos; // Actualizar tableData
                    this.renderTable(secciones[seccionNombre].datos, this.columns);
                    
                    // Actualizar estilos de las pestañas
                    tabsContainer.querySelectorAll('button').forEach(btn => {
                        if (btn.dataset.sectionName === seccionNombre) {
                            btn.className = 'px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600';
                        } else {
                            btn.className = 'px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700';
                        }
                    });
                };
                tabsContainer.appendChild(tab);
            });

            // Insertar las pestañas antes de la tabla
            const tableWrapper = document.querySelector('#tableScrollContainer')?.parentElement;
            if (tableWrapper) {
                tableWrapper.insertBefore(tabsContainer, tableWrapper.firstChild);
            }

            // Mostrar los datos de la primera sección
            this.tableData = secciones[this.activeTab].datos; // Actualizar tableData
            this.renderTable(secciones[this.activeTab].datos, this.columns);
        },

        limpiarDatos() {
            // Expandir el panel izquierdo al limpiar
            this.sidebarCollapsed = false;
            
            this.manualInput = '';
            this.selectedFile = null;
            this.inputAviso = '';
            this.groupedData = {};
            this.columns = [];
            this.activeTab = null;
            
            // Limpiar pestañas si existen
            const tabsContainer = document.querySelector('.section-tabs-container');
            if (tabsContainer) {
                tabsContainer.remove();
            }
            
            this.tableData = [];
            this.resultCount = 0;
            this.tableColumns = [];
            this.columnsMenuOpen = false;
            if (window.clearTable) {
                window.clearTable();
            }
        },

        async exportarXLS() {
            if (window.fileHandling) {
                await window.fileHandling.exportarXLS(this.groupedData, this.columns, this.selectedParser?.nombre || 'datos');
            }
        },

        setActiveTab(tab) {
            this.activeTab = tab;
        },

        initSeccion(index) {
            if (!this.seccionesData[index]) {
                this.seccionesData[index] = {
                    cantidadColumnas: 0,
                    tieneDelimitador: false,
                    caracteres: {}
                };
            }
            return this.seccionesData[index];
        },

        async editarParser(event, parserId) {
            event.preventDefault();
            event.stopPropagation();
            
            const parserData = await window.parserManagement?.editarParser(parserId);
            if (parserData) {
                this.editingData = { 
                    ...parserData,
                    selectedColumnIndex: ''
                };
                this.showEditModal = true;
            }
        },

        async updateParser(event) {
            event.preventDefault();
            this.saving = true;

            try {
                const success = await window.parserManagement?.updateParser(this.editingData);
                if (success) {
                    const actualizacionExitosa = await this.actualizarParsers();
                    if (actualizacionExitosa) {
                        this.editingData = null;
                        this.activeEditTab = 0;
                        this.showEditModal = false;
                    } else {
                        throw new Error('Error al actualizar la lista de parseadores');
                    }
                }
            } catch (error) {
                console.error('Error en updateParser:', error);
                alert('Error al actualizar parseador: ' + error.message);
            } finally {
                this.saving = false;
            }
        },

        sortTable(columnName) {
            if (!this.tableData || !Array.isArray(this.tableData)) return;
            
            const sortState = {
                sortColumn: this.sortColumn,
                sortDirection: this.sortDirection
            };
            
            if (window.sortTable) {
                // Ordenar sobre los datos planos: recorrer el proxy de Alpine es lento con muchas filas
                window.sortTable(columnName, Alpine.raw(this.tableData), sortState, (sortedData) => {
                    this.tableData = sortedData;
                    this.sortColumn = sortState.sortColumn;
                    this.sortDirection = sortState.sortDirection;
                    this.renderTable(sortedData, this.columns);
                });
            }
        },

        dragStart(e) {
            this.draggedItem = e.target;
            this.draggedIndex = parseInt(e.target.getAttribute('data-index'));
            e.dataTransfer.effectAllowed = 'move';
            e.target.classList.add('opacity-50');
        },

        dragEnd(e) {
            e.preventDefault();
            const dropIndex = parseInt(e.target.closest('[draggable]').getAttribute('data-index'));
            
            if (this.draggedIndex !== null && dropIndex !== null && this.draggedIndex !== dropIndex) {
                // Reordenar las columnas
                const columnas = [...this.editingData.columnas];
                const [movedItem] = columnas.splice(this.draggedIndex, 1);
                columnas.splice(dropIndex, 0, movedItem);
                
                // Actualizar el orden
                this.editingData.columnas = columnas.map((col, index) => ({
                    ...col,
                    orden: index
                }));
            }

            this.draggedItem.classList.remove('opacity-50');
            this.draggedItem = null;
            this.draggedIndex = null;
            
            // Remover clase de hover
            document.querySelectorAll('[draggable]').forEach(el => {
                el.classList.remove('bg-blue-50');
            });
        }
    }));
});

