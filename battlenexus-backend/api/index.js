const express = require('express');
const { initDB, getPool } = require('../config/db');

const app = express();

// ─── Initialize DB on startup ───
let dbReady = false;
(async () => {
  try {
    await initDB();
    dbReady = true;
    console.log('✅ Database initialized');
  } catch (err) {
    console.error('❌ DB init error:', err.message);
  }
})();

// ─── Health check ───
app.get('/api/health', (req, res) => {
  res.json({ status: dbReady ? 'ok' : 'initializing' });
});

// ─── Database test ───
app.get('/api/db-test', async (req, res) => {
  if (!dbReady) {
    return res.status(503).json({ error: 'Database is still initializing, try again in a moment.' });
  }
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT 1 as test');
    res.json({ success: true, result: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;