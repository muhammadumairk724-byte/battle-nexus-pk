const express = require('express');
const { getPool } = require('../config/db');

const app = express();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/db-test', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT 1 as test');
    res.json({ success: true, result: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;