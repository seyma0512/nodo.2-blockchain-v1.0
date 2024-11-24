const { MongoClient } = require('mongodb');

const url = 'mongodb://localhost:27017'; // Cambia esto si tu URL es diferente
const dbName = 'blockchain'; // Cambia esto al nombre de tu base de datos
let db;

const connectDB = async () => {
    try {
        const client = new MongoClient(url); // Añadido opciones
        await client.connect();
        
        db = client.db(dbName);
        console.log('Conectado a la base de datos MongoDB');
    } catch (err) {
        console.error('Error de conexión a MongoDB:', err);
    }
};

const getDB = () => db;

module.exports = { connectDB, getDB };
