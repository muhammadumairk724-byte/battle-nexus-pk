const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

router.get('/', auth, notificationController.getNotifications);
router.put('/read/:id?', auth, notificationController.markRead);
router.get('/unread-count', auth, notificationController.getUnreadCount);
router.delete('/:id', auth, notificationController.deleteNotification); // <-- ADD THIS

module.exports = router;