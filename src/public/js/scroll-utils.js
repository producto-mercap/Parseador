/**
 * Utilidades para manejo de scroll horizontal
 */

function setupMainPanelScrollDetection() {
    const mainPanel = document.getElementById('mainContentPanel');
    const scrollButton = document.getElementById('scrollToLeftButton');
    
    if (!mainPanel || !scrollButton) return;
    
    const checkScroll = () => {
        const scrollLeft = mainPanel.scrollLeft;
        if (scrollLeft > 0) {
            scrollButton.style.display = 'flex';
            scrollButton.style.opacity = '1';
            scrollButton.style.pointerEvents = 'auto';
        } else {
            scrollButton.style.display = 'none';
            scrollButton.style.opacity = '0';
            scrollButton.style.pointerEvents = 'none';
        }
    };
    
    mainPanel.addEventListener('scroll', checkScroll);
    checkScroll();
    
    // Verificar también cuando cambia el tamaño de la ventana
    window.addEventListener('resize', checkScroll);
}

// Hacer disponible globalmente
window.setupMainPanelScrollDetection = setupMainPanelScrollDetection;

