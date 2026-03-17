const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
    getAdminLogs,
    getSystemStats,
    getUsersAdmin,
    updateUserStatus
} = require('../controllers/adminController');

// All routes are protected and admin only
router.use(protect);
router.use(authorize('admin'));

// Admin specialized routes
router.get('/logs', getAdminLogs);
router.get('/system-stats', getSystemStats);
router.get('/users', getUsersAdmin);
router.put('/users/:id', updateUserStatus);

module.exports = router;
