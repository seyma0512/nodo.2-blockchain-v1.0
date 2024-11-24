const fs = require('fs');
const path = require('path');

function imprimirEstructuraDirectorio(ruta, nivel = 0) {
    const indentacion = ' '.repeat(nivel * 4);
    fs.readdirSync(ruta).forEach(item => {
        const rutaCompleta = path.join(ruta, item);
        const esDirectorio = fs.lstatSync(rutaCompleta).isDirectory();
        
        if (esDirectorio & item !== 'node_modules') {
            console.log(`${indentacion}📁 ${item}/`);
            imprimirEstructuraDirectorio(rutaCompleta, nivel + 1);
        } else if (!esDirectorio) {
            console.log(`${indentacion}📄 ${item}`);
        }
    });
}

const rutaProyecto = '.';  // Cambia esto por la ruta de tu proyecto si no está en el mismo directorio que este script
imprimirEstructuraDirectorio(rutaProyecto);
