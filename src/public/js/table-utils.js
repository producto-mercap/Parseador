/**
 * Utilidades para la manipulación de tablas
 * Funciones auxiliares para crear y actualizar tablas dinámicamente
 */


/**
 * Sincroniza la scrollbar superior con la inferior
 */
function setupTableScrollSync() {
    const tableContainer = document.getElementById('tableScrollContainer');
    const scrollbarTop = document.getElementById('tableScrollbarTop');
    const scrollbarTopInner = document.getElementById('tableScrollbarTopInner');
    const scrollbarTopContent = document.getElementById('tableScrollbarTopContent');
    
    if (!tableContainer || !scrollbarTop || !scrollbarTopInner || !scrollbarTopContent) {
        return;
    }

    // Sincronizar ancho del contenido
    function syncScrollbarWidth() {
        const table = tableContainer.querySelector('.data-table');
        if (table) {
            scrollbarTopContent.style.width = table.scrollWidth + 'px';
            const hasHorizontalScroll = tableContainer.scrollWidth > tableContainer.clientWidth;
            scrollbarTop.style.display = hasHorizontalScroll ? 'block' : 'none';
        }
    }

    // Sincronizar scroll: inferior -> superior
    tableContainer.addEventListener('scroll', () => {
        scrollbarTopInner.scrollLeft = tableContainer.scrollLeft;
        updateNavButtons();
    });

    // Sincronizar scroll: superior -> inferior
    scrollbarTopInner.addEventListener('scroll', () => {
        tableContainer.scrollLeft = scrollbarTopInner.scrollLeft;
        updateNavButtons();
    });

    // Sincronizar ancho cuando cambia el tamaño de la tabla
    const resizeObserver = new ResizeObserver(() => {
        syncScrollbarWidth();
        updateNavButtons();
    });
    
    resizeObserver.observe(tableContainer);
    
    // Inicializar
    syncScrollbarWidth();
    
    // Re-sincronizar después de actualizar la tabla
    setTimeout(syncScrollbarWidth, 100);
}

/**
 * Actualiza la visibilidad de los botones de navegación
 */
function updateNavButtons() {
    const tableContainer = document.getElementById('tableScrollContainer');
    const scrollLeftBtn = document.getElementById('scrollLeftButton');
    const scrollRightBtn = document.getElementById('scrollRightButton');
    
    if (!tableContainer || !scrollLeftBtn || !scrollRightBtn) {
        return;
    }

    const scrollLeft = tableContainer.scrollLeft;
    const maxScrollLeft = tableContainer.scrollWidth - tableContainer.clientWidth;
    const hasHorizontalScroll = maxScrollLeft > 0;

    if (hasHorizontalScroll) {
        scrollLeftBtn.classList.add('show');
        scrollRightBtn.classList.add('show');
        
        // Ocultar botón izquierdo si está al inicio
        if (scrollLeft <= 5) {
            scrollLeftBtn.classList.remove('show');
        }
        
        // Ocultar botón derecho si está al final
        if (scrollLeft >= maxScrollLeft - 5) {
            scrollRightBtn.classList.remove('show');
        }
    } else {
        scrollLeftBtn.classList.remove('show');
        scrollRightBtn.classList.remove('show');
    }
}

/**
 * Desplaza la tabla horizontalmente
 */
