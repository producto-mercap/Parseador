/**
 * Utilidades para la manipulación de tablas
 * Funciones auxiliares para crear y actualizar tablas dinámicamente.
 *
 * La tabla se arma como un único string HTML y los eventos se manejan por
 * delegación sobre la tabla, para que miles de filas se rendericen rápido.
 */

const TABLE_ICONS = {
    edit: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>',
    copy: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><path d="M14.12 14.12a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
    sortAsc: 'M5 15l7-7 7 7',
    sortDesc: 'M19 9l-7 7-7-7'
};

// Correcciones de typos en nombres de columnas (solo afecta la visualización)
const CORRECCIONES_NOMBRE_COLUMNA = {
    'Ofera': 'Oferta'
};

// Render progresivo: con miles de filas el costo está en el layout del navegador,
// así que se dibuja una primera tanda y el resto se agrega al acercarse al final del scroll
const FILAS_INICIALES = 300;
const FILAS_POR_TANDA = 500;

// Estado de la tabla renderizada (lo usan los handlers delegados)
const tableState = {
    data: [],
    columns: [],
    onSort: null,
    options: {},
    renderedRows: 0
};

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getColumnKey(col) {
    return col.id ? `col_${col.id}` : col.nombre;
}

/**
 * Obtiene el valor de una celda sin descartar valores "falsy" válidos (0, false)
 */
function getCellValue(row, col) {
    const clave = getColumnKey(col);
    if (row[clave] !== undefined) return row[clave];
    return row[col.nombre];
}

/**
 * Texto plano de un valor (para copiar, editar y exportar)
 */
function valueToText(value) {
    if (value === undefined) return '';
    if (value === null) return 'null';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

/**
 * HTML y clase de una celda según el tipo del valor
 */
function formatCell(value) {
    if (value === undefined || value === '') {
        return { cls: '', html: '' };
    }
    if (value === null) {
        return { cls: 'cell--null', html: '<span class="cell-null">null</span>' };
    }
    if (typeof value === 'boolean') {
        return {
            cls: 'cell--bool',
            html: `<span class="cell-bool cell-bool--${value}">${value}</span>`
        };
    }
    if (typeof value === 'number') {
        return { cls: 'cell--num', html: escapeHtml(value) };
    }
    return { cls: '', html: escapeHtml(valueToText(value)) };
}

/**
 * Convierte el texto editado al tipo del valor original cuando es posible
 */
function parseEditedValue(text, original) {
    const limpio = text.trim();
    if (original === null && limpio === 'null') return null;
    if (typeof original === 'boolean' && (limpio === 'true' || limpio === 'false')) {
        return limpio === 'true';
    }
    if (typeof original === 'number' && limpio !== '' && !isNaN(Number(limpio))) {
        return Number(limpio);
    }
    return text;
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

    const esElementoInteractivo = (target) => Boolean(
        target.closest('button') ||
        target.closest('a') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('textarea') ||
        target.closest('[contenteditable="true"]') ||
        target.closest('tr.editing')
    );

    const terminarArrastre = () => {
        if (!isDragging) return;
        isDragging = false;
        tableContainer.classList.remove('table-dragging');
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    };

    tableContainer.addEventListener('mousedown', (e) => {
        // No arrastrar si se hace click en elementos interactivos o en modo edición
        // (si no, el preventDefault bloquea el caret/tecleo en contenteditable)
        if (esElementoInteractivo(e.target)) return;

        isDragging = true;
        startX = e.clientX;
        startScrollLeft = tableContainer.scrollLeft;
        tableContainer.classList.add('table-dragging');

        // Prevenir selección de texto mientras se arrastra
        e.preventDefault();
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const deltaX = e.clientX - startX;
        tableContainer.scrollLeft = startScrollLeft - deltaX * 1.5; // Factor de velocidad
    });

    document.addEventListener('mouseup', terminarArrastre);
    tableContainer.addEventListener('mouseleave', terminarArrastre);
}

/**
 * Habilita scroll horizontal con Shift + rueda del mouse
 */
function setupHorizontalWheelScroll() {
    const tableContainer = document.getElementById('tableScrollContainer');
    if (!tableContainer || tableContainer._wheelScrollInitialized) return;
    tableContainer._wheelScrollInitialized = true;

    tableContainer.addEventListener('wheel', (e) => {
        if (e.shiftKey) {
            e.preventDefault();
            tableContainer.scrollLeft += e.deltaY;
        }
    }, { passive: false });
}

function renderHeaderHtml(columns, sortState) {
    const celdas = ['<th class="actions-header"></th>'];

    columns.forEach((col, colIndex) => {
        const nombre = CORRECCIONES_NOMBRE_COLUMNA[col.nombre] || col.nombre;
        const ordenada = sortState && sortState.sortColumn === col.nombre;
        const pathOrden = ordenada && sortState.sortDirection === 'desc' ? TABLE_ICONS.sortDesc : TABLE_ICONS.sortAsc;

        // colIndex + 1 porque la primera columna es la de acciones
        celdas.push(`
            <th class="data-th" data-ci="${colIndex + 1}" data-col-index="${colIndex + 1}"
                data-column-name="${escapeHtml(col.nombre)}" data-column-key="${escapeHtml(getColumnKey(col))}"
                title="Ordenar por ${escapeHtml(nombre)}">
                <div class="th-content">
                    <span class="th-label">${escapeHtml(nombre)}</span>
                    <svg class="w-3 h-3 sort-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="display: ${ordenada ? 'block' : 'none'};">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${pathOrden}" />
                    </svg>
                    <button type="button" class="col-hide-btn" title="Ocultar columna" aria-label="Ocultar columna ${escapeHtml(nombre)}">${TABLE_ICONS.eyeOff}</button>
                </div>
            </th>`);
    });

    return celdas.join('');
}

function renderRowHtml(row, rowIndex, columns) {
    const celdas = [
        `<tr data-row-index="${rowIndex}"><td class="actions-cell"><div class="row-actions">` +
        `<button type="button" class="edit-row-btn" title="Modificar datos" aria-label="Modificar fila">${TABLE_ICONS.edit}</button>` +
        `<button type="button" class="copy-row-btn" title="Copiar fila" aria-label="Copiar fila">${TABLE_ICONS.copy}</button>` +
        `</div></td>`
    ];

    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
        const { cls, html } = formatCell(getCellValue(row, columns[colIndex]));
        celdas.push(`<td class="data-td ${cls}" data-ci="${colIndex + 1}">${html}</td>`);
    }

    celdas.push('</tr>');
    return celdas.join('');
}

