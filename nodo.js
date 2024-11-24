const path = require('path');
require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const { getDB, connectDB } = require('./db-atlas');
const { google } = require('googleapis');
const stream = require('stream');
const cors = require('cors');
const axios = require('axios'); // Para hacer peticiones HTTP al Nodo 2

// Inicializar Express
const app = express();
const PORT = 3002;

// Usar CORS después de inicializar app
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => {
    res.sendFile(path.resolve('index.html'));
});

const credentials_google = {
    private_key: process.env.GOOGLE_SERVICE_KEY,
    client_email: process.env.GOOGLE_SERVICE_EMAIL,
    project_id: process.env.GOOGLE_SERVICE_ID,
};

// Configuración de Google Drive API
const auth = new google.auth.GoogleAuth({
    credentials: credentials_google,
    scopes: ['https://www.googleapis.com/auth/drive'],
});
const drive = google.drive({ version: 'v3', auth });

// Configuración de Multer para la carga de archivos en memoria
const upload = multer({ storage: multer.memoryStorage() });

// Función para cifrar el buffer del archivo
function encryptFile(buffer, uniqueId) {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    const iv = Buffer.from(process.env.IV, 'hex');
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return encrypted;
}

// Generar hash para el bloque
function generateHash(blockData) {
    const blockString = JSON.stringify(blockData);
    const hash = crypto.createHash('sha256');
    hash.update(blockString);
    return hash.digest('hex');
}

// Función para obtener el hash previo
async function getPreviousHash(chain) {
    const db = getDB();
    const lastBlock = await db.collection(chain).find().sort({ height: -1 }).limit(1).toArray();
    return lastBlock.length > 0 ? lastBlock[0].hash : '0512001705';
}

// Función para crear una subcarpeta en Google Drive
async function createSubfolder(folderName, parentFolderId) {
    const response = await drive.files.create({
        requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId],
        },
    });
    return response.data.id;
}

// Función para subir un archivo a Google Drive
async function uploadFileToDrive(fileBuffer, fileName, mimeType, folderId) {
    try {
        const fileStream = bufferToStream(fileBuffer);
        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                mimeType: mimeType,
                parents: [folderId],
            },
            media: {
                mimeType: mimeType,
                body: fileStream,
            },
        });

        await drive.permissions.create({
            fileId: response.data.id,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });
        return `https://drive.google.com/uc?id=${response.data.id}`;
    } catch (error) {
        console.error('Error al subir archivo a Google Drive:', error);
        throw new Error('Error al subir archivo');
    }
}

// Función para convertir un buffer a un stream
function bufferToStream(buffer) {
    const readableStream = new stream.Readable();
    readableStream._read = () => {}; // No-op
    readableStream.push(buffer);
    readableStream.push(null); // Fin del stream
    return readableStream;
}

// Ruta para recibir datos y archivos
app.post('/receive-data', upload.array('file'), async (req, res) => {
    const db = getDB();
    const { name, description, location, incidentType, chain, userId, digitalSignature } = req.body;

    console.log('Datos recibidos:', req.body);
    console.log('Archivos recibidos:', req.files);

    // Verificar que los datos esenciales sean enviados
    if (!name || !description || !location || !incidentType || !chain || !userId || !digitalSignature) {
        console.log('Faltan datos esenciales');
        return res.status(400).json({
            success: false,
            message: 'Faltan datos esenciales para crear el bloque (name, description, location, incidentType, chain, userId, digitalSignature)',
        });
    }

    // Verificar que se envíen archivos
    if (!req.files || req.files.length === 0) {
        console.log('No se recibieron archivos');
        return res.status(400).json({ success: false, message: 'No se recibieron archivos' });
    }

    const previousHash = await getPreviousHash(chain);
    const timestamp = new Date().toISOString();
    const count = await db.collection(chain).countDocuments();
    const height = count === 0 ? 1 : count + 1;

    // Definir las carpetas en Google Drive según la cadena
    const googleDriveFolders = {
        block_pdf: '1dVqtu_HK7GMr4sDeQFan6tNfdz4HFkDJ',
        block_pdf_audio: '11rIm0wPN95-wLDJMFRjlGbe75ibP8OQO',
        block_pdf_audio_video: '1yg2QaikYggqXbGSs_EjCT2jBGHJev77s',
        block_pdf_video: '1baotaYaMSW0pKHSp6jPb2QBsVRhDqnW_',
    };
    const parentFolderId = googleDriveFolders[chain];
    if (!parentFolderId) {
        console.log('Tipo de cadena inválido');
        return res.status(400).json({ success: false, message: 'Tipo de cadena inválido' });
    }

    console.log('Creando subcarpeta en Google Drive...');
    // Crear subcarpeta en Google Drive
    const subfolderName = `${name}_${Date.now()}`;
    const subfolderId = await createSubfolder(subfolderName, parentFolderId);
    console.log('Subcarpeta creada con ID:', subfolderId);

    // Procesar los archivos subidos
    const filesData = [];
    for (const file of req.files) {
        const uniqueId = Math.floor(Math.random() * 1e15).toString();
        console.log(`Procesando archivo: ${file.originalname}`);

        const encryptedFileBuffer = encryptFile(file.buffer, uniqueId);
        const driveFileUrl = await uploadFileToDrive(encryptedFileBuffer, `${uniqueId}.${file.mimetype.split('/')[1]}`, file.mimetype, subfolderId);

        filesData.push({
            fileName: `${uniqueId}.${file.mimetype.split('/')[1]}`,
            filePath: driveFileUrl,
            fileType: file.mimetype,
        });
    }

    console.log('Datos del archivo subido:', filesData);

    // Crear el bloque con toda la información
    const blockData = {
        _id: count === 0 ? 1 : count + 1,
        name,
        description,
        location,
        incidentType,
        chain,
        digitalSignature,
        height,
        timestamp,
        previousHash,
        folderPath: `https://drive.google.com/drive/folders/${subfolderId}`,
        data: filesData,
        hash: generateHash({
            name,
            description,
            location,
            incidentType,
            chain,
            digitalSignature,
            height,
            timestamp,
            previousHash,
            data: filesData,
        }),
        node: 'nodo-1-blockchain-3002'
    };

    console.log('Enviando datos al Nodo 2 para validación...');
    try {
        // Enviar los datos al Nodo 1 para validación
        const response = await axios.post('https://nodo-1-blockchain-v1-0.onrender.com/validate-block', blockData);

        // Si el Nodo 1 valida el bloque, procedemos con la creación
        if (response.data.success) {
            console.log('Bloque validado por Nodo 1');
            await db.collection(chain).insertOne(blockData);
            return res.json({ 
                success: true, 
                message: 'Bloque subido y validado exitosamente',
                node: 'nodo-2-blockchain-3002', 
                blockData 
            });
        } else {
            return res.status(400).json({ 
                success: false, 
                message: 'El bloque no fue validado por Nodo 1' 
            });
        }
    } catch (error) {
        console.error('Error al enviar datos al Nodo 1:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al validar el bloque con Nodo 1',
        });
    }
});

