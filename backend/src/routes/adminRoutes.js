const express = require('express');
const router = express.Router();

const adminController =
    require('../controllers/adminController');

const { requireAuth } =
    require('../middleware/auth');

// Public routes
router.post('/login',
    adminController.login);

// Public 
router.post('/',
    adminController.createAdmin);

// Protected
router.get('/',
    requireAuth,
    adminController.getAdmins);

router.get('/me',
    requireAuth,
    adminController.getMe);

module.exports = router;