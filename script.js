// Función para cargar los bloques
async function loadBlocks() {
    try {
        const response = await fetch('/get-blocks');
        const blocks = await response.json();

        // Función para mostrar los bloques en cada sección
        function showBlocks(type, blocks) {
            const section = document.getElementById(`${type}_list`);
            section.innerHTML = ''; // Limpiar la sección antes de agregar nuevos bloques

            if (blocks.length === 0) {
                section.innerHTML = '<p>No hay bloques disponibles para este tipo.</p>';
            } else {
                blocks.forEach(block => {
                    const blockItem = document.createElement('div');
                    blockItem.classList.add('block-item');

                    const blockHtml = `
                        <p><strong>Nombre:</strong> ${block.name}</p>
                        <p><strong>Descripción:</strong> ${block.description}</p>
                        <p><strong>Fecha:</strong> ${block.timestamp}</p>
                        <p><strong>Tipo de Cadena:</strong> ${block.chain}</p>
                        <p><strong>Firma Digital:</strong> ${block.digitalSignature}</p>
                        <p><strong>Altura del Bloque:</strong> ${block.height}</p>
                        <p><strong>Hash Anterior:</strong> ${block.previousHash}</p>
                        <p><strong>Ubicación de la Carpeta en Drive:</strong> 
                            <a href="${block.folderPath}" target="_blank">Ver carpeta en Google Drive</a>
                        </p>
                        <p><strong>Hash del Bloque:</strong> ${block.hash}</p>
                        <p><strong>Nodo:</strong> ${block.node}</p>
                        <hr>
                        <h4>Archivos en este bloque:</h4>
                        <ul>
                            ${block.data.map(file => `
                                <li>
                                    <a href="#" data-chain="${block.chain}" data-name="${block.name}" data-file="${file.fileName}" class="file-link">
                                        ${file.fileName} (${file.fileType})
                                    </a>
                                </li>
                            `).join('')}
                        </ul>
                    `;

                    blockItem.innerHTML = blockHtml;
                    section.appendChild(blockItem);
                });
            }
        }

        // Mostrar los bloques por cada tipo
        showBlocks('block_pdf', blocks.block_pdf);
        showBlocks('block_pdf_audio', blocks.block_pdf_audio);
        showBlocks('block_pdf_video', blocks.block_pdf_video);
        showBlocks('block_pdf_audio_video', blocks.block_pdf_audio_video);

        // Añadir evento para capturar los clics en los enlaces de los archivos
        const fileLinks = document.querySelectorAll('.file-link');
        fileLinks.forEach(link => {
            link.addEventListener('click', function (event) {
                event.preventDefault(); // Evitar la acción predeterminada del enlace

                // Obtener los parámetros del archivo
                const chain = link.getAttribute('data-chain');
                const name = link.getAttribute('data-name');
                const fileName = link.getAttribute('data-file');

                // Mostrar un mensaje antes de abrir el archivo
                alert(`Estás a punto de abrir el archivo: ${fileName}`);

                // Abrir una nueva pestaña con el endpoint de desencriptación
                const url = `/${chain}/${name}-${fileName}`;
                window.open(url, '_blank'); // Esto abrirá el archivo desencriptado en una nueva pestaña
            });
        });

    } catch (error) {
        console.error('Error al cargar los bloques:', error);
    }
}

// Cargar los bloques inicialmente
loadBlocks();

// Recargar los bloques automáticamente cada 30 segundos
setInterval(loadBlocks, 30000); // 30000 ms = 30 segundos