function scrollTableHorizontal(direction) {
    const tableContainer = document.getElementById('tableScrollContainer');
    if (!tableContainer) {
        console.error('No se encontró tableScrollContainer');
        return;
    }
    
    const currentScroll = tableContainer.scrollLeft;
    const containerWidth = tableContainer.clientWidth;
    const scrollWidth = tableContainer.scrollWidth;
    const maxScroll = scrollWidth - containerWidth;
    
    console.log('Scroll info:', {
        currentScroll,
        containerWidth,
        scrollWidth,
        maxScroll,
        direction
    });
    
    if (direction === 'left') {
        // Botón izquierdo: llevar al inicio con un solo click
        tableContainer.scrollLeft = 0;
        
        // Sincronizar con scrollbar superior si existe
        const scrollbarTopInner = document.getElementById('tableScrollbarTopInner');
        if (scrollbarTopInner) {
            scrollbarTopInner.scrollLeft = 0;
        }
    } else {
        // Botón derecho: mover un poco por cada click (incrementos pequeños)
        const scrollAmount = 300; // píxeles a desplazar por click
        const newScroll = Math.min(maxScroll, currentScroll + scrollAmount);
        
        console.log('Desplazando:', {
            scrollAmount,
            currentScroll,
            newScroll,
            maxScroll
        });
        
        tableContainer.scrollLeft = newScroll;
        
        // Sincronizar con scrollbar superior si existe
        const scrollbarTopInner = document.getElementById('tableScrollbarTopInner');
        if (scrollbarTopInner) {
            scrollbarTopInner.scrollLeft = newScroll;
        }
    }
    
    // Actualizar botones después de un pequeño delay
    setTimeout(() => {
        if (window.updateNavButtons) {
            updateNavButtons();
        }
    }, 50);
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
 */
function updateTable(data, columns, onSort, tableDataRef) {
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
    actionsHeader.className = 'px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
    actionsHeader.style.width = '80px';
    headerRow.appendChild(actionsHeader);

    // Actualizar encabezados con funcionalidad de ordenamiento
    if (columns && Array.isArray(columns)) {
        columns.forEach(col => {
            const th = document.createElement('th');
            th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none';
            th.innerHTML = `
                <div class="flex items-center gap-2">
                    <span>${col.nombre}</span>
                    <svg class="w-4 h-4 sort-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="opacity: 0.5;">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                </div>
            `;
            if (onSort) {
                th.onclick = () => onSort(col.nombre);
            }
            headerRow.appendChild(th);
        });
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
        tr.className = 'hover:bg-gray-50 cursor-pointer';
        tr.dataset.rowIndex = rowIndex;
        
        // Celda para los iconos de acción
        const actionsTd = document.createElement('td');
        actionsTd.className = 'px-2 py-4 whitespace-nowrap';
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
            td.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
            const claveUnica = col.id ? `col_${col.id}` : col.nombre;
            td.textContent = row[claveUnica] || row[col.nombre] || '';
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
    
    // Configurar detección de scroll horizontal
    setupScrollDetection();
    
    // Inicializar funcionalidades de scroll mejoradas
    setTimeout(() => {
        if (window.setupTableScrollSync) setupTableScrollSync();
        if (window.setupHorizontalWheelScroll) setupHorizontalWheelScroll();
        if (window.updateNavButtons) updateNavButtons();
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
            if (th.textContent.trim().includes(columnName)) {
                icon.style.opacity = '1';
                icon.style.transform = sortState.sortDirection === 'asc' ? 'rotate(0deg)' : 'rotate(180deg)';
            } else {
                icon.style.opacity = '0.5';
                icon.style.transform = 'rotate(0deg)';
            }
        }
    });
}

/**
 * Configura la detección de scroll horizontal para mostrar el botón de scroll a la izquierda
 */
function setupScrollDetection() {
    setTimeout(() => {
        const tableContainer = document.getElementById('tableScrollContainer') || document.querySelector('.table-container');
        const scrollLeftButton = document.getElementById('scrollLeftButton');
        if (tableContainer && scrollLeftButton) {
            const checkScroll = () => {
                const scrollLeft = tableContainer.scrollLeft;
                if (scrollLeft > 0) {
                    scrollLeftButton.style.display = 'flex';
                    scrollLeftButton.style.opacity = '1';
                    scrollLeftButton.style.pointerEvents = 'auto';
                } else {
                    scrollLeftButton.style.display = 'none';
                    scrollLeftButton.style.opacity = '0';
                    scrollLeftButton.style.pointerEvents = 'none';
                }
            };
            
            const oldCheckScroll = tableContainer._checkScrollHandler;
            if (oldCheckScroll) {
                tableContainer.removeEventListener('scroll', oldCheckScroll);
            }
            tableContainer._checkScrollHandler = checkScroll;
            tableContainer.addEventListener('scroll', checkScroll);
            checkScroll();
            setTimeout(checkScroll, 500);
        }
    }, 300);
}

// Hacer disponible globalmente
window.updateTable = updateTable;
window.sortTable = sortTable;
window.setupScrollDetection = setupScrollDetection;
window.setupTableScrollSync = setupTableScrollSync;
window.updateNavButtons = updateNavButtons;
window.scrollTableHorizontal = scrollTableHorizontal;
window.setupHorizontalWheelScroll = setupHorizontalWheelScroll;
