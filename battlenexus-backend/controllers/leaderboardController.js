const Leaderboard = require('../models/Leaderboard');

exports.getTop = async (req, res) => {
  try {
    const entries = await Leaderboard.getTop(10);
    res.json({ leaderboard: entries });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};