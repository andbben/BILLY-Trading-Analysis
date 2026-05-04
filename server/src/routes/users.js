const express = require('express');
const requireAuth = require('../middleware/auth');
const usersController = require('../controllers/usersController');
const router = express.Router();

router.use(requireAuth);

router.get('/profile', usersController.getProfile);
router.patch('/profile', usersController.updateProfile);
router.patch('/plan', usersController.updatePlan);

module.exports = router;