/**
 * Actualiza la tabla con los datos proporcionados
 * @param {Array} data - Array de objetos con los datos de las filas
 * @param {Array} columns - Array de objetos con la configuración de las columnas
 * @param {Function} onSort - Función callback para ordenar (recibe columnName)
 * @param {Object} tableDataRef - Referencia al objeto donde se guardan los datos para ordenamiento
 * @param {Object} sortState - Estado de ordenamiento opcional {sortColumn, sortDirection}
 * @param {Object} options - Opciones de visualización ({ esFormatoJson })
 */
function updateTable(data, columns, onSort, tableDataRef, sortState, options = {}) {
    if (!data || !Array.isArray(data) || data.length === 0) {
        console.log('No hay datos para mostrar');
        return;
    }

    const table = document.querySelector('.data-table');
    if (!table) {
        console.error('No se encontró la tabla');
        return;
    }

    const cols = Array.isArray(columns) ? columns : [];
    tableState.data = data;
    tableState.columns = cols;
    tableState.onSort = onSort || null;
    tableState.options = options || {};

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
    let tbody = table.querySelector('tbody');
    if (!tbody) {
        tbody = document.createElement('tbody');
        table.appendChild(tbody);
    }

    headerRow.innerHTML = renderHeaderHtml(cols, sortState);

    tableState.renderedRows = 0;
    tbody.replaceChildren();
    appendRows(tbody, FILAS_INICIALES);

    const container = document.getElementById('tableScrollContainer');
    if (container) {
        container.scrollTop = 0;
        configurarCargaProgresiva(container, tbody);
    }

    configurarEventosTabla(table);

    // Reaplicar el estado de columnas ocultas (persiste entre re-renders y ordenamientos)
    applyHiddenColumns();

    inicializarDragScrollTabla();
    setupHorizontalWheelScroll();

    // Guardar datos para ordenamiento
    if (tableDataRef) {
        tableDataRef.data = data;
    }

    document.dispatchEvent(new CustomEvent('table-rendered', {
        detail: {
            rows: data.length,
            renderedRows: tableState.renderedRows,
            columns: cols.map(col => ({ key: getColumnKey(col), nombre: col.nombre }))
        }
    }));
}

/**
 * Agrega la siguiente tanda de filas al final del tbody
 */
