const { getPool } = require('../config/db');

exports.autoUpdateTournamentStatus = async () => {
  const pool = getPool();
  // Update upcoming tournaments whose date_time has passed
  await pool.query(
    `UPDATE tournaments 
     SET status = 'live' 
     WHERE status = 'upcoming' AND date_time <= NOW()`
  );
  console.log('✅ Tournament statuses updated');
};