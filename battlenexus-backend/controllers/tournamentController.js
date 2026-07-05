const Tournament = require('../models/Tournament');
const Notification = require('../models/Notification');

exports.getAll = async (req, res) => {
  try {
    const { status, format, map } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (format) filters.format = format;
    if (map) filters.map = map;
    const tournaments = await Tournament.getAll(filters);
    res.json({ tournaments });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const tournament = await Tournament.getById(id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    res.json({ tournament });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getParticipants = async (req, res) => {
  try {
    const { id } = req.params;
    const participants = await Tournament.getParticipants(id);
    res.json({ participants });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.joinTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check user status
    if (req.user.status !== 'active') {
      return res.status(403).json({ error: 'Your account is not approved yet' });
    }

    // Check tournament status
    const tournament = await Tournament.getById(id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.status !== 'upcoming' && tournament.status !== 'live') {
      return res.status(400).json({ error: 'Tournament is not open for registration' });
    }
    if (tournament.current_participants >= tournament.max_participants) {
      return res.status(400).json({ error: 'Tournament is full' });
    }

    await Tournament.joinTournament(id, userId);
    // Notify user
    await Notification.create(userId, 'Tournament Joined', `You have successfully joined "${tournament.name}"`);

    res.json({ message: 'Joined successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.checkJoin = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const pool = getPool();
        const [rows] = await pool.query(
            'SELECT id, status FROM tournament_participants WHERE tournament_id = ? AND user_id = ?',
            [id, userId]
        );

        res.json({ 
            registered: rows.length > 0,
            status: rows.length > 0 ? rows[0].status : null
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};