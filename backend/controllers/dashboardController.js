const User = require('../models/User');
const Action = require('../models/Action');
const CreditTransaction = require('../models/CreditTransaction');
const Institution = require('../models/Institution');
const Competition = require('../models/Competition');
const asyncHandler = require('../utils/asyncHandler');
const mongoose = require('mongoose');
const logger = require('../config/logger');

// @desc    Get user dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Get user with populated data
    const user = await User.findById(userId)
        .populate('institutionId', 'name type logo');

    // Get recent actions
    const recentActions = await Action.find({ userId })
        .sort({ createdAt: -1 })
        .limit(5);

    // Get credit summary
    const creditSummary = await CreditTransaction.aggregate([
        {
            $match: {
                $or: [
                    { fromUser: new mongoose.Types.ObjectId(userId) },
                    { toUser: new mongoose.Types.ObjectId(userId) }
                ],
                status: 'completed'
            }
        },
        {
            $group: {
                _id: '$type',
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]);

    // Get monthly impact
    const monthlyImpact = await Action.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                status: 'approved',
                createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                },
                co2Saved: { $sum: '$impact.co2SavedKg' },
                credits: { $sum: '$impact.creditsEarned' },
                actions: { $sum: 1 }
            }
        },
        { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } }
    ]);

    // Get active competitions
    const activeCompetitions = await Competition.find({
        $or: [
            { institutionId: user.institutionId },
            { 'participants.userId': userId }
        ],
        status: 'active',
        endDate: { $gt: new Date() }
    }).limit(3);

    // Get institution rank if applicable
    let institutionRank = null;
    if (user.institutionId) {
        const rank = await User.aggregate([
            {
                $match: {
                    institutionId: user.institutionId,
                    sustainabilityScore: { $gt: user.sustainabilityScore }
                }
            },
            { $count: 'rank' }
        ]);
        institutionRank = (rank[0]?.rank || 0) + 1;
    }

    // Calculate achievements
    const achievements = await calculateAchievements(userId);

    res.json({
        success: true,
        data: {
            user: {
                name: user.name,
                email: user.email,
                role: user.role,
                profileImage: user.profileImage,
                institution: user.institutionId,
                walletBalance: user.walletBalance,
                sustainabilityScore: user.sustainabilityScore,
                totalCO2Saved: user.totalCO2Saved,
                totalEnergySaved: user.totalEnergySaved,
                totalWaterSaved: user.totalWaterSaved,
                verifiedActionsCount: user.verifiedActionsCount,
                institutionRank
            },
            creditSummary,
            recentActions,
            monthlyImpact,
            activeCompetitions,
            achievements,
            lastUpdated: new Date()
        }
    });
});

// @desc    Get impact timeline
// @route   GET /api/dashboard/timeline
// @access  Private
const getImpactTimeline = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { period = 'month' } = req.query;

    let dateFilter;
    const now = new Date();

    switch (period) {
        case 'week':
            dateFilter = { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) };
            break;
        case 'month':
            dateFilter = { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) };
            break;
        case 'year':
            dateFilter = { $gte: new Date(now - 365 * 24 * 60 * 60 * 1000) };
            break;
        default:
            dateFilter = { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) };
    }

    const timeline = await Action.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                status: 'approved',
                createdAt: dateFilter
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                },
                co2Saved: { $sum: '$impact.co2SavedKg' },
                credits: { $sum: '$impact.creditsEarned' },
                actions: { $sum: 1 },
                energySaved: { $sum: '$impact.energySavedKwh' },
                waterSaved: { $sum: '$impact.waterSavedL' }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    res.json({
        success: true,
        data: {
            period,
            timeline,
            total: timeline.reduce((acc, day) => ({
                co2Saved: acc.co2Saved + day.co2Saved,
                credits: acc.credits + day.credits,
                actions: acc.actions + day.actions
            }), { co2Saved: 0, credits: 0, actions: 0 })
        }
    });
});

// @desc    Get action breakdown by type
// @route   GET /api/dashboard/breakdown
// @access  Private
const getActionBreakdown = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const breakdown = await Action.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                status: 'approved'
            }
        },
        {
            $group: {
                _id: '$actionType',
                count: { $sum: 1 },
                totalCredits: { $sum: '$impact.creditsEarned' },
                totalCO2: { $sum: '$impact.co2SavedKg' }
            }
        },
        {
            $project: {
                type: '$_id',
                count: 1,
                totalCredits: 1,
                totalCO2: 1,
                percentage: {
                    $multiply: [
                        { $divide: ['$count', { $sum: '$count' }] },
                        100
                    ]
                }
            }
        },
        { $sort: { count: -1 } }
    ]);

    res.json({
        success: true,
        data: breakdown
    });
});

