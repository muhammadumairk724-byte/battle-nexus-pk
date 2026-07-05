const { getPool } = require('../config/db');

const Notification = {
  async create(userId, title, message, relatedId = null) {
    const pool = getPool();
    await pool.query(
      'INSERT INTO notifications (user_id, title, message, related_id) VALUES (?, ?, ?, ?)',
      [userId, title, message, relatedId]
    );
  },

  async getByUser(userId, limit = 50) {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
    return rows;
  },

  async markRead(userId, notificationId = null) {
    const pool = getPool();
    if (notificationId) {
      await pool.query('UPDATE notifications SET `read` = TRUE WHERE id = ? AND user_id = ?', [notificationId, userId]);
    } else {
      await pool.query('UPDATE notifications SET `read` = TRUE WHERE user_id = ?', [userId]);
    }
  },

  async getUnreadCount(userId) {
    const pool = getPool();
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND `read` = FALSE', [userId]);
    return rows[0].count;
  }
};

module.exports = Notification;