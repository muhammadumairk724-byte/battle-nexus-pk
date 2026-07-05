const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const userTournamentsController = require('../controllers/userTournamentsController');

router.get('/', auth, userTournamentsController.getTournaments);

module.exports = router;