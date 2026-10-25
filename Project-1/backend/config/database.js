const oracledb = require('oracledb');
require('dotenv').config();

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const poolConfig = {
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
    poolMin: 1,
    poolMax: 10,
    poolIncrement: 1,
    queueTimeout: 5000
};

let pool;

async function initializeDatabase() {
    try {
        pool = await oracledb.createPool(poolConfig);
        console.log('Oracle database connected successfully');
    } catch (error) {
        console.error('Oracle database connection failed:', error);
        throw error;
    }
}

async function getConnection() {
    if (!pool) {
        throw new Error('Oracle connection pool is not initialized');
    }

    return await pool.getConnection();
}

async function closeDatabase() {
    if (pool) {
        await pool.close(10);
        console.log('Oracle database connection closed');
    }
}

module.exports = {
    initializeDatabase,
    getConnection,
    closeDatabase
};