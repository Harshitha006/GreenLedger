const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
    triggerVerification,
    getVerificationStatus,
    getQueueStats,
    getFraudAlerts,
    updateFraudAlert,
    getVerificationStats,
    getPendingActions,
    verifyAction
} = require('../controllers/verificationController');

// Admin routes
router.post('/trigger/:actionId', protect, authorize('admin'), triggerVerification);
router.get('/pending', protect, authorize('admin'), getPendingActions);
router.post('/verify/:actionId', protect, authorize('admin'), verifyAction);
router.get('/queue', protect, authorize('admin'), getQueueStats);
router.get('/fraud-alerts', protect, authorize('admin'), getFraudAlerts);
router.put('/fraud-alerts/:alertId', protect, authorize('admin'), updateFraudAlert);
router.get('/stats', protect, authorize('admin'), getVerificationStats);

// User routes
router.get('/status/:actionId', protect, getVerificationStatus);

module.exports = router;