// @desc    Get comparison with peers
// @route   GET /api/dashboard/comparison
// @access  Private
const getPeerComparison = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const user = await User.findById(userId);

    let comparison = {
        global: {},
        institutional: {}
    };

    // Global comparison
    const globalStats = await User.aggregate([
        {
            $group: {
                _id: null,
                avgScore: { $avg: '$sustainabilityScore' },
                avgCredits: { $avg: '$walletBalance' },
                avgCO2: { $avg: '$totalCO2Saved' },
                topScore: { $max: '$sustainabilityScore' },
                topCredits: { $max: '$walletBalance' },
                topCO2: { $max: '$totalCO2Saved' }
            }
        }
    ]);

    if (globalStats[0]) {
        comparison.global = {
            average: {
                score: Math.round(globalStats[0].avgScore),
                credits: Math.round(globalStats[0].avgCredits),
                co2: Math.round(globalStats[0].avgCO2)
            },
            top: {
                score: globalStats[0].topScore,
                credits: globalStats[0].topCredits,
                co2: globalStats[0].topCO2
            },
            userPercentile: {
                score: await calculatePercentile(userId, 'sustainabilityScore'),
                credits: await calculatePercentile(userId, 'walletBalance'),
                co2: await calculatePercentile(userId, 'totalCO2Saved')
            }
        };
    }

    // Institutional comparison
    if (user.institutionId) {
        const instStats = await User.aggregate([
            {
                $match: { institutionId: user.institutionId }
            },
            {
                $group: {
                    _id: null,
                    avgScore: { $avg: '$sustainabilityScore' },
                    avgCredits: { $avg: '$walletBalance' },
                    avgCO2: { $avg: '$totalCO2Saved' },
                    totalMembers: { $sum: 1 },
                    topScore: { $max: '$sustainabilityScore' },
                    topCredits: { $max: '$walletBalance' },
                    topCO2: { $max: '$totalCO2Saved' }
                }
            }
        ]);

        if (instStats[0]) {
            comparison.institutional = {
                average: {
                    score: Math.round(instStats[0].avgScore),
                    credits: Math.round(instStats[0].avgCredits),
                    co2: Math.round(instStats[0].avgCO2)
                },
                top: {
                    score: instStats[0].topScore,
                    credits: instStats[0].topCredits,
                    co2: instStats[0].topCO2
                },
                totalMembers: instStats[0].totalMembers,
                rank: await getInstitutionRank(userId, user.institutionId)
            };
        }
    }

    res.json({
        success: true,
        data: comparison
    });
});

// @desc    Get notifications
// @route   GET /api/dashboard/notifications
// @access  Private
const getNotifications = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Get unread notifications from various sources
    const [pendingActions, completedActions, competitions, fraudAlerts] = await Promise.all([
        Action.countDocuments({ userId, status: 'pending' }),
        Action.countDocuments({
            userId,
            status: 'approved',
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }),
        Competition.countDocuments({
            'participants.userId': userId,
            status: 'active',
            endDate: { $lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }
        }),
        // Fraud alerts would be from a notifications collection
    ]);

    const notifications = [];



    if (completedActions > 0) {
        notifications.push({
            type: 'success',
            title: 'New credits earned',
            message: `${completedActions} action${completedActions > 1 ? 's' : ''} were approved this week`,
            icon: '✅',
            priority: 'medium',
            link: '/wallet'
        });
    }

    if (competitions > 0) {
        notifications.push({
            type: 'warning',
            title: 'Competitions ending soon',
            message: `${competitions} competition${competitions > 1 ? 's' : ''} ending in 3 days`,
            icon: '🏆',
            priority: 'medium',
            link: '/competitions'
        });
    }

    // Add achievement notifications
    const achievements = await checkNewAchievements(userId);
    notifications.push(...achievements);

    res.json({
        success: true,
        data: {
            count: notifications.length,
            notifications: notifications.slice(0, 10)
        }
    });
});

// @desc    Update user preferences
// @route   PUT /api/dashboard/preferences
// @access  Private
const updatePreferences = asyncHandler(async (req, res) => {
    const { preferences } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    user.preferences = {
        ...user.preferences,
        ...preferences
    };

    await user.save();

    res.json({
        success: true,
        message: 'Preferences updated',
        data: user.preferences
    });
});

