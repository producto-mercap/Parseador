/**
 * Utilidades para la manipulación de tablas
 * Funciones auxiliares para crear y actualizar tablas dinámicamente
 */


/**
 * Sincroniza la scrollbar superior con la inferior
 * (Función deshabilitada - scrollbar superior eliminada)
 */
function setupTableScrollSync() {
    // Función deshabilitada - la scrollbar superior fue eliminada
    return;
}

/**
 * Inicializa el drag scroll para la tabla
 * Permite arrastrar horizontalmente la tabla con el cursor grab
 */
function inicializarDragScrollTabla() {
    const tableContainer = document.getElementById('tableScrollContainer');
    if (!tableContainer) return;
    
    // Evitar múltiples inicializaciones
    if (tableContainer._dragScrollInitialized) return;
    tableContainer._dragScrollInitialized = true;
    
    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;
    
    // URLs de los cursores - usar estándar primero (funciona en Firefox y Chrome)
    // El CSS ya maneja las imágenes personalizadas, aquí usamos los valores estándar
    const cursorGrabUrl = 'grab';
    const cursorGrabbingUrl = 'grabbing';
    
    // Función para forzar actualización del cursor en Chrome usando imágenes personalizadas
    // Chrome necesita un "refresh" agresivo para renderizar cursores personalizados correctamente
    const forceCursorUpdate = (cursorUrl) => {
        // Aplicar el cursor directamente
        tableContainer.style.cursor = cursorUrl;
        // Forzar reflow para asegurar que el navegador procese el cambio
        void tableContainer.offsetHeight;
    };
    
    // Función para establecer cursor grab (manito abierta)
    const setCursorGrab = () => {
        tableContainer.classList.remove('table-dragging');
        forceCursorUpdate(cursorGrabUrl);
    };
    
    // Función para establecer cursor grabbing (manito cerrada)
    const setCursorGrabbing = () => {
        tableContainer.classList.add('table-dragging');
        forceCursorUpdate(cursorGrabbingUrl);
    };
    
    // Mousedown: iniciar arrastre
    const handleMouseDown = (e) => {
        // No arrastrar si se hace click en elementos interactivos o en modo edición
        // (si no, el preventDefault bloquea el caret/tecleo en contenteditable)
        if (
            e.target.closest('button') ||
            e.target.closest('a') ||
            e.target.closest('input') ||
            e.target.closest('select') ||
            e.target.closest('textarea') ||
            e.target.closest('.edit-row-btn') ||
            e.target.closest('.copy-row-btn') ||
            e.target.closest('[contenteditable="true"]') ||
            e.target.closest('tr.editing')
        ) {
            return;
        }
        
        isDragging = true;
        startX = e.clientX;
        startScrollLeft = tableContainer.scrollLeft;
        
        setCursorGrabbing();
        
        // Prevenir selección de texto
        e.preventDefault();
        
        // Agregar clase al body para prevenir selección global
        document.body.style.userSelect = 'none';
        document.body.style.cursor = cursorGrabbingUrl;
    };
    
    // Mousemove: arrastrar o actualizar cursor
    const handleMouseMove = (e) => {
        if (isDragging) {
            // Modo arrastre: desplazar el scroll
            e.preventDefault();
            const deltaX = e.clientX - startX;
            const scrollAmount = deltaX * 1.5; // Factor de velocidad
            tableContainer.scrollLeft = startScrollLeft - scrollAmount;
        } else {
            // Modo normal: forzar actualización del cursor en cada movimiento
            // Esto es crítico para Chrome - necesita este "refresh" constante
            if (!e.target.closest('button') && 
                !e.target.closest('a') &&
                !e.target.closest('input') &&
                !e.target.closest('select') &&
                !e.target.closest('textarea') &&
                !e.target.closest('.edit-row-btn') &&
                !e.target.closest('.copy-row-btn') &&
                !e.target.closest('[contenteditable="true"]') &&
                !e.target.closest('tr.editing')) {
                // Aplicar inmediatamente sin requestAnimationFrame para mejor responsividad
                tableContainer.style.cursor = cursorGrabUrl;
            }
        }
    };
    
    // Mouseup: finalizar arrastre
    const handleMouseUp = () => {
        if (!isDragging) return;
        
        isDragging = false;
        setCursorGrab();
        
        // Restaurar selección de texto
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    };
    
    // Mouseleave: cancelar arrastre si el mouse sale del elemento
    const handleMouseLeave = () => {
        if (isDragging) {
            isDragging = false;
            setCursorGrab();
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        }
    };
    
    // Mouseenter: forzar actualización del cursor cuando el mouse entra
    // Esto es crítico para Chrome - fuerza el renderizado del cursor al entrar
    const handleMouseEnter = () => {
        if (!isDragging) {
            // Aplicar inmediatamente y también con delay para asegurar que Chrome lo procese
            tableContainer.style.cursor = cursorGrabUrl;
            setTimeout(() => {
                if (!isDragging) {
                    setCursorGrab();
                }
            }, 10);
        }
    };
    
    // Agregar event listeners
    tableContainer.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    tableContainer.addEventListener('mouseleave', handleMouseLeave);
    tableContainer.addEventListener('mouseenter', handleMouseEnter);
}

