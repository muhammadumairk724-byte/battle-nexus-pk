const express = require('express');
const { initDB, seedAdmin } = require('../config/db');

const app = express();

// ─── State ───
let dbReady = false;
let dbError = null;

// ─── Initialize DB asynchronously (non‑blocking) ───
(async function init() {
  try {
    await initDB();
    await seedAdmin(); // optional – if this fails, the app still works
    dbReady = true;
    console.log('✅ Database ready');
  } catch (err) {
    dbError = err.message;
    console.error('❌ DB init error:', err.message);
    // The function stays alive – no crash
  }
})();

// ─── Health endpoint ───
app.get('/api/health', (req, res) => {
  res.json({ status: dbReady ? 'ok' : 'initializing' });
});

// ─── DB test endpoint ───
app.get('/api/db-test', async (req, res) => {
  if (dbError) {
    return res.status(500).json({ error: 'DB init failed: ' + dbError });
  }
  if (!dbReady) {
    return res.status(503).json({ error: 'Database is initializing, try again in a moment.' });
  }
  try {
    const pool = require('../config/db').getPool();
    const [rows] = await pool.query('SELECT 1 as test');
    res.json({ success: true, result: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Simple test (no DB) ───
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

module.exports = app;