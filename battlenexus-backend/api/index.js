const express = require('express');
const { initDB, getPool, seedAdmin } = require('../config/db');

const app = express();

let dbReady = false;
let dbError = null;

// ─── Initialize DB on startup (catch errors) ───
(async function init() {
  try {
    await initDB();
    await seedAdmin(); // optional – you can remove if you already have admin
    dbReady = true;
    console.log('✅ Database ready');
  } catch (err) {
    dbError = err.message;
    console.error('❌ DB init failed:', err.message);
    // Do NOT exit – we want the function to stay alive.
  }
})();

// ─── Health check (always responds) ───
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── Database test endpoint ───
app.get('/api/db-test', async (req, res) => {
  if (dbError) {
    return res.status(500).json({ error: 'Database init failed: ' + dbError });
  }
  if (!dbReady) {
    return res.status(503).json({ error: 'Database still initializing, please wait...' });
  }
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT 1 as test');
    res.json({ success: true, result: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Test endpoint (no DB) ───
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// ─── Export for Vercel ───
module.exports = app;