/**
 * Habilita scroll horizontal con Shift + rueda del mouse
 */
function setupHorizontalWheelScroll() {
    const tableContainer = document.getElementById('tableScrollContainer');
    if (!tableContainer) return;

    tableContainer.addEventListener('wheel', (e) => {
        if (e.shiftKey) {
            e.preventDefault();
            tableContainer.scrollLeft += e.deltaY;
        }
    }, { passive: false });
}

/**
 * Actualiza la tabla con los datos proporcionados
 * @param {Array} data - Array de objetos con los datos de las filas
 * @param {Array} columns - Array de objetos con la configuración de las columnas
 * @param {Function} onSort - Función callback para ordenar (recibe columnName)
 * @param {Object} tableDataRef - Referencia al objeto donde se guardan los datos para ordenamiento
 * @param {Object} sortState - Estado de ordenamiento opcional {sortColumn, sortDirection}
 */
function updateTable(data, columns, onSort, tableDataRef, sortState) {
    if (!data || !Array.isArray(data) || data.length === 0) {
        console.log('No hay datos para mostrar');
        return;
    }

    const table = document.querySelector('.data-table');
    if (!table) {
        console.error('No se encontró la tabla');
        return;
    }

    // Asegurarnos de que thead y tbody existan
    let thead = table.querySelector('thead');
    if (!thead) {
        thead = document.createElement('thead');
        table.appendChild(thead);
    }

    let headerRow = thead.querySelector('tr');
    if (!headerRow) {
        headerRow = document.createElement('tr');
        thead.appendChild(headerRow);
    }

    // Limpiar encabezados existentes
    headerRow.innerHTML = '';

    // Agregar encabezado para los iconos de acción
    const actionsHeader = document.createElement('th');
    actionsHeader.className = 'px-1 py-0.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider';
    actionsHeader.style.width = '80px';
    headerRow.appendChild(actionsHeader);

    // Actualizar encabezados con funcionalidad de ordenamiento
    if (columns && Array.isArray(columns)) {
        columns.forEach(col => {
            const th = document.createElement('th');
            th.className = 'px-1 py-0.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-100 select-none';
            th.dataset.columnName = col.nombre;
            th.innerHTML = `
                <div class="flex items-center gap-2">
                    <span>${col.nombre}</span>
                    <svg class="w-4 h-4 sort-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="display: none;">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                    </svg>
                </div>
            `;
            if (onSort) {
                th.onclick = () => onSort(col.nombre);
            }
            headerRow.appendChild(th);
        });
        
        // Mostrar icono de ordenamiento si hay una columna ordenada
        if (sortState && sortState.sortColumn) {
            const sortedHeader = headerRow.querySelector(`th[data-column-name="${sortState.sortColumn}"]`);
            if (sortedHeader) {
                const icon = sortedHeader.querySelector('.sort-icon');
                if (icon) {
                    icon.style.display = 'block';
                    const path = icon.querySelector('path');
                    if (path) {
                        if (sortState.sortDirection === 'asc') {
                            path.setAttribute('d', 'M5 15l7-7 7 7');
                        } else {
                            path.setAttribute('d', 'M19 9l-7 7-7-7');
                        }
                    }
                }
            }
        }
    }

    // Asegurarnos de que tbody exista
    let tbody = table.querySelector('tbody');
    if (!tbody) {
        tbody = document.createElement('tbody');
        table.appendChild(tbody);
    }

    // Limpiar cuerpo de la tabla
    tbody.innerHTML = '';
    
    // Actualizar cuerpo de la tabla
    data.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        tr.dataset.rowIndex = rowIndex;
        
        // Celda para los iconos de acción
        const actionsTd = document.createElement('td');
        actionsTd.className = 'px-1 py-0.5 whitespace-nowrap';
        actionsTd.style.width = '80px';
        
        // Contenedor para los botones
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'flex gap-2';
        
        // Botón de editar
        const editButton = document.createElement('button');
        editButton.className = 'edit-row-btn p-1 text-gray-400 hover:text-orange-600 transition-colors';
        editButton.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
        `;
        editButton.title = 'Modificar datos';
        editButton.onclick = (e) => {
            e.stopPropagation();
            const isEditing = tr.classList.contains('editing');
            
            if (!isEditing) {
                tr.classList.add('editing');
                editButton.classList.remove('text-gray-400', 'hover:text-orange-600');
                editButton.classList.add('text-orange-600');
                editButton.title = 'Guardar cambios';
                
                tr.querySelectorAll('td:not(:first-child)').forEach(td => {
                    td.contentEditable = 'true';
                    td.classList.add('bg-yellow-50', 'border', 'border-orange-300', 'rounded', 'px-2', 'py-1');
                    td.style.outline = 'none';
                });
            } else {
                tr.classList.remove('editing');
                editButton.classList.remove('text-orange-600');
                editButton.classList.add('text-gray-400', 'hover:text-orange-600');
                editButton.title = 'Modificar datos';
                
                tr.querySelectorAll('td:not(:first-child)').forEach((td, index) => {
                    const col = columns[index];
                    if (col) {
                        const claveUnica = col.id ? `col_${col.id}` : col.nombre;
                        row[claveUnica] = td.textContent || '';
                        if (claveUnica !== col.nombre) {
                            row[col.nombre] = td.textContent || '';
                        }
                    }
                    td.contentEditable = 'false';
                    td.classList.remove('bg-yellow-50', 'border', 'border-orange-300', 'rounded', 'px-2', 'py-1');
                });
                
                editButton.classList.add('text-green-600');
                setTimeout(() => {
                    editButton.classList.remove('text-green-600');
                }, 1000);
            }
        };
        
        // Botón de copiar
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-row-btn p-1 text-gray-400 hover:text-blue-600 transition-colors';
        copyButton.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
        `;
        copyButton.title = 'Copiar fila';
        copyButton.onclick = (e) => {
            e.stopPropagation();
            const rowData = [];
            tr.querySelectorAll('td:not(:first-child)').forEach((td, index) => {
                const col = columns[index];
                if (col) {
                    const claveUnica = col.id ? `col_${col.id}` : col.nombre;
                    const value = tr.classList.contains('editing') 
                        ? td.textContent || ''
                        : (row[claveUnica] || row[col.nombre] || '');
                    rowData.push(value);
                }
            });
            const textToCopy = rowData.join('');
            navigator.clipboard.writeText(textToCopy).then(() => {
                copyButton.classList.add('text-green-600');
                setTimeout(() => {
                    copyButton.classList.remove('text-green-600');
                }, 1000);
            });
        };
        
        actionsContainer.appendChild(editButton);
        actionsContainer.appendChild(copyButton);
        actionsTd.appendChild(actionsContainer);
        tr.appendChild(actionsTd);
        
        columns.forEach(col => {
            const td = document.createElement('td');
            td.className = 'px-1 py-0.5 whitespace-nowrap text-xs text-gray-500';
            const claveUnica = col.id ? `col_${col.id}` : col.nombre;
            td.textContent = row[claveUnica] || row[col.nombre] || '';
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
    
    // Configurar detección de scroll horizontal (ya no necesario para botones)
    // setupScrollDetection();
    
    // Inicializar funcionalidades de scroll mejoradas
    setTimeout(() => {
        if (window.setupTableScrollSync) setupTableScrollSync();
        if (window.setupHorizontalWheelScroll) setupHorizontalWheelScroll();
        if (window.inicializarDragScrollTabla) inicializarDragScrollTabla();
    }, 100);
    
    // Guardar datos para ordenamiento
    if (tableDataRef) {
        tableDataRef.data = data;
    }
}

/**
 * Ordena los datos de la tabla
 * @param {string} columnName - Nombre de la columna por la que ordenar
 * @param {Array} data - Array de datos a ordenar
 * @param {Object} sortState - Objeto con sortColumn y sortDirection
 * @param {Function} onUpdate - Función callback para actualizar la tabla (recibe sortedData)
 */
function sortTable(columnName, data, sortState, onUpdate) {
    if (!data || !Array.isArray(data)) return;
    
    // Alternar dirección de ordenamiento
    if (!sortState.sortColumn || sortState.sortColumn !== columnName) {
        sortState.sortColumn = columnName;
        sortState.sortDirection = 'asc';
    } else {
        sortState.sortDirection = sortState.sortDirection === 'asc' ? 'desc' : 'asc';
    }
    
    // Ordenar los datos
    const sortedData = [...data].sort((a, b) => {
        const aVal = a[columnName] || a[`col_${columnName}`] || '';
        const bVal = b[columnName] || b[`col_${columnName}`] || '';
        
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return sortState.sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }
        
        const comparison = String(aVal).localeCompare(String(bVal));
        return sortState.sortDirection === 'asc' ? comparison : -comparison;
    });
    
    // Actualizar la tabla
    if (onUpdate) {
        onUpdate(sortedData);
    }
    
    // Actualizar iconos de ordenamiento
    const headers = document.querySelectorAll('.data-table thead th');
    headers.forEach(th => {
        const icon = th.querySelector('.sort-icon');
        if (icon) {
            const thColumnName = th.dataset.columnName || th.textContent.trim();
            if (thColumnName === columnName) {
                // Mostrar icono solo en la columna ordenada
                icon.style.display = 'block';
                // Cambiar el path según la dirección
                const path = icon.querySelector('path');
                if (path) {
                    if (sortState.sortDirection === 'asc') {
                        // Flecha hacia arriba
                        path.setAttribute('d', 'M5 15l7-7 7 7');
                    } else {
                        // Flecha hacia abajo
                        path.setAttribute('d', 'M19 9l-7 7-7-7');
                    }
                }
            } else {
                // Ocultar icono en las demás columnas
                icon.style.display = 'none';
            }
        }
    });
}

/**
 * Configura la detección de scroll horizontal (función simplificada, ya no maneja botones)
 */
function setupScrollDetection() {
    // Esta función se mantiene por compatibilidad pero ya no hace nada relacionado con botones
    // El drag scroll se inicializa desde updateTable
}

// Hacer disponible globalmente
window.updateTable = updateTable;
window.sortTable = sortTable;
window.setupScrollDetection = setupScrollDetection;
window.setupTableScrollSync = setupTableScrollSync;
window.inicializarDragScrollTabla = inicializarDragScrollTabla;
window.setupHorizontalWheelScroll = setupHorizontalWheelScroll;
