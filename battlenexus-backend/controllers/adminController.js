const { getPool } = require('../config/db');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Tournament = require('../models/Tournament');
const Leaderboard = require('../models/Leaderboard');

// ── User Management ──
exports.getUsers = async (req, res) => {
  try {
    const { status, search } = req.query;
    const pool = getPool();
    let query = 'SELECT id, username, email, full_name, phone, role, status, created_at, last_login FROM users WHERE 1=1';
    const params = [];
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (search) {
      query += ' AND (username LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    const [rows] = await pool.query(query, params);
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { userId, status, rejectReason } = req.body;
    if (!['pending', 'active', 'blocked'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await User.updateStatus(userId, status);

    let message = '';
    if (status === 'active') {
      message = 'Your account has been approved! You can now join tournaments on BattleNexus.';
    } else if (status === 'blocked') {
      message = rejectReason ? `Your account has been rejected. Reason: ${rejectReason}` : 'Your account has been rejected.';
    } else if (status === 'pending') {
      message = 'Your account status is pending again.';
    }
    if (message) {
      await Notification.create(userId, 'Account Status Update', message);
    }

    res.json({ message: `User status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ── Tournament Management ──
exports.createTournament = async (req, res) => {
  try {
    const data = req.body;
    const userId = req.user.id;
    const tournamentId = await Tournament.create({ ...data, createdBy: userId });
    const pool = getPool();
    const [users] = await pool.query('SELECT id FROM users WHERE status = "active"');
    for (const user of users) {
      await Notification.create(user.id, 'New Tournament Published', `A new tournament "${data.name}" is now open for registration!`);
    }
    res.status(201).json({ message: 'Tournament created', tournamentId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const pool = getPool();
    const [existing] = await pool.query('SELECT status FROM tournaments WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Tournament not found' });

    await Tournament.update(id, data);

    if (data.status === 'live' && existing[0].status !== 'live') {
      const [participants] = await pool.query(
        'SELECT user_id FROM tournament_participants WHERE tournament_id = ?',
        [id]
      );
      const tournamentName = await Tournament.getById(id).then(t => t.name);
      for (const p of participants) {
        await Notification.create(p.user_id, 'Tournament Live', `The tournament "${tournamentName}" is now live! You can join the match now.`);
      }
    }

    res.json({ message: 'Tournament updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteTournament = async (req, res) => {
  try {
    const { id } = req.params;
    await Tournament.delete(id);
    res.json({ message: 'Tournament deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Leaderboard Management ──
exports.getLeaderboard = async (req, res) => {
  try {
    const entries = await Leaderboard.getTop(10);
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateLeaderboard = async (req, res) => {
  try {
    const { entries } = req.body;
    for (const entry of entries) {
      await Leaderboard.updateOrCreate(entry);
      if (entry.rank <= 10) {
        const user = await User.findById(entry.userId);
        if (user) {
          await Notification.create(entry.userId, 'Leaderboard Update', `Your leaderboard rank has been updated to #${entry.rank}.`);
        }
      }
    }
    res.json({ message: 'Leaderboard updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin Stats ──
exports.getStats = async (req, res) => {
  try {
    const pool = getPool();
    const [usersTotal] = await pool.query('SELECT COUNT(*) as total FROM users');
    const [pendingUsers] = await pool.query('SELECT COUNT(*) as pending FROM users WHERE status = "pending"');
    const [tournaments] = await pool.query('SELECT COUNT(*) as total FROM tournaments');
    const [live] = await pool.query('SELECT COUNT(*) as live FROM tournaments WHERE status = "live"');
    res.json({
      users: usersTotal[0].total,
      pending: pendingUsers[0].pending,
      tournaments: tournaments[0].total,
      live: live[0].live,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ─── NEW: Complete Tournament & Declare Winner ───
exports.completeTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const { winnerEmail } = req.body;
    const pool = getPool();

    if (!winnerEmail) {
      return res.status(400).json({ error: 'Winner email is required' });
    }

    // 1. Get tournament
    const [tourn] = await pool.query('SELECT * FROM tournaments WHERE id = ?', [id]);
    if (tourn.length === 0) return res.status(404).json({ error: 'Tournament not found' });
    const tournament = tourn[0];

    if (tournament.status !== 'live') {
      return res.status(400).json({ error: 'Tournament is not live. Cannot complete.' });
    }

    // 2. Find winner user
    const winner = await User.findByEmail(winnerEmail.trim());
    if (!winner) return res.status(404).json({ error: 'Winner email is not registered' });

    // 3. Check if winner is a participant
    const [participant] = await pool.query(
      'SELECT id FROM tournament_participants WHERE tournament_id = ? AND user_id = ? AND status = "registered"',
      [id, winner.id]
    );
    if (participant.length === 0) {
      return res.status(400).json({ error: 'Winner is not a participant of this tournament' });
    }

    // 4. Update tournament
    await pool.query(
      'UPDATE tournaments SET status = "completed", winner_id = ? WHERE id = ?',
      [winner.id, id]
    );

    // 5. Update participant statuses (optional, for tracking)
    await pool.query(
      'UPDATE tournament_participants SET status = "completed" WHERE tournament_id = ?',
      [id]
    );

    // 6. Update leaderboard stats
    const prizeAmount = tournament.prize_pool || 0;
    await Leaderboard.updateStatsForTournamentCompletion(id, winner.id, prizeAmount);

    // 7. Notify all participants
    const [participants] = await pool.query(
      'SELECT user_id FROM tournament_participants WHERE tournament_id = ?',
      [id]
    );
    for (const p of participants) {
      const userId = p.user_id;
      if (Number(userId) === Number(winner.id)) {
        await Notification.create(
          userId,
          '🏆 Tournament Won!',
          `Congratulations! You won "${tournament.name}" and earned Rs ${prizeAmount.toLocaleString()}.`
        );
      } else {
        await Notification.create(
          userId,
          '🏁 Tournament Completed',
          `The tournament "${tournament.name}" has ended. Better luck next time!`
        );
      }
    }

    res.json({ message: `Tournament "${tournament.name}" completed. Winner: ${winner.username} (${winner.email})` });
  } catch (err) {
    console.error('Complete tournament error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
// ─── Delete User ───
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    // Prevent admin from deleting themselves
    if (Number(id) === Number(currentUserId)) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const pool = getPool();
    const [user] = await pool.query('SELECT id, role FROM users WHERE id = ?', [id]);
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Optional: prevent deleting other admin accounts (only if you want)
    // if (user[0].role === 'admin') {
    //   return res.status(403).json({ error: 'Cannot delete admin accounts.' });
    // }

    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};