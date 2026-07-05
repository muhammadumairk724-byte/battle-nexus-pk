const { getPool } = require('../config/db');

const Tournament = {
  async create({ name, game, description, rules, coverImage, format, map, dateTime, entryFee, prizePool, maxParticipants, createdBy }) {
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO tournaments 
       (name, game, description, rules, cover_image, format, map, date_time, entry_fee, prize_pool, max_participants, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, game || 'Free Fire', description, rules, coverImage, format, map, dateTime, entryFee || 0, prizePool, maxParticipants, createdBy]
    );
    return result.insertId;
  },

  async update(id, data) {
    const pool = getPool();
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    values.push(id);
    await pool.query(`UPDATE tournaments SET ${fields.join(', ')} WHERE id = ?`, values);
  },

  async delete(id) {
    const pool = getPool();
    await pool.query('DELETE FROM tournaments WHERE id = ?', [id]);
  },

  async getById(id) {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM tournaments WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async getAll(filters = {}) {
    const pool = getPool();
    let query = 'SELECT * FROM tournaments WHERE 1=1';
    const params = [];
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.format) {
      query += ' AND format = ?';
      params.push(filters.format);
    }
    if (filters.map) {
      query += ' AND map = ?';
      params.push(filters.map);
    }
    query += ' ORDER BY date_time ASC';
    const [rows] = await pool.query(query, params);
    return rows;
  },

  async getParticipants(tournamentId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url, tp.joined_at 
       FROM tournament_participants tp 
       JOIN users u ON tp.user_id = u.id 
       WHERE tp.tournament_id = ? AND tp.status = 'registered'`,
      [tournamentId]
    );
    return rows;
  },

  async joinTournament(tournamentId, userId) {
    const pool = getPool();
    // Check if already joined
    const [existing] = await pool.query(
      'SELECT id FROM tournament_participants WHERE tournament_id = ? AND user_id = ?',
      [tournamentId, userId]
    );
    if (existing.length > 0) return;

    // Increment current_participants
    await pool.query(
      'INSERT INTO tournament_participants (tournament_id, user_id) VALUES (?, ?)',
      [tournamentId, userId]
    );
    await pool.query(
      'UPDATE tournaments SET current_participants = current_participants + 1 WHERE id = ?',
      [tournamentId]
    );
  },
};

module.exports = Tournament;