const { getPool } = require('../config/db');

const Leaderboard = {
  async updateOrCreate({ userId, rank, score, kills, wins, total_matches, prize_won }) {
    const pool = getPool();
    const [existing] = await pool.query('SELECT id FROM leaderboard_entries WHERE user_id = ?', [userId]);
    if (existing.length > 0) {
      await pool.query(
        `UPDATE leaderboard_entries 
         SET rank = ?, score = ?, kills = ?, wins = ?, total_matches = ?, prize_won = ? 
         WHERE user_id = ?`,
        [rank, score || 0, kills || 0, wins || 0, total_matches || 0, prize_won || 0, userId]
      );
    } else {
      await pool.query(
        `INSERT INTO leaderboard_entries (user_id, rank, score, kills, wins, total_matches, prize_won)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, rank, score || 0, kills || 0, wins || 0, total_matches || 0, prize_won || 0]
      );
    }
  },

  async getTop(limit = 10) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT u.username, u.avatar_url, u.full_name, le.*
       FROM leaderboard_entries le
       JOIN users u ON le.user_id = u.id
       ORDER BY le.rank ASC
       LIMIT ?`,
      [limit]
    );
    return rows;
  },

  async delete(userId) {
    const pool = getPool();
    await pool.query('DELETE FROM leaderboard_entries WHERE user_id = ?', [userId]);
  },

  // ─── NEW: Update stats when a tournament is completed ───
  async updateStatsForTournamentCompletion(tournamentId, winnerId, prizeAmount) {
    const pool = getPool();
    
    // Get all participants for this tournament
    const [participants] = await pool.query(
      'SELECT user_id FROM tournament_participants WHERE tournament_id = ? AND status = "registered"',
      [tournamentId]
    );

    if (participants.length === 0) return;

    for (const p of participants) {
      const userId = p.user_id;
      const isWinner = Number(userId) === Number(winnerId);

      // Ensure leaderboard entry exists
      const [existing] = await pool.query('SELECT id FROM leaderboard_entries WHERE user_id = ?', [userId]);
      if (existing.length === 0) {
        await pool.query(
          `INSERT INTO leaderboard_entries (user_id, rank, score, kills, wins, losses, total_matches, prize_won)
           VALUES (?, 0, 0, 0, 0, 0, 0, 0)`,
          [userId]
        );
      }

      if (isWinner) {
        // Winner: +1 win, +1 total, + prize
        await pool.query(
          `UPDATE leaderboard_entries 
           SET wins = wins + 1, 
               total_matches = total_matches + 1, 
               prize_won = prize_won + ? 
           WHERE user_id = ?`,
          [prizeAmount || 0, userId]
        );
      } else {
        // Loser: +1 loss, +1 total (prize unchanged)
        await pool.query(
          `UPDATE leaderboard_entries 
           SET losses = losses + 1, 
               total_matches = total_matches + 1 
           WHERE user_id = ?`,
          [userId]
        );
      }
    }
  }
};

module.exports = Leaderboard;