function appendRows(tbody, cantidad) {
    const desde = tableState.renderedRows;
    const hasta = Math.min(desde + cantidad, tableState.data.length);
    if (desde >= hasta) return;

    const filas = new Array(hasta - desde);
    for (let i = desde; i < hasta; i++) {
        filas[i - desde] = renderRowHtml(tableState.data[i], i, tableState.columns);
    }
    tbody.insertAdjacentHTML('beforeend', filas.join(''));
    tableState.renderedRows = hasta;

    document.dispatchEvent(new CustomEvent('table-rows-appended', {
        detail: { renderedRows: hasta, rows: tableState.data.length }
    }));
}

/**
 * Agrega más filas cuando el scroll se acerca al final de la tabla
 */
function configurarCargaProgresiva(container, tbody) {
    if (container._cargaProgresivaInitialized) return;
    container._cargaProgresivaInitialized = true;

    container.addEventListener('scroll', () => {
        if (tableState.renderedRows >= tableState.data.length) return;
        const restante = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (restante < 600) {
            appendRows(tbody, FILAS_POR_TANDA);
        }
    }, { passive: true });
}

/**
 * Dibuja todas las filas pendientes (por ejemplo, para buscar con Ctrl+F)
 */
function renderAllRows() {
    const tbody = document.querySelector('.data-table tbody');
    if (tbody) appendRows(tbody, Infinity);
}

/**
 * Registra (una sola vez) los handlers delegados de la tabla
 */
function configurarEventosTabla(table) {
    if (table._eventsInitialized) return;
    table._eventsInitialized = true;

    table.addEventListener('click', (e) => {
        const hideBtn = e.target.closest('.col-hide-btn');
        if (hideBtn) {
            e.stopPropagation();
            const th = hideBtn.closest('th');
            if (th) toggleColumn(th.dataset.columnKey);
            return;
        }

        const th = e.target.closest('thead th[data-ci]');
        if (th) {
            if (tableState.onSort) tableState.onSort(th.dataset.columnName);
            return;
        }

        const tr = e.target.closest('tbody tr');
        if (!tr) return;

        if (e.target.closest('.edit-row-btn')) {
            e.stopPropagation();
            toggleEditRow(tr, e.target.closest('.edit-row-btn'));
            return;
        }

        if (e.target.closest('.copy-row-btn')) {
            e.stopPropagation();
            copyRow(tr, e.target.closest('.copy-row-btn'));
            return;
        }

        // No seleccionar mientras se edita la fila
        if (e.target.closest('td[data-ci]') && !tr.classList.contains('editing')) {
            selectCell(tr);
        }
    });
}

function flashButton(button, clase) {
    button.classList.add(clase);
    setTimeout(() => button.classList.remove(clase), 1000);
}

function toggleEditRow(tr, editButton) {
    const row = tableState.data[Number(tr.dataset.rowIndex)];
    if (!row) return;
    const celdas = tr.querySelectorAll('td[data-ci]');

    if (!tr.classList.contains('editing')) {
        tr.classList.add('editing');
        editButton.classList.add('is-active');
        editButton.title = 'Guardar cambios';

        celdas.forEach((td, index) => {
            const col = tableState.columns[index];
            td.textContent = col ? valueToText(getCellValue(row, col)) : td.textContent;
            td.contentEditable = 'true';
            td.classList.add('cell-editing');
        });
        return;
    }

    tr.classList.remove('editing');
    editButton.classList.remove('is-active');
    editButton.title = 'Modificar datos';

    celdas.forEach((td, index) => {
        const col = tableState.columns[index];
        td.contentEditable = 'false';
        td.classList.remove('cell-editing');
        if (!col) return;

        const clave = getColumnKey(col);
        const valor = parseEditedValue(td.textContent || '', getCellValue(row, col));
        row[clave] = valor;
        if (clave !== col.nombre) {
            row[col.nombre] = valor;
        }

        const { cls, html } = formatCell(valor);
        td.className = `data-td ${cls}`;
        td.innerHTML = html;
    });

    flashButton(editButton, 'is-success');
}

/**
 * Registro ordenado según las columnas (sin las claves internas col_<id>)
 */
function rowToRecord(row, columns) {
    const registro = {};
    columns.forEach(col => {
        const valor = getCellValue(row, col);
        registro[col.nombre] = valor === undefined ? null : valor;
    });
    return registro;
}

