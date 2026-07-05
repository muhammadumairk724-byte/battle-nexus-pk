const express = require('express');
const router = express.Router();
const tournamentController = require('../controllers/tournamentController');
const auth = require('../middleware/auth');
const registrationController = require('../controllers/registrationController');

router.get('/', tournamentController.getAll);
router.get('/:id', tournamentController.getById);
router.get('/:id/participants', tournamentController.getParticipants);
router.post('/:id/join', auth, tournamentController.joinTournament);
router.get('/:id/check-join', auth, tournamentController.checkJoin);
router.post('/:id/register', auth, registrationController.registerForTournament);

module.exports = router;