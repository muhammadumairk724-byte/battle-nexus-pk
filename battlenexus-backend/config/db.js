const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

let pool = null;

const getPool = () => {
  if (!pool) {
    throw new Error('Pool not initialized. Call initDB() first.');
  }
  return pool;
};

const initDB = async () => {
  // Check required environment variables
  const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(', ')}`);
  }

  try {
    pool = await mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT) || 4000,
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 5000,
      acquireTimeout: 5000,
      ssl: { rejectUnauthorized: false }
    });
    console.log('✅ Database pool created');
    return pool;
  } catch (err) {
    console.error('❌ DB pool error:', err.message);
    throw err;
  }
};

const seedAdmin = async () => {
  // ... (your seedAdmin function) ...
  // For now, you can omit it or keep it – but make sure it uses getPool()
};

module.exports = { initDB, getPool, seedAdmin };