const Action = require('../models/Action');
const FraudAlert = require('../models/FraudAlert');
const User = require('../models/User');
const AdminLog = require('../models/AdminLog');
const creditService = require('../services/creditService');
const verificationService = require('../services/verificationService');
const { addToVerificationQueue, getQueueStatus } = require('../jobs/verificationQueue');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../config/logger');

// @desc    Manually trigger verification
// @route   POST /api/verification/trigger/:actionId
// @access  Private/Admin
const triggerVerification = asyncHandler(async (req, res) => {
    const { actionId } = req.params;

    const action = await Action.findById(actionId);
    if (!action) {
        res.status(404);
        throw new Error('Action not found');
    }

    // Add to queue with high priority
    const job = await addToVerificationQueue(actionId, 0);

    res.json({
        success: true,
        message: 'Verification triggered',
        data: {
            jobId: job.id,
            actionId
        }
    });
});

// @desc    Get verification status
// @route   GET /api/verification/status/:actionId
// @access  Private
const getVerificationStatus = asyncHandler(async (req, res) => {
    const { actionId } = req.params;

    const action = await Action.findById(actionId)
        .select('status verificationResults verifiedAt');

    if (!action) {
        res.status(404);
        throw new Error('Action not found');
    }

    res.json({
        success: true,
        data: {
            status: action.status,
            confidence: action.verificationResults?.overallConfidence || 0,
            verifiedAt: action.verifiedAt,
            layers: action.verificationResults?.layers || {}
        }
    });
});

// @desc    Get verification queue status
// @route   GET /api/verification/queue
// @access  Private/Admin
const getQueueStats = asyncHandler(async (req, res) => {
    const status = await getQueueStatus();

    res.json({
        success: true,
        data: status
    });
});

// @desc    Get fraud alerts
// @route   GET /api/verification/fraud-alerts
// @access  Private/Admin
const getFraudAlerts = asyncHandler(async (req, res) => {
    const { status = 'new', page = 1, limit = 20 } = req.query;

    const query = {};
    if (status !== 'all') {
        query.status = status;
    }

    const alerts = await FraudAlert.find(query)
        .populate('userId', 'name email')
        .populate('actionId')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await FraudAlert.countDocuments(query);

    res.json({
        success: true,
        data: alerts,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
        }
    });
});

// @desc    Update fraud alert
// @route   PUT /api/verification/fraud-alerts/:alertId
// @access  Private/Admin
const updateFraudAlert = asyncHandler(async (req, res) => {
    const { alertId } = req.params;
    const { status, reviewNotes } = req.body;

    const alert = await FraudAlert.findById(alertId);
    if (!alert) {
        res.status(404);
        throw new Error('Fraud alert not found');
    }

    alert.status = status || alert.status;
    if (reviewNotes) alert.reviewNotes = reviewNotes;
    alert.reviewedBy = req.user._id;
    alert.reviewedAt = Date.now();

    await alert.save();

    // If confirmed fraud, take action on the associated action
    if (status === 'confirmed') {
        await Action.findByIdAndUpdate(alert.actionId, {
            status: 'rejected',
            rejectionReason: 'Confirmed fraud',
            reviewedBy: req.user._id,
            reviewedAt: Date.now()
        });

        // Potentially mark user as suspicious or ban
        await User.findByIdAndUpdate(alert.userId, {
            status: 'banned',
            $push: { flags: { type: 'fraud', reason: 'Confirmed AI fraud alert', date: new Date() } }
        });
    }

    await AdminLog.create({
        adminId: req.user._id,
        adminName: req.user.name,
        action: 'RESOLVE_FRAUD',
        targetId: alert._id,
        targetType: 'FraudAlert',
        details: { alertId, status, reviewNotes }
    });

    res.json({
        success: true,
        message: 'Fraud alert updated',
        data: alert
    });
});

// @desc    Get verification statistics
// @route   GET /api/verification/stats
// @access  Private/Admin
const getVerificationStats = asyncHandler(async (req, res) => {
    const stats = await Action.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgConfidence: { $avg: '$verificationResults.overallConfidence' }
            }
        }
    ]);

    const fraudStats = await FraudAlert.aggregate([
        {
            $group: {
                _id: '$severity',
                count: { $sum: 1 }
            }
        }
    ]);

    const queueStatus = await getQueueStatus();

    res.json({
        success: true,
        data: {
            actions: stats,
            fraud: fraudStats,
            queue: queueStatus,
            timestamp: new Date()
        }
    });
});

// @desc    Get actions pending manual review
// @route   GET /api/verification/pending
// @access  Private/Admin
const getPendingActions = asyncHandler(async (req, res) => {
    const { status = 'needs_review', page = 1, limit = 20 } = req.query;

    const query = {};
    if (status !== 'all') {
        query.status = status;
    }

    const actions = await Action.find(query)
        .populate('userId', 'name email')
        .sort({ createdAt: 1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Action.countDocuments(query);

    res.json({
        success: true,
        data: actions,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
        }
    });
});

// @desc    Manually verify (approve/reject) action
// @route   POST /api/verification/verify/:actionId
// @access  Private/Admin
const verifyAction = asyncHandler(async (req, res) => {
    const { actionId } = req.params;
    const { status, reviewNotes, rejectionReason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
        res.status(400);
        throw new Error('Invalid status. Use approved or rejected');
    }

    const action = await Action.findById(actionId);
    if (!action) {
        res.status(404);
        throw new Error('Action not found');
    }

    action.status = status;
    action.reviewNotes = reviewNotes;
    action.rejectionReason = rejectionReason;
    action.reviewedBy = req.user._id;
    action.reviewedAt = Date.now();
    
    // If approved, trigger credit issuance
    if (status === 'approved') {
        try {
            await creditService.issueCreditsForAction(actionId);
            action.verificationResults.verifiedBy = 'admin';
            action.verificationResults.verifiedAt = Date.now();
        } catch (creditError) {
            logger.error(`Failed to issue credits for action ${actionId}:`, creditError);
            // We'll still save the status but the credit issuance might need manual retry or is already handled
        }
    }

    await action.save();

    await AdminLog.create({
        adminId: req.user._id,
        adminName: req.user.name,
        action: status === 'approved' ? 'APPROVE_ACTION' : 'REJECT_ACTION',
        targetId: action._id,
        targetType: 'Action',
        details: { actionId, status, reviewNotes, rejectionReason }
    });

    res.json({
        success: true,
        message: `Action ${status} successfully`,
        data: action
    });
});

module.exports = {
    triggerVerification,
    getVerificationStatus,
    getQueueStats,
    getFraudAlerts,
    updateFraudAlert,
    getVerificationStats,
    getPendingActions,
    verifyAction
};
