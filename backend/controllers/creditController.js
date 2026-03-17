const creditService = require('../services/creditService');
const CreditTransaction = require('../models/CreditTransaction');
const User = require('../models/User');
const Action = require('../models/Action');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../config/logger');

// @desc    Get user credit summary
// @route   GET /api/credits/summary
// @access  Private
const getCreditSummary = asyncHandler(async (req, res) => {
    const summary = await creditService.getUserCreditSummary(req.user._id);

    res.json({
        success: true,
        data: summary
    });
});

// @desc    Get user credit history
// @route   GET /api/credits/history
// @access  Private
const getCreditHistory = asyncHandler(async (req, res) => {
    const { type, page, limit } = req.query;

    const history = await creditService.getUserCreditHistory(req.user._id, {
        type,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50
    });

    res.json({
        success: true,
        data: history
    });
});

// @desc    Transfer credits to another user
// @route   POST /api/credits/transfer
// @access  Private
const transferCredits = asyncHandler(async (req, res) => {
    const { toUserId, amount, description } = req.body;

    let recipient;

    // Check if toUserId is an email or ID
    if (toUserId.includes('@')) {
        recipient = await User.findOne({ email: toUserId });
    } else {
        // Validate recipient exists
        recipient = await User.findById(toUserId);
    }

    if (!recipient) {
        res.status(404);
        throw new Error('Recipient not found');
    }

    // Prevent self-transfer
    if (recipient._id.toString() === req.user._id.toString()) {
        res.status(400);
        throw new Error('Cannot transfer credits to yourself');
    }

    const result = await creditService.transferCredits(
        req.user._id,
        recipient._id,
        amount,
        description
    );

    res.json({
        success: true,
        message: 'Credits transferred successfully',
        data: result
    });
});

// @desc    Get leaderboard
// @route   GET /api/credits/leaderboard
// @access  Public
const getLeaderboard = asyncHandler(async (req, res) => {
    const { institutionId, limit } = req.query;

    const leaderboard = await creditService.getLeaderboard({
        institutionId,
        limit: parseInt(limit) || 100
    });

    res.json({
        success: true,
        data: leaderboard
    });
});

// @desc    Get transaction by ID
// @route   GET /api/credits/transaction/:id
// @access  Private
const getTransactionById = asyncHandler(async (req, res) => {
    const transaction = await CreditTransaction.findById(req.params.id)
        .populate('fromUser', 'name email')
        .populate('toUser', 'name email')
        .populate('actionId');

    if (!transaction) {
        res.status(404);
        throw new Error('Transaction not found');
    }

    // Check if user is part of transaction
    if (transaction.fromUser?.toString() !== req.user._id.toString() &&
        transaction.toUser?.toString() !== req.user._id.toString() &&
        req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized to view this transaction');
    }

    res.json({
        success: true,
        data: transaction
    });
});

// @desc    Get all transactions (admin)
// @route   GET /api/credits/admin/transactions
// @access  Private/Admin
const getAllTransactions = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, type, status } = req.query;

    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;

    const transactions = await CreditTransaction.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate('fromUser', 'name email')
        .populate('toUser', 'name email');

    const total = await CreditTransaction.countDocuments(query);

    // Get summary stats
    const stats = await CreditTransaction.aggregate([
        {
            $match: { status: 'completed' }
        },
        {
            $group: {
                _id: '$type',
                total: { $sum: '$amount' },
                count: { $sum: 1 },
                avgAmount: { $avg: '$amount' }
            }
        }
    ]);

    res.json({
        success: true,
        data: {
            transactions,
            stats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        }
    });
});

// @desc    Get platform credit stats (admin)
// @route   GET /api/credits/admin/stats
// @access  Private/Admin
const getPlatformStats = asyncHandler(async (req, res) => {
    // Total credits in circulation
    const totalCredits = await User.aggregate([
        {
            $group: {
                _id: null,
                total: { $sum: '$walletBalance' },
                avgPerUser: { $avg: '$walletBalance' },
                maxBalance: { $max: '$walletBalance' }
            }
        }
    ]);

    // Transaction volume
    const transactionVolume = await CreditTransaction.aggregate([
        {
            $match: {
                status: 'completed',
                createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                volume: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        },
        { $sort: { '_id': 1 } }
    ]);

    // Type distribution
    const typeDistribution = await CreditTransaction.aggregate([
        {
            $match: { status: 'completed' }
        },
        {
            $group: {
                _id: '$type',
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]);

    // Fee revenue
    const feeRevenue = await CreditTransaction.aggregate([
        {
            $match: {
                'fee.amount': { $exists: true, $gt: 0 },
                status: 'completed'
            }
        },
        {
            $group: {
                _id: null,
                totalFees: { $sum: '$fee.amount' },
                avgFee: { $avg: '$fee.amount' }
            }
        }
    ]);

    res.json({
        success: true,
        data: {
            circulation: totalCredits[0] || { total: 0, avgPerUser: 0, maxBalance: 0 },
            transactionVolume,
            typeDistribution,
            feeRevenue: feeRevenue[0] || { totalFees: 0, avgFee: 0 },
            timestamp: new Date()
        }
    });
});

// @desc    Reverse a transaction (admin)
// @route   POST /api/credits/admin/reverse/:transactionId
// @access  Private/Admin
const reverseTransaction = asyncHandler(async (req, res) => {
    const { transactionId } = req.params;
    const { reason } = req.body;

    const transaction = await CreditTransaction.findById(transactionId);
    if (!transaction) {
        res.status(404);
        throw new Error('Transaction not found');
    }

    if (transaction.status === 'reversed') {
        res.status(400);
        throw new Error('Transaction already reversed');
    }

    // Start reversal process
    // This would need to reverse the wallet changes
    // For now, just mark as reversed
    transaction.status = 'reversed';
    transaction.metadata = {
        ...transaction.metadata,
        reversedAt: new Date(),
        reversedBy: req.user._id,
        reversalReason: reason
    };

    await transaction.save();

    logger.info(`Transaction ${transactionId} reversed by admin ${req.user._id}`);

    res.json({
        success: true,
        message: 'Transaction reversed',
        data: transaction
    });
});

module.exports = {
    getCreditSummary,
    getCreditHistory,
    transferCredits,
    getLeaderboard,
    getTransactionById,
    getAllTransactions,
    getPlatformStats,
    reverseTransaction
};
