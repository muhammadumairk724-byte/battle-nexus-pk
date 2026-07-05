require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initDB, seedAdmin } = require('./config/db');
const { autoUpdateTournamentStatus } = require('./utils/tournamentScheduler');

const app = express();

// CORS – allow all origins for development
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/auth', limiter);
app.use('/api/admin', limiter);

// Routes
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const tournamentRoutes = require('./routes/tournamentRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userRoutes = require('./routes/userRoutes');
const userStatsRoutes = require('./routes/userStatsRoutes');
const userTournamentsRoutes = require('./routes/userTournamentsRoutes');
const walletRoutes = require('./routes/walletRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/user', userRoutes);
app.use('/api/user/stats', userStatsRoutes);
app.use('/api/user/tournaments', userTournamentsRoutes);
app.use('/api/user/wallet', walletRoutes);

// Error handler
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

const PORT = process.env.PORT || 5002;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await initDB();
  await seedAdmin();

  // ─── SCHEDULER: Auto‑update tournament status every 60 seconds ───
  setInterval(async () => {
    try {
      await autoUpdateTournamentStatus();
    } catch (err) {
      console.error('Scheduler error:', err);
    }
  }, 60000);
  console.log('⏰ Tournament status scheduler started');
});