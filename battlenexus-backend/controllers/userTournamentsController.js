const { getPool } = require('../config/db');

exports.getTournaments = async (req, res) => {
    try {
        const userId = req.user.id;
        const pool = getPool();

        // Get all tournaments the user has joined with status
        const [rows] = await pool.query(
            `SELECT 
                t.id, t.name, t.format, t.map, t.date_time, t.prize_pool, t.status as tournament_status,
                tp.joined_at, tp.status as participant_status,
                le.wins, le.prize_won,
                CASE 
                    WHEN t.status = 'live' THEN 'ongoing'
                    WHEN t.status = 'upcoming' THEN 'upcoming'
                    WHEN t.status = 'completed' AND le.wins > 0 THEN 'won'
                    WHEN t.status = 'completed' AND (le.wins = 0 OR le.wins IS NULL) THEN 'lost'
                    ELSE 'upcoming'
                END as player_status
            FROM tournament_participants tp
            JOIN tournaments t ON tp.tournament_id = t.id
            LEFT JOIN leaderboard_entries le ON le.user_id = tp.user_id
            WHERE tp.user_id = ?
            ORDER BY t.date_time DESC`,
            [userId]
        );

        res.json({ tournaments: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};