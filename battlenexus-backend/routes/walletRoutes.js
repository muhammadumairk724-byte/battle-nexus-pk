const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const walletController = require('../controllers/walletController');

router.get('/', auth, walletController.getWallet);
router.post('/withdraw', auth, walletController.requestWithdrawal);
router.get('/transactions', auth, walletController.getTransactions);

module.exports = router;