const express = require('express');
const { getPool } = require('../config/db'); // just import, don't call

const app = express();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = app;