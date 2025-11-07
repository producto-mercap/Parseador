const fs = require('fs');
const path = require('path');

// Obtener la lista de archivos de migración
const migrationFiles = fs.readdirSync(__dirname)
    .filter(file => file.endsWith('.js') && file !== 'run-migrations.js')
    .sort();

// Ejecutar cada migración en orden
migrationFiles.forEach(file => {
    console.log(`Ejecutando migración: ${file}`);
    require(path.join(__dirname, file));
}); 