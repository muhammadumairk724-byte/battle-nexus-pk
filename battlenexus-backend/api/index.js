const express = require('express');
const app = express();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/tournaments', (req, res) => {
  res.json({ message: 'Tournaments endpoint works' });
});

module.exports = app;