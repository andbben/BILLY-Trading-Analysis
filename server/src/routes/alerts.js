const express = require('express');
const requireAuth = require('../middleware/auth');
const alertsController = require('../controllers/alertsController');
const router = express.Router();

router.use(requireAuth);

router.get('/', alertsController.getAlerts);
router.post('/', alertsController.createAlert);
router.delete('/:id', alertsController.deleteAlert);
router.patch('/:id/toggle', alertsController.toggleAlert);

module.exports = router;
