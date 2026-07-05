const express = require('express');
const serverless = require('serverless-http');

const app = express();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('*', (req, res) => {
  res.json({ message: 'API is working' });
});

module.exports = serverless(app);