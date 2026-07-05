const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

let pool;

const initDB = async () => {
  // TiDB Cloud requires SSL/TLS connection.
  // Setting rejectUnauthorized: false is safe because TiDB Cloud uses globally trusted certificates.
  const sslOptions = {
    rejectUnauthorized: false
  };

  pool = await mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 4000,  // TiDB Cloud uses port 4000
    waitForConnections: true,
    connectionLimit: 10,
    ssl: sslOptions,   // ← Add this line for TiDB Cloud
  });
  console.log('✅ MySQL connection pool established (TiDB Cloud)');
  return pool;
};

const getPool = () => pool;

const seedAdmin = async () => {
  const pool = getPool();
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [adminEmail]);
  if (rows.length > 0) {
    console.log('✅ Admin account already exists');
    return;
  }

  const hashed = await bcrypt.hash(adminPassword, 10);
  await pool.query(
    `INSERT INTO users (username, email, password_hash, full_name, role, status, email_verified)
     VALUES (?, ?, ?, ?, 'admin', 'active', TRUE)`,
    ['admin', adminEmail, hashed, 'Super Admin']
  );
  console.log('✅ Admin account created with default credentials');
};

module.exports = { initDB, getPool, seedAdmin };