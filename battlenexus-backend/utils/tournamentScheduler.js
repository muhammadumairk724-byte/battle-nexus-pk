const { getPool } = require('../config/db');

/**
 * Automatically updates tournaments from 'upcoming' to 'live'
 * when the scheduled date_time has passed.
 */
exports.autoUpdateTournamentStatus = async () => {
  const pool = getPool();
  const [result] = await pool.query(
    `UPDATE tournaments 
     SET status = 'live' 
     WHERE status = 'upcoming' AND date_time <= NOW()`
  );
  if (result.affectedRows > 0) {
    console.log(`✅ ${result.affectedRows} tournament(s) auto‑updated to 'live'`);
  }
};