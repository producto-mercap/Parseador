/**
 * Componentes Alpine.js para la aplicación
 */

// Componente para tablas con secciones
document.addEventListener('alpine:init', () => {
    Alpine.data('tableComponent', (initialTab, encodedData) => ({
        activeTab: initialTab,
        tableData: JSON.parse(decodeURIComponent(encodedData)),
        
        getHeaders(section) {
            if (!this.tableData[section] || !this.tableData[section][0]) return [];
            return Object.keys(this.tableData[section][0]).filter(key => key !== 'seccion');
        },

        updateCell(section, rowIndex, columnName, element) {
            if (this.tableData[section] && this.tableData[section][rowIndex]) {
                const value = element.textContent.trim();
                this.tableData[section][rowIndex][columnName] = value;
            }
        },
        
        getTableData() {
            return this.tableData;
        }
    }));
});

