const express = require('express');
const requireAuth = require('../middleware/auth');
const watchlistController = require('../controllers/watchlistController');
const router = express.Router();

router.use(requireAuth);

router.get('/', watchlistController.getWatchlist);
router.post('/', watchlistController.addToWatchlist);
router.delete('/:ticker', watchlistController.removeFromWatchlist);

module.exports = router;
