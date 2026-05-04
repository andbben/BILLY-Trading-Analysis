const express = require('express');
const requireAuth = require('../middleware/auth');
const portfolioController = require('../controllers/portfolioController');
const router = express.Router();

router.use(requireAuth);

router.get('/', portfolioController.getPortfolio);
router.post('/positions', portfolioController.addPosition);
router.post('/trades', portfolioController.executeTrade);
router.delete('/positions/:ticker', portfolioController.deletePosition);

module.exports = router;
