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
            if (result) {
                this.selectedFile = {
                    name: result.name,
                    file: result.file
                };
                this.manualInput = result.content || '';
            } else {
                this.selectedFile = null;
                this.manualInput = '';
            }
        },

        async parsearContenido() {
            try {
                // Activar indicador de carga
                this.isParsing = true;
                
                // Contraer el panel lateral al parsear
                this.sidebarCollapsed = true;
                
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
                console.log('Respuesta del servidor:', result);

                if (!response.ok) {
                    throw new Error(result.error || 'Error al parsear el contenido');
                }

                if (!result.success) {
                    throw new Error(result.error || 'Error al parsear el contenido');
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
                    if (window.updateTable) {
                        const sortState = {
                            sortColumn: this.sortColumn,
                            sortDirection: this.sortDirection
                        };
                        window.updateTable(result.data, this.columns, (colName) => this.sortTable(colName), { data: this.tableData }, sortState);
                    }
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
                    if (window.updateTable) {
                        const sortState = {
                            sortColumn: this.sortColumn,
                            sortDirection: this.sortDirection
                        };
                        window.updateTable(secciones[seccionNombre].datos, this.columns, (colName) => this.sortTable(colName), { data: this.tableData }, sortState);
                    }
                    
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
            if (window.updateTable) {
                const sortState = {
                    sortColumn: this.sortColumn,
                    sortDirection: this.sortDirection
                };
                window.updateTable(secciones[this.activeTab].datos, this.columns, (colName) => this.sortTable(colName), { data: this.tableData }, sortState);
            }
        },

        limpiarDatos() {
            // Expandir el panel izquierdo al limpiar
            this.sidebarCollapsed = false;
            
            this.manualInput = '';
            this.selectedFile = null;
            this.groupedData = {};
            this.columns = [];
            this.activeTab = null;
            
            // Limpiar pestañas si existen
            const tabsContainer = document.querySelector('.section-tabs-container');
            if (tabsContainer) {
                tabsContainer.remove();
            }
            
            const table = document.querySelector('.data-table');
            if (table) {
                const thead = table.querySelector('thead');
                const tbody = table.querySelector('tbody');
                if (thead) thead.innerHTML = '';
                if (tbody) tbody.innerHTML = '';
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

        updateTable(data) {
            // Actualizar tableData antes de llamar a updateTable
            this.tableData = data;
            if (window.updateTable) {
                const tableDataRef = { data: this.tableData };
                const sortState = {
                    sortColumn: this.sortColumn,
                    sortDirection: this.sortDirection
                };
                window.updateTable(data, this.columns, (colName) => this.sortTable(colName), tableDataRef, sortState);
                // Sincronizar después de la actualización
                this.tableData = tableDataRef.data;
            }
        },

        sortTable(columnName) {
            if (!this.tableData || !Array.isArray(this.tableData)) return;
            
            const sortState = {
                sortColumn: this.sortColumn,
                sortDirection: this.sortDirection
            };
            
            if (window.sortTable) {
                window.sortTable(columnName, this.tableData, sortState, (sortedData) => {
                    this.tableData = sortedData;
                    this.sortColumn = sortState.sortColumn;
                    this.sortDirection = sortState.sortDirection;
                    this.updateTable(sortedData);
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

