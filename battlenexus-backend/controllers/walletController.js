const { getPool } = require('../config/db');
const Notification = require('../models/Notification');

exports.getWallet = async (req, res) => {
    try {
        const userId = req.user.id;
        const pool = getPool();

        // Get total earnings (prize won)
        const [earnings] = await pool.query(
            'SELECT SUM(prize_won) as total FROM leaderboard_entries WHERE user_id = ?',
            [userId]
        );

        // Get pending withdrawals (if any) - we'll use a simple approach
        // For now, we'll simulate a balance
        const balance = earnings[0]?.total || 0;

        res.json({
            balance: balance,
            total_earned: balance,
            pending_withdrawal: 0,
            currency: 'PKR'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.requestWithdrawal = async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, method } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        // Check balance
        const pool = getPool();
        const [earnings] = await pool.query(
            'SELECT SUM(prize_won) as total FROM leaderboard_entries WHERE user_id = ?',
            [userId]
        );
        const balance = earnings[0]?.total || 0;

        if (amount > balance) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // In a real system, you'd create a withdrawal request record
        // For now, we'll send a notification to admin
        const adminRows = await pool.query('SELECT id FROM users WHERE role = "admin"');
        const adminIds = adminRows[0].map(row => row.id);
        for (const adminId of adminIds) {
            await Notification.create(adminId, 'Withdrawal Request', `User ID ${userId} requested withdrawal of Rs ${amount} via ${method || 'EasyPaisa'}`);
        }

        await Notification.create(userId, 'Withdrawal Requested', `Your withdrawal request of Rs ${amount} has been submitted for processing.`);

        res.json({ message: 'Withdrawal request submitted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getTransactions = async (req, res) => {
    try {
        const userId = req.user.id;
        const pool = getPool();

        // Get tournament winnings as transactions
        const [rows] = await pool.query(
            `SELECT 
                t.name as description,
                'earned' as type,
                le.prize_won as amount,
                t.date_time as created_at
            FROM leaderboard_entries le
            JOIN users u ON le.user_id = u.id
            LEFT JOIN tournament_participants tp ON tp.user_id = le.user_id
            LEFT JOIN tournaments t ON tp.tournament_id = t.id
            WHERE le.user_id = ? AND le.prize_won > 0
            ORDER BY t.date_time DESC`,
            [userId]
        );

        res.json({ transactions: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};