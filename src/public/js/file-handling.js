/**
 * Módulo para manejo de archivos y exportación
 */

const fileHandling = {
    handleFileSelect(event) {
        const file = event.target.files?.[0];
        return new Promise((resolve, reject) => {
            if (!file) {
                resolve(null);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                resolve({
                    name: file.name,
                    file: file,
                    content: e.target.result
                });
            };
            reader.onerror = (error) => {
                reject(error);
            };
            reader.readAsText(file);
        });
    },

    /**
     * Carga la librería XLSX bajo demanda (pesa ~300 KB y solo se usa al exportar)
     */
    cargarXLSX() {
        if (window.XLSX) return Promise.resolve(window.XLSX);
        if (!this._xlsxPromise) {
            this._xlsxPromise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
                script.onload = () => resolve(window.XLSX);
                script.onerror = () => {
                    this._xlsxPromise = null;
                    reject(new Error('No se pudo cargar la librería de exportación'));
                };
                document.head.appendChild(script);
            });
        }
        return this._xlsxPromise;
    },

    async exportarXLS(groupedData, columns, parserNombre) {
        try {
            if (!groupedData || (Object.keys(groupedData).length === 0 && !Array.isArray(groupedData))) {
                throw new Error('No hay datos para exportar');
            }

            const XLSX = await this.cargarXLSX();
            // Conservar 0 y false; solo null/undefined se exportan vacíos
            const valorCelda = (valor) => (valor === null || valor === undefined ? '' : valor);
            const wb = XLSX.utils.book_new();
            
            if (Array.isArray(groupedData)) {
                if (groupedData.length === 0) {
                    throw new Error('No hay datos para exportar');
                }

                const headers = columns.map(col => col.nombre);
                const data = [headers];
                
                groupedData.forEach(row => {
                    const rowData = headers.map(header => valorCelda(row[header]));
                    data.push(rowData);
                });

                const ws = XLSX.utils.aoa_to_sheet(data);
                XLSX.utils.book_append_sheet(wb, ws, 'Datos');
            } else {
                Object.entries(groupedData).forEach(([sectionName, sectionData]) => {
                    if (!sectionData.datos || !Array.isArray(sectionData.datos) || sectionData.datos.length === 0) return;
                    
                    const headers = sectionData.columnas.map(col => col.nombre);
                    const data = [headers];
                    
                    sectionData.datos.forEach(row => {
                        const rowData = headers.map(header => valorCelda(row[header]));
                        data.push(rowData);
                    });

                    const ws = XLSX.utils.aoa_to_sheet(data);
                    const safeSheetName = sectionName.replace(/[*?:/\\[\]]/g, '_').substring(0, 31);
                    XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
                });
            }

            if (wb.SheetNames.length === 0) {
                throw new Error('No hay datos válidos para exportar');
            }

            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            try {
                const fileName = `${parserNombre}_${new Date().toISOString().split('T')[0]}.xlsx`;
                const handle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: 'Excel Files',
                        accept: {
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
                        }
                    }]
                });

                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();

                this.showNotification('Archivo exportado exitosamente', 'success');
            } catch (err) {
                const url = window.URL.createObjectURL(blob);
                const downloadLink = document.createElement('a');
                downloadLink.href = url;
                downloadLink.download = `${parserNombre}_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                
                setTimeout(() => {
                    document.body.removeChild(downloadLink);
                    window.URL.revokeObjectURL(url);
                }, 100);
            }

        } catch (error) {
            console.error('Error al exportar a Excel:', error);
            this.showNotification('Error al exportar: ' + error.message, 'error');
        }
    },

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `fixed bottom-4 right-4 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-4 py-2 rounded-lg shadow-lg z-50`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
};

// Hacer disponible globalmente
window.fileHandling = fileHandling;

