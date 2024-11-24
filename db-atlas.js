const { MongoClient } = require('mongodb');

// URL de conexión a MongoDB Atlas
const url = "mongodb+srv://seyma0512:Sebas1705@blockchain.lzsj1.mongodb.net/?retryWrites=true&w=majority&appName=blockchain";
const dbName = 'blockchain-atlas'; // Cambia esto al nombre de tu base de datos
let db; // Variable para almacenar la instancia de la base de datos

/**
 * Conectar a la base de datos
 */
const connectDB = async () => {
    try {
        if (db) {
            console.log('La base de datos ya está conectada.');
            return db;
        }

        const client = new MongoClient(url, {
            serverApi: {
                version: '1',
                strict: true,
                deprecationErrors: true,
            },
        });

        await client.connect();
        db = client.db(dbName);
        console.log('Conectado a MongoDB Atlas');
        return db; // Devuelve la instancia de la base de datos
    } catch (err) {
        console.error('Error de conexión a MongoDB Atlas:', err);
        throw err; // Asegúrate de propagar el error si ocurre
    }
};

/**
 * Obtener la instancia de la base de datos
 */
const getDB = () => {
    if (!db) {
        throw new Error('La base de datos no está conectada. Llama a connectDB primero.');
    }
    return db;
};

module.exports = { connectDB, getDB };
