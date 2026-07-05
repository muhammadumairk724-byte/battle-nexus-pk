const express = require('express');
const serverless = require('serverless-http');
const { initDB, seedAdmin } = require('../config/db');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health check (always works) ───
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── Simple test endpoint ───
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// ─── Database test endpoint ───
app.get('/api/db-test', async (req, res) => {
  try {
    const pool = require('../config/db').getPool();
    const [rows] = await pool.query('SELECT 1 as test');
    res.json({ success: true, result: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Tournament endpoint ───
app.get('/api/tournaments', async (req, res) => {
  try {
    const pool = require('../config/db').getPool();
    const [rows] = await pool.query('SELECT * FROM tournaments LIMIT 10');
    res.json({ tournaments: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DB init on first request only ───
let dbInitialized = false;
app.use(async (req, res, next) => {
  if (!dbInitialized) {
    try {
      await initDB();
      await seedAdmin();
      dbInitialized = true;
      console.log('✅ DB initialized');
    } catch (err) {
      console.error('❌ DB init error:', err.message);
      // Don't block the request – let it through anyway
    }
  }
  next();
});

// ─── Export for Vercel ───
module.exports = serverless(app);

// ─── Local dev ───
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5002;
  app.listen(PORT, () => console.log(`🚀 Local server on port ${PORT}`));
}