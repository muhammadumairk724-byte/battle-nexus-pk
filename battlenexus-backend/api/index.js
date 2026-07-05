const express = require('express');
const { initDB, seedAdmin, getPool } = require('../config/db');

const app = express();

// ─── Middleware ───
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── State ───
let dbReady = false;
let dbError = null;

// ─── Initialize DB asynchronously ───
(async function init() {
  try {
    await initDB();
    await seedAdmin();
    dbReady = true;
    console.log('✅ Database ready');
  } catch (err) {
    dbError = err.message;
    console.error('❌ DB init error:', err.message);
  }
})();

// ─── Health & Test Endpoints ───
app.get('/api/health', (req, res) => {
  res.json({ status: dbReady ? 'ok' : 'initializing' });
});

app.get('/api/db-test', async (req, res) => {
  if (dbError) return res.status(500).json({ error: 'DB init failed: ' + dbError });
  if (!dbReady) return res.status(503).json({ error: 'DB initializing...' });
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT 1 as test');
    res.json({ success: true, result: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── YOUR ROUTES ───
const authRoutes = require('../routes/authRoutes');
const adminRoutes = require('../routes/adminRoutes');
const tournamentRoutes = require('../routes/tournamentRoutes');
const leaderboardRoutes = require('../routes/leaderboardRoutes');
const notificationRoutes = require('../routes/notificationRoutes');
const userRoutes = require('../routes/userRoutes');
const userStatsRoutes = require('../routes/userStatsRoutes');
const userTournamentsRoutes = require('../routes/userTournamentsRoutes');
const walletRoutes = require('../routes/walletRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/user', userRoutes);
app.use('/api/user/stats', userStatsRoutes);
app.use('/api/user/tournaments', userTournamentsRoutes);
app.use('/api/user/wallet', walletRoutes);

// ─── Cron endpoint (auto-update tournament status) ───
app.post('/api/cron/update-tournaments', async (req, res) => {
  try {
    const { autoUpdateTournamentStatus } = require('../utils/tournamentScheduler');
    await autoUpdateTournamentStatus();
    res.json({ message: 'Tournament statuses updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Error Handler ───
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

module.exports = app;