// @desc    Export user data
// @route   GET /api/dashboard/export
// @access  Private
const exportUserData = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const [user, actions, transactions] = await Promise.all([
        User.findById(userId).select('-password -emailVerificationToken -passwordResetToken'),
        Action.find({ userId }).sort({ createdAt: -1 }),
        CreditTransaction.find({
            $or: [
                { fromUser: userId },
                { toUser: userId }
            ]
        }).sort({ createdAt: -1 })
    ]);

    const exportData = {
        user: user.toObject(),
        stats: {
            totalActions: actions.length,
            totalCredits: user.totalCreditsEarned,
            totalCO2: user.totalCO2Saved,
            memberSince: user.createdAt
        },
        actions: actions.map(a => ({
            id: a._id,
            type: a.actionType,
            date: a.createdAt,
            status: a.status,
            credits: a.impact?.creditsEarned || 0,
            co2: a.impact?.co2SavedKg || 0
        })),
        transactions: transactions.map(t => ({
            id: t._id,
            type: t.type,
            amount: t.amount,
            date: t.createdAt,
            description: t.description
        }))
    };

    res.json({
        success: true,
        data: exportData
    });
});

// Helper Functions
const calculateAchievements = async (userId) => {
    const user = await User.findById(userId);
    const actions = await Action.find({ userId, status: 'approved' });

    const achievements = [];

    // First action
    if (actions.length >= 1) {
        achievements.push({
            id: 'first_action',
            title: 'First Step',
            description: 'Completed your first sustainability action',
            icon: '🌱',
            earned: true,
            date: actions[0].createdAt
        });
    }

    // Credit milestones
    if (user.totalCreditsEarned >= 100) {
        achievements.push({
            id: 'credits_100',
            title: 'Century Club',
            description: 'Earned 100 Green Credits',
            icon: '💯',
            earned: true
        });
    }

    if (user.totalCreditsEarned >= 1000) {
        achievements.push({
            id: 'credits_1000',
            title: 'Green Titan',
            description: 'Earned 1000 Green Credits',
            icon: '👑',
            earned: true
        });
    }

    // CO2 milestones
    if (user.totalCO2Saved >= 1000) {
        achievements.push({
            id: 'co2_1000',
            title: 'Carbon Cutter',
            description: 'Saved 1000 kg of CO2',
            icon: '🎯',
            earned: true
        });
    }

    // Streak achievements
    const streak = await calculateStreak(userId);
    if (streak >= 7) {
        achievements.push({
            id: 'streak_7',
            title: 'Weekly Warrior',
            description: '7-day activity streak',
            icon: '🔥',
            earned: true,
            value: streak
        });
    }

    if (streak >= 30) {
        achievements.push({
            id: 'streak_30',
            title: 'Monthly Master',
            description: '30-day activity streak',
            icon: '⚡',
            earned: true,
            value: streak
        });
    }

    // Variety achievement
    const uniqueActions = new Set(actions.map(a => a.actionType)).size;
    if (uniqueActions >= 3) {
        achievements.push({
            id: 'variety_3',
            title: 'Eco-Versatile',
            description: 'Completed 3 different types of actions',
            icon: '🌈',
            earned: true
        });
    }

    if (uniqueActions >= 5) {
        achievements.push({
            id: 'variety_5',
            title: 'Green All-Rounder',
            description: 'Completed 5 different types of actions',
            icon: '🌟',
            earned: true
        });
    }

    return achievements;
};

const calculateStreak = async (userId) => {
    const actions = await Action.find({
        userId,
        status: 'approved',
        createdAt: { $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }
    }).sort({ createdAt: -1 });

    if (actions.length === 0) return 0;

    let streak = 1;
    let currentDate = new Date(actions[0].createdAt).setHours(0, 0, 0, 0);

    for (let i = 1; i < actions.length; i++) {
        const actionDate = new Date(actions[i].createdAt).setHours(0, 0, 0, 0);
        const expectedDate = currentDate - 24 * 60 * 60 * 1000;

        if (actionDate === expectedDate) {
            streak++;
            currentDate = actionDate;
        } else {
            break;
        }
    }

    return streak;
};

const calculatePercentile = async (userId, field) => {
    const user = await User.findById(userId);
    const value = user[field];

    const count = await User.countDocuments({
        [field]: { $gt: value }
    });

    const total = await User.countDocuments();
    const percentile = ((total - count) / total) * 100;

    return Math.round(percentile);
};

const getInstitutionRank = async (userId, institutionId) => {
    const user = await User.findById(userId);

    const rank = await User.countDocuments({
        institutionId,
        sustainabilityScore: { $gt: user.sustainabilityScore }
    });

    return rank + 1;
};

const checkNewAchievements = async (userId) => {
    // This would check for newly unlocked achievements
    // For now, return empty array
    return [];
};

module.exports = {
    getDashboardStats,
    getImpactTimeline,
    getActionBreakdown,
    getPeerComparison,
    getNotifications,
    updatePreferences,
    exportUserData
};
