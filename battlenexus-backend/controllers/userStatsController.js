const { getPool } = require('../config/db');

exports.getStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const pool = getPool();

        // Total tournaments joined
        const [joined] = await pool.query(
            'SELECT COUNT(*) as count FROM tournament_participants WHERE user_id = ?',
            [userId]
        );

        // Wins (from leaderboard entries)
        const [leaderboard] = await pool.query(
            'SELECT wins, prize_won FROM leaderboard_entries WHERE user_id = ?',
            [userId]
        );

        // Losses (tournaments participated but not won)
        const [participated] = await pool.query(
            'SELECT COUNT(*) as count FROM tournament_participants tp JOIN tournaments t ON tp.tournament_id = t.id WHERE tp.user_id = ? AND t.status = "completed"',
            [userId]
        );

        const wins = leaderboard.length > 0 ? leaderboard[0].wins || 0 : 0;
        const prizeWon = leaderboard.length > 0 ? leaderboard[0].prize_won || 0 : 0;
        const losses = Math.max(0, (participated[0]?.count || 0) - wins);

        res.json({
            joined: joined[0]?.count || 0,
            wins: wins,
            losses: losses,
            earnings: prizeWon
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};