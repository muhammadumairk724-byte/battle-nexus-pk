const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const adminController = require('../controllers/adminController');
const registrationController = require('../controllers/registrationController');

// All routes require auth and admin role
router.use(auth, admin);

router.get('/users', adminController.getUsers);
router.put('/users/status', adminController.updateUserStatus);

router.post('/tournaments', adminController.createTournament);
router.put('/tournaments/:id', adminController.updateTournament);
router.delete('/tournaments/:id', adminController.deleteTournament);

router.get('/leaderboard', adminController.getLeaderboard);
router.put('/leaderboard', adminController.updateLeaderboard);

router.get('/stats', adminController.getStats);
router.get('/tournament-registrations', auth, admin, registrationController.getPendingRegistrations);
router.put('/tournament-registrations/:id', auth, admin, registrationController.approveRegistration);
router.put('/tournaments/:id/complete', auth, admin, adminController.completeTournament);
router.delete('/users/:id', auth, admin, adminController.deleteUser);

module.exports = router;