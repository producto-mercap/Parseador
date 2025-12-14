/**
 * Módulo para gestión del estado de la UI (modales, tabs, sidebar, etc.)
 */

export const uiState = {
    limpiarDatos() {
        // Limpiar pestañas si existen
        const tabsContainer = document.querySelector('.section-tabs-container');
        if (tabsContainer) {
            tabsContainer.remove();
        }
        
        // Limpiar tabla
        const table = document.querySelector('.data-table');
        if (table) {
            const thead = table.querySelector('thead');
            const tbody = table.querySelector('tbody');
            if (thead) thead.innerHTML = '';
            if (tbody) tbody.innerHTML = '';
        }
        
        // Limpiar input de archivo
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.value = '';
        }
    },

    setActiveTab(tab) {
        return tab;
    },

    initSeccion(index, seccionesData) {
        if (!seccionesData[index]) {
            seccionesData[index] = {
                cantidadColumnas: 0,
                tieneDelimitador: false,
                caracteres: {}
            };
        }
        return seccionesData[index];
    }
};









