function copyRow(tr, copyButton) {
    const row = tableState.data[Number(tr.dataset.rowIndex)];
    if (!row) return;

    let texto;
    if (tableState.options.esFormatoJson) {
        texto = JSON.stringify(rowToRecord(row, tableState.columns));
    } else {
        // Parseadores de texto: se reconstruye la línea concatenando los valores
        texto = tableState.columns.map(col => {
            const valor = getCellValue(row, col);
            return valor === null || valor === undefined ? '' : valueToText(valor);
        }).join('');
    }

    navigator.clipboard.writeText(texto).then(() => flashButton(copyButton, 'is-success'));
}

/**
 * Conjunto de claves de columnas actualmente ocultas (persiste entre re-renders)
 */
window.hiddenColumns = window.hiddenColumns || new Set();

/**
 * Oculta/muestra una columna por su clave única y persiste el estado
 * @param {string} colKey - Clave única de la columna (data-column-key)
 */
function toggleColumn(colKey) {
    if (window.hiddenColumns.has(colKey)) {
        window.hiddenColumns.delete(colKey);
    } else {
        window.hiddenColumns.add(colKey);
    }
    applyHiddenColumns();
}

/**
 * Reemplaza el conjunto de columnas ocultas
 * @param {Array<string>} colKeys - Claves de las columnas a ocultar
 */
function setHiddenColumns(colKeys) {
    window.hiddenColumns = new Set(colKeys || []);
    applyHiddenColumns();
}

/**
 * Claves de las columnas que no tienen ningún valor en todas las filas
 */
function getEmptyColumnKeys() {
    return tableState.columns
        .filter(col => tableState.data.every(row => {
            const valor = getCellValue(row, col);
            return valor === null || valor === undefined || valor === '';
        }))
        .map(getColumnKey);
}

/**
 * Aplica el estado de columnas ocultas con una única regla CSS por columna,
 * en lugar de recorrer todas las celdas de la tabla
 */
function applyHiddenColumns() {
    let style = document.getElementById('hiddenColumnsStyle');
    if (!style) {
        style = document.createElement('style');
        style.id = 'hiddenColumnsStyle';
        document.head.appendChild(style);
    }

    const ocultas = [];
    const selectores = [];
    tableState.columns.forEach((col, index) => {
        const clave = getColumnKey(col);
        if (window.hiddenColumns.has(clave)) {
            ocultas.push(clave);
            selectores.push(`#tableScrollContainer .data-table [data-ci="${index + 1}"]`);
        }
    });

    style.textContent = selectores.length ? `${selectores.join(',\n')} { display: none; }` : '';

    document.dispatchEvent(new CustomEvent('columns-visibility-changed', {
        detail: { hidden: ocultas, total: tableState.columns.length }
    }));
}

/**
 * Resalta toda la fila de la celda seleccionada.
 * Una sola selección a la vez; volver a hacer click en la misma fila la deselecciona.
 * @param {HTMLElement} tr - Fila de la celda
 */
function selectCell(tr) {
    const table = document.querySelector('.data-table');
    if (!table) return;

    const yaSeleccionada = tr.classList.contains('row-selected');
    table.querySelectorAll('tr.row-selected').forEach(el => el.classList.remove('row-selected'));

    if (!yaSeleccionada) {
        tr.classList.add('row-selected');
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

    const direccion = sortState.sortDirection === 'asc' ? 1 : -1;
    const vacio = (valor) => valor === null || valor === undefined || valor === '';

    const sortedData = [...data].sort((a, b) => {
        const aVal = a[columnName];
        const bVal = b[columnName];

        // Los valores vacíos/null siempre al final
        if (vacio(aVal) || vacio(bVal)) {
            return vacio(aVal) === vacio(bVal) ? 0 : (vacio(aVal) ? 1 : -1);
        }

        const aNum = typeof aVal === 'number' ? aVal : parseFloat(aVal);
        const bNum = typeof bVal === 'number' ? bVal : parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return (aNum - bNum) * direccion;
        }

        return String(aVal).localeCompare(String(bVal)) * direccion;
    });

    if (onUpdate) {
        onUpdate(sortedData);
    }
}

/* ============================================================
   Vista JSON
   ============================================================ */

const JSON_TOKEN_REGEX = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

/**
 * JSON con sangría y resaltado de sintaxis (claves, strings, números, booleanos y null)
 */
