const express = require('express');
const requireAuth = require('../middleware/auth');
const portfolioController = require('../controllers/portfolioController');
const router = express.Router();

router.use(requireAuth);

router.get('/', portfolioController.getPortfolio);
router.get('/transfers', portfolioController.getTransfers);
router.post('/positions', portfolioController.addPosition);
router.post('/trades', portfolioController.executeTrade);
router.post('/accounts/billy', portfolioController.createBillyAccount);
router.post('/accounts/bank', portfolioController.connectBankAccount);
router.post('/transfers', portfolioController.createTransfer);
router.post('/transfers/shares', portfolioController.createShareTransfer);
router.delete('/positions/:ticker', portfolioController.deletePosition);

module.exports = router;
