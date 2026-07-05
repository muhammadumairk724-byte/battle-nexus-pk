const { getPool } = require('../config/db');
const bcrypt = require('bcryptjs');

const User = {
  async create({ username, email, password, fullName, phone }) {
    const pool = getPool();
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, phone)
       VALUES (?, ?, ?, ?, ?)`,
      [username, email, hashed, fullName, phone]
    );
    return result.insertId;
  },

  async findByEmail(email) {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async updateStatus(id, status) {
    const pool = getPool();
    await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
  },

  async updateProfile(id, data) {
    const pool = getPool();
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    values.push(id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  },

  async changePassword(id, newPassword) {
    const pool = getPool();
    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashed, id]);
  },

  // ─── NEW: Verify email ───
  async verifyEmail(userId) {
    const pool = getPool();
    await pool.query('UPDATE users SET email_verified = TRUE WHERE id = ?', [userId]);
  },
};

module.exports = User;