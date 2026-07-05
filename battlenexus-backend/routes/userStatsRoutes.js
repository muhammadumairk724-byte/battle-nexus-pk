const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const userStatsController = require('../controllers/userStatsController');

router.get('/', auth, userStatsController.getStats);

module.exports = router;