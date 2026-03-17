const AdminLog = require('../models/AdminLog');
const User = require('../models/User');
const Action = require('../models/Action');
const Institution = require('../models/Institution');
const CreditTransaction = require('../models/CreditTransaction');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../config/logger');

// @desc    Get administrative logs
// @route   GET /api/admin/logs
// @access  Private/Admin
const getAdminLogs = asyncHandler(async (req, res) => {
    const { action, targetType, page = 1, limit = 50 } = req.query;

    const query = {};
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;

    const logs = await AdminLog.find(query)
        .populate('adminId', 'name email role')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await AdminLog.countDocuments(query);

    res.json({
        success: true,
        data: logs,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
        }
    });
});

// @desc    Get system-wide analytics for admin
// @route   GET /api/admin/system-stats
// @access  Private/Admin
const getSystemStats = asyncHandler(async (req, res) => {
    const [
        userCount,
        actionCount,
        institutionCount,
        creditStats,
        last24hLogs
    ] = await Promise.all([
        User.countDocuments(),
        Action.countDocuments(),
        Institution.countDocuments(),
        CreditTransaction.aggregate([
            {
                $group: {
                    _id: null,
                    totalCredits: { $sum: '$amount' },
                    avgTransaction: { $avg: '$amount' }
                }
            }
        ]),
        AdminLog.countDocuments({
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        })
    ]);

    res.json({
        success: true,
        data: {
            counts: {
                users: userCount,
                actions: actionCount,
                institutions: institutionCount,
                adminLogs24h: last24hLogs
            },
            credits: creditStats[0] || { totalCredits: 0, avgTransaction: 0 },
            timestamp: new Date()
        }
    });
});

// @desc    Get user management list
// @route   GET /api/admin/users
// @access  Private/Admin
const getUsersAdmin = asyncHandler(async (req, res) => {
    const { role, status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (role) query.role = role;
    if (status) query.status = status;

    const users = await User.find(query)
        .select('-password')
        .populate('institutionId', 'name')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
        success: true,
        data: users,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
        }
    });
});

// @desc    Update user status or role
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
const updateUserStatus = asyncHandler(async (req, res) => {
    const { role, status } = req.body;
    const userId = req.params.id;

    const user = await User.findById(userId);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (role) user.role = role;
    if (status) user.status = status;

    await user.save();

    await AdminLog.create({
        adminId: req.user._id,
        adminName: req.user.name,
        action: 'UPDATE_USER',
        targetId: user._id,
        targetType: 'User',
        details: { role, status }
    });

    res.json({
        success: true,
        message: 'User updated successfully',
        data: user
    });
});

module.exports = {
    getAdminLogs,
    getSystemStats,
    getUsersAdmin,
    updateUserStatus
};
