// Función para actualizar la tabla
function updateTable(data) {
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
    actionsHeader.className = 'px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
    actionsHeader.style.width = '64px';
    headerRow.appendChild(actionsHeader);

    // Actualizar encabezados con funcionalidad de ordenamiento
    if (this.columns && Array.isArray(this.columns)) {
        this.columns.forEach(col => {
            const th = document.createElement('th');
            th.className = 'px-3 py-2 text-left text-[11px] leading-tight font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none';
            th.innerHTML = `
                <div class="flex items-center gap-1">
                    <span>${col.nombre}</span>
                    <svg class="w-3 h-3 flex-shrink-0 sort-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="opacity: 0.5;">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                </div>
            `;
            th.onclick = () => this.sortTable(col.nombre);
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
        actionsTd.className = 'px-2 py-1 whitespace-nowrap';
        actionsTd.style.width = '64px';

        // Contenedor para los botones
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'flex gap-2';

        // Botón de editar
        const editButton = document.createElement('button');
        editButton.className = 'edit-row-btn p-1 text-gray-400 hover:text-orange-600 transition-colors';
        editButton.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
        `;
        editButton.title = 'Modificar datos';
        editButton.onclick = (e) => {
            e.stopPropagation();
            const isEditing = tr.classList.contains('editing');

            if (!isEditing) {
                // Activar modo edición
                tr.classList.add('editing');
                editButton.classList.remove('text-gray-400', 'hover:text-orange-600');
                editButton.classList.add('text-orange-600');
                editButton.title = 'Guardar cambios';

                // Hacer celdas editables
                tr.querySelectorAll('td:not(:first-child)').forEach(td => {
                    td.contentEditable = 'true';
                    td.classList.add('bg-yellow-50', 'border', 'border-orange-300', 'rounded', 'px-2', 'py-1');
                    td.style.outline = 'none';
                });
            } else {
                // Guardar cambios y desactivar modo edición
                tr.classList.remove('editing');
                editButton.classList.remove('text-orange-600');
                editButton.classList.add('text-gray-400', 'hover:text-orange-600');
                editButton.title = 'Modificar datos';

                // Guardar valores editados en el objeto row
                tr.querySelectorAll('td:not(:first-child)').forEach((td, index) => {
                    const col = this.columns[index];
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

                // Feedback visual
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
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
        `;
        copyButton.title = 'Copiar fila';
        copyButton.onclick = (e) => {
            e.stopPropagation();
            const rowData = [];
            tr.querySelectorAll('td:not(:first-child)').forEach((td, index) => {
                const col = this.columns[index];
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

        // Agregar celdas de datos
        this.columns.forEach(col => {
            const td = document.createElement('td');
            td.className = 'px-3 py-2 whitespace-nowrap text-xs text-gray-500';
            const claveUnica = col.id ? `col_${col.id}` : col.nombre;
            td.textContent = row[claveUnica] || row[col.nombre] || '';
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    // Configurar detección de scroll horizontal para el botón de scroll a la izquierda
    setupScrollButton();

    // Guardar datos para ordenamiento
    this.tableData = data;
}

// Función para configurar el botón de scroll
function setupScrollButton() {
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

            // Remover listeners anteriores si existen
            const oldCheckScroll = tableContainer._checkScrollHandler;
            if (oldCheckScroll) {
                tableContainer.removeEventListener('scroll', oldCheckScroll);
            }
            tableContainer._checkScrollHandler = checkScroll;
            tableContainer.addEventListener('scroll', checkScroll);

            // Verificar estado inicial
            checkScroll();
            setTimeout(checkScroll, 500);
        }
    }, 300);
}

// Función para scroll suave al inicio
function scrollToStart() {
    const tableContainer = document.getElementById('tableScrollContainer');
    if (tableContainer) {
        tableContainer.scrollTo({ left: 0, behavior: 'smooth' });
    }
}
