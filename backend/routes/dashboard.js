const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    getDashboardStats,
    getImpactTimeline,
    getActionBreakdown,
    getPeerComparison,
    getNotifications,
    updatePreferences,
    exportUserData
} = require('../controllers/dashboardController');

// All dashboard routes are protected
router.use(protect);

// Main dashboard
router.get('/stats', getDashboardStats);
router.get('/timeline', getImpactTimeline);
router.get('/breakdown', getActionBreakdown);
router.get('/comparison', getPeerComparison);
router.get('/notifications', getNotifications);
router.put('/preferences', updatePreferences);
router.get('/export', exportUserData);

module.exports = router;