// Ruta para obtener los bloques más recientes
app.get('/get-blocks', async (req, res) => {
    const db = getDB();
    const blockTypes = ['block_pdf', 'block_pdf_audio', 'block_pdf_video', 'block_pdf_audio_video'];

    try {
        const blocks = {};

        for (const type of blockTypes) {
            const latestBlock = await db.collection(type).find({ node: 'nodo-security-blockchain-3002' })
                .sort({ height: -1 })
                .limit(1)
                .toArray();

            if (latestBlock.length === 0) {
                const fallbackBlock = await db.collection(type).find({ node: { $exists: true } })
                    .sort({ height: -1 })
                    .limit(1)
                    .toArray();
                blocks[type] = fallbackBlock;
            } else {
                blocks[type] = latestBlock;
            }
        }

        res.json(blocks);
    } catch (error) {
        console.error('Error al obtener bloques:', error);
        res.status(500).json({ success: false, message: 'Error al obtener bloques' });
    }
});

// Ruta para ver y desencriptar archivo desde Google Drive
app.get('/:chain/:name-:fileName', async (req, res) => {
    const { chain, fileName } = req.params;
    const db = getDB();

    let collectionsToSearch = [];

    if (chain === 'all') {
        collectionsToSearch = ['block_pdf', 'block_pdf_audio', 'block_pdf_video', 'block_pdf_audio_video'];
    } else {
        collectionsToSearch = [chain];
    }

    try {
        let block;
        let fileData;

        for (const collection of collectionsToSearch) {
            block = await db.collection(collection).findOne({ "data.fileName": fileName });
            if (block) {
                fileData = block.data.find(file => file.fileName === fileName);
                if (fileData) break;
            }
        }

        if (!fileData) {
            return res.status(404).send('Archivo no encontrado en ninguna de las colecciones');
        }

        const driveFileUrl = fileData.filePath;
        const fileId = new URL(driveFileUrl).searchParams.get('id');
        if (!fileId) {
            return res.status(400).send('No se pudo obtener el ID del archivo de Google Drive');
        }

        const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
        const encryptedBuffer = Buffer.from(response.data);

        let contentType = '';
        if (fileData.fileType === 'application/pdf') {
            contentType = 'application/pdf';
        } else if (fileData.fileType === 'audio/mpeg') {
            contentType = 'audio/mpeg';
        } else if (fileData.fileType === 'video/mp4') {
            contentType = 'video/mp4';
        } else {
            return res.status(400).send('Tipo de archivo no soportado');
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${fileName.replace('.enc', '')}"`);

        const decipher = crypto.createDecipheriv(
            'aes-256-cbc',
            Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
            Buffer.from(process.env.IV, 'hex')
        );

        const decryptedBuffer = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
        res.send(decryptedBuffer);
    } catch (error) {
        console.error('Error al descargar o desencriptar el archivo:', error);
        res.status(500).send('Error al procesar el archivo');
    }
});

// Conectar a la base de datos
connectDB();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}/index.html`);
});
