const express = require('express');
const marketController = require('../controllers/marketController');
const router = express.Router();

router.get('/quote/:symbol', marketController.getQuote);
router.get('/candles/:symbol', marketController.getCandles);
router.get('/news', marketController.getMarketNews);
router.get('/company-news/:symbol', marketController.getCompanyNews);
router.post('/news/analyze', marketController.analyzeNews);

module.exports = router;
