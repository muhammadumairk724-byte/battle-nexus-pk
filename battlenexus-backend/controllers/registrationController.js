const { getPool } = require('../config/db');
const Notification = require('../models/Notification');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─── Configure multer for file uploads ───
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads/screenshots';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// ─── Registration endpoint (with file upload) ───
exports.registerForTournament = async (req, res) => {
  // Use multer to handle the single file 'screenshot'
  upload.single('screenshot')(req, res, async function(err) {
    if (err) {
      return res.status(400).json({ error: 'File upload error: ' + err.message });
    }

    try {
      const { id: tournamentId } = req.params;
      const userId = req.user.id;

      // Extract text fields (some may be JSON strings)
      const { playerName, uid, paymentMethod, transactionId, teamName, uids, whatsapp, email } = req.body;
      // uids is sent as JSON string, so parse it
      const parsedUids = uids ? JSON.parse(uids) : [];

      // Basic validation
      if (!playerName || !uid || !transactionId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const pool = getPool();

      // Check existing registration
      const [existing] = await pool.query(
        'SELECT id, status FROM tournament_participants WHERE tournament_id = ? AND user_id = ? AND status != "dropped"',
        [tournamentId, userId]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'You are already registered for this tournament' });
      }

      // Check tournament capacity
      const [tourn] = await pool.query('SELECT name, max_participants, current_participants FROM tournaments WHERE id = ?', [tournamentId]);
      if (tourn.length === 0) return res.status(404).json({ error: 'Tournament not found' });
      if (tourn[0].current_participants >= tourn[0].max_participants) {
        return res.status(400).json({ error: 'Tournament is full' });
      }

      // Save screenshot URL if uploaded
      let screenshotUrl = null;
      if (req.file) {
        screenshotUrl = '/uploads/screenshots/' + req.file.filename;
      }

      // Insert pending registration with screenshot URL
      await pool.query(
        `INSERT INTO tournament_participants 
         (tournament_id, user_id, status, screenshot_url) 
         VALUES (?, ?, 'pending', ?)`,
        [tournamentId, userId, screenshotUrl]
      );

      // Notify admins
      const [admins] = await pool.query('SELECT id FROM users WHERE role = "admin"');
      for (const admin of admins) {
        await Notification.create(
          admin.id,
          'New Tournament Registration',
          `User ${req.user.username} has registered for "${tourn[0].name}" and is pending approval.`
        );
      }

      res.status(201).json({ message: 'Registration submitted for approval' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });
};

// ─── Get pending registrations (includes screenshot_url) ───
exports.getPendingRegistrations = async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT tp.id, tp.tournament_id, tp.user_id, tp.joined_at, tp.screenshot_url,
              u.username, u.email, 
              t.name as tournament_name
       FROM tournament_participants tp
       JOIN users u ON tp.user_id = u.id
       JOIN tournaments t ON tp.tournament_id = t.id
       WHERE tp.status = 'pending'
       ORDER BY tp.joined_at ASC`
    );
    res.json({ registrations: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── Approve/Reject Registration (unchanged) ───
exports.approveRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectReason } = req.body;
    const pool = getPool();

    const [reg] = await pool.query('SELECT user_id, tournament_id FROM tournament_participants WHERE id = ? AND status = "pending"', [id]);
    if (reg.length === 0) return res.status(404).json({ error: 'Registration not found' });

    if (action === 'approve') {
      await pool.query('UPDATE tournament_participants SET status = "registered" WHERE id = ?', [id]);
      await pool.query('UPDATE tournaments SET current_participants = current_participants + 1 WHERE id = ?', [reg[0].tournament_id]);
      const [tourn] = await pool.query('SELECT name FROM tournaments WHERE id = ?', [reg[0].tournament_id]);
      await Notification.create(reg[0].user_id, 'Registration Approved', `Your registration for "${tourn[0].name}" has been approved! You are now a participant.`);
    } else if (action === 'reject') {
      await pool.query('UPDATE tournament_participants SET status = "dropped" WHERE id = ?', [id]);
      const reason = rejectReason || 'No reason provided';
      const [tourn] = await pool.query('SELECT name FROM tournaments WHERE id = ?', [reg[0].tournament_id]);
      await Notification.create(reg[0].user_id, 'Registration Rejected', `Your registration for "${tourn[0].name}" was rejected. Reason: ${reason}`);
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    res.json({ message: `Registration ${action}d successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};