function highlightJson(obj) {
    const json = JSON.stringify(obj, null, 2);
    let html = '';
    let ultimo = 0;

    json.replace(JSON_TOKEN_REGEX, (match, _str, esClave, offset) => {
        html += escapeHtml(json.slice(ultimo, offset));
        let clase = 'json-number';
        if (match[0] === '"') {
            clase = esClave ? 'json-key' : 'json-string';
        } else if (match === 'true' || match === 'false') {
            clase = 'json-boolean';
        } else if (match === 'null') {
            clase = 'json-null';
        }
        html += `<span class="${clase}">${escapeHtml(match)}</span>`;
        ultimo = offset + match.length;
        return match;
    });

    return html + escapeHtml(json.slice(ultimo));
}

const JSON_VIEW_PAGE_SIZE = 100;

/**
 * Renderiza los registros de la tabla actual como tarjetas JSON
 * @param {HTMLElement} container - Contenedor de la vista JSON
 */
function renderJsonView(container) {
    if (!container) return;
    container._visibles = JSON_VIEW_PAGE_SIZE;
    pintarJsonView(container);

    if (container._eventsInitialized) return;
    container._eventsInitialized = true;

    container.addEventListener('click', (e) => {
        const copyBtn = e.target.closest('.json-copy-btn');
        if (copyBtn) {
            const row = tableState.data[Number(copyBtn.dataset.index)];
            if (!row) return;
            const texto = JSON.stringify(rowToRecord(row, tableState.columns), null, 2);
            navigator.clipboard.writeText(texto).then(() => {
                const textoOriginal = copyBtn.dataset.label;
                copyBtn.querySelector('span').textContent = 'Copiado';
                copyBtn.classList.add('is-success');
                setTimeout(() => {
                    copyBtn.querySelector('span').textContent = textoOriginal;
                    copyBtn.classList.remove('is-success');
                }, 1200);
            });
            return;
        }

        if (e.target.closest('.json-load-more')) {
            container._visibles += JSON_VIEW_PAGE_SIZE;
            pintarJsonView(container);
        }
    });
}

function pintarJsonView(container) {
    const data = tableState.data;
    const visibles = Math.min(container._visibles, data.length);
    const tarjetas = [];

    for (let i = 0; i < visibles; i++) {
        tarjetas.push(`
            <article class="json-card">
                <header class="json-card__header">
                    <span class="json-card__title">Registro ${i + 1}</span>
                    <button type="button" class="json-copy-btn" data-index="${i}" data-label="Copiar" title="Copiar el registro como JSON">
                        ${TABLE_ICONS.copy}<span>Copiar</span>
                    </button>
                </header>
                <pre class="json-card__body">${highlightJson(rowToRecord(data[i], tableState.columns))}</pre>
            </article>`);
    }

    if (visibles < data.length) {
        tarjetas.push(`
            <div class="json-view__more">
                <span>Mostrando ${visibles} de ${data.length} registros</span>
                <button type="button" class="json-load-more">Mostrar ${Math.min(JSON_VIEW_PAGE_SIZE, data.length - visibles)} más</button>
            </div>`);
    }

    container.innerHTML = tarjetas.join('');
}

/**
 * Todos los registros actuales como JSON (para "Copiar todo")
 */
function getTableJson() {
    const registros = tableState.data.map(row => rowToRecord(row, tableState.columns));
    return JSON.stringify(registros.length === 1 ? registros[0] : registros, null, 2);
}

/**
 * Vacía la tabla y el estado asociado
 */
function clearTable() {
    tableState.data = [];
    tableState.columns = [];
    tableState.renderedRows = 0;
    const table = document.querySelector('.data-table');
    if (table) {
        table.querySelector('thead tr')?.replaceChildren();
        table.querySelector('tbody')?.replaceChildren();
    }
    const jsonContainer = document.getElementById('jsonViewContainer');
    if (jsonContainer) jsonContainer.innerHTML = '';
    applyHiddenColumns();
}

// Hacer disponible globalmente
window.updateTable = updateTable;
window.sortTable = sortTable;
window.toggleColumn = toggleColumn;
window.setHiddenColumns = setHiddenColumns;
window.getEmptyColumnKeys = getEmptyColumnKeys;
window.applyHiddenColumns = applyHiddenColumns;
window.selectCell = selectCell;
window.renderJsonView = renderJsonView;
window.getTableJson = getTableJson;
window.clearTable = clearTable;
window.renderAllRows = renderAllRows;
window.inicializarDragScrollTabla = inicializarDragScrollTabla;
window.setupHorizontalWheelScroll = setupHorizontalWheelScroll;
