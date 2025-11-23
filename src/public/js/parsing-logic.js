/**
 * Módulo para lógica de parseo de datos
 */

export const parsingLogic = {
    async parsearContenido(parserId, text) {
        try {
            const response = await fetch('/parse/manual', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    parserId: parserId,
                    text: text
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

            return result;
        } catch (error) {
            console.error('Error al parsear:', error);
            throw error;
        }
    },

    updateTableWithSections(secciones, activeTab, columns) {
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
            tab.className = `px-4 py-2 text-sm font-medium ${activeTab === seccionNombre ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`;
            tab.textContent = `Sección ${seccionNombre}`;
            tab.dataset.sectionName = seccionNombre;
            tabsContainer.appendChild(tab);
        });

        // Insertar las pestañas antes de la tabla
        const tableWrapper = document.querySelector('#tableScrollContainer')?.parentElement;
        if (tableWrapper) {
            tableWrapper.insertBefore(tabsContainer, tableWrapper.firstChild);
        }

        return tabsContainer;
    },

    setupSectionTabs(tabsContainer, secciones, onTabChange) {
        tabsContainer.querySelectorAll('button').forEach(btn => {
            btn.onclick = () => {
                const seccionNombre = btn.dataset.sectionName;
                onTabChange(seccionNombre);
                
                // Actualizar estilos de las pestañas
                tabsContainer.querySelectorAll('button').forEach(b => {
                    if (b.dataset.sectionName === seccionNombre) {
                        b.className = 'px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600';
                    } else {
                        b.className = 'px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700';
                    }
                });
            };
        });
    }
};

