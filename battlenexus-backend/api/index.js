require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const serverless = require('serverless-http');

// ─── Try loading modules ───
let initDB, seedAdmin, autoUpdateTournamentStatus;
try {
  const db = require('../config/db');
  initDB = db.initDB;
  seedAdmin = db.seedAdmin;
  const scheduler = require('../utils/tournamentScheduler');
  autoUpdateTournamentStatus = scheduler.autoUpdateTournamentStatus;
} catch (err) {
  console.error('❌ Module load error:', err.message);
}

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/auth', limiter);
app.use('/api/admin', limiter);

// ─── Routes (try/catch for each) ───
try {
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
} catch (err) {
  console.error('❌ Route load error:', err.message);
}

// Error handler
const { errorHandler } = require('../middleware/errorHandler');
app.use(errorHandler);

// ─── Health check ───
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── Cron endpoint ───
app.post('/api/cron/update-tournaments', async (req, res) => {
  try {
    if (!autoUpdateTournamentStatus) {
      return res.status(500).json({ error: 'Scheduler not loaded' });
    }
    await autoUpdateTournamentStatus();
    res.json({ message: 'Tournament statuses updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DB initialisation ───
let dbInitialized = false;
const initializeDB = async () => {
  if (!dbInitialized && initDB && seedAdmin) {
    await initDB();
    await seedAdmin();
    dbInitialized = true;
  }
};

app.use(async (req, res, next) => {
  try {
    await initializeDB();
    next();
  } catch (err) {
    console.error('❌ DB init error:', err);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// ─── Export serverless handler ───
module.exports.handler = serverless(app);

// ─── Local development ───
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = process.env.PORT || 5002;
  app.listen(PORT, () => {
    console.log(`🚀 Server running locally on port ${PORT}`);
  });
}