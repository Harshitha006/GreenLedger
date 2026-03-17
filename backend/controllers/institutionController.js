const Institution = require('../models/Institution');
const User = require('../models/User');
const Action = require('../models/Action');
const asyncHandler = require('../utils/asyncHandler');
const mongoose = require('mongoose');

// @desc    Get current user's institution details and stats
// @route   GET /api/institutions/my
// @access  Private
exports.getMyInstitution = asyncHandler(async (req, res) => {
    if (!req.user.institutionId) {
        return res.status(404).json({
            success: false,
            message: 'User is not associated with any institution'
        });
    }

    const institution = await Institution.findById(req.user.institutionId);

    if (!institution) {
        res.status(404);
        throw new Error('Institution not found');
    }

    // Aggregated stats for the institution
    const memberStats = await User.aggregate([
        { $match: { institutionId: new mongoose.Types.ObjectId(req.user.institutionId) } },
        {
            $group: {
                _id: null,
                totalMembers: { $sum: 1 },
                totalCredits: { $sum: '$totalCreditsEarned' },
                totalCO2: { $sum: '$totalCO2Saved' },
                avgSustainabilityScore: { $avg: '$sustainabilityScore' },
                totalEnergy: { $sum: '$totalEnergySaved' },
                totalWater: { $sum: '$totalWaterSaved' }
            }
        }
    ]);

    // Monthly impact trend
    const monthlyTrend = await Action.aggregate([
        {
            $match: {
                institutionId: new mongoose.Types.ObjectId(req.user.institutionId),
                status: 'approved',
                createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                co2: { $sum: '$impact.co2SavedKg' },
                credits: { $sum: '$impact.creditsEarned' },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    // Top performers
    const topPerformers = await User.find({ institutionId: req.user.institutionId })
        .select('name profileImage sustainabilityScore totalCO2Saved')
        .sort({ sustainabilityScore: -1 })
        .limit(5);

    res.json({
        success: true,
        data: {
            institution,
            summary: memberStats[0] || {
                totalMembers: 0,
                totalCredits: 0,
                totalCO2: 0,
                avgSustainabilityScore: 0,
                totalEnergy: 0,
                totalWater: 0
            },
            monthlyTrend,
            topPerformers
        }
    });
});

// @desc    Get institution leaderboard
// @route   GET /api/institutions/leaderboard
// @access  Private
exports.getInstitutionLeaderboard = asyncHandler(async (req, res) => {
    const institutionId = req.user.institutionId;
    if (!institutionId) {
        res.status(400);
        throw new Error('User has no institution');
    }

    const { period = 'all' } = req.query;
    
    // In a real app, we'd filter by period using timestamps on actions
    // For now, we use the compiled stats on User model
    const leaderboard = await User.find({ institutionId })
        .select('name profileImage sustainabilityScore totalCreditsEarned totalCO2Saved verifiedActionsCount')
        .sort({ sustainabilityScore: -1, totalCreditsEarned: -1 })
        .limit(50);

    res.json({
        success: true,
        data: leaderboard
    });
});

// @desc    Get institution activities
// @route   GET /api/institutions/activities
// @access  Private
exports.getInstitutionActivities = asyncHandler(async (req, res) => {
    const institutionId = req.user.institutionId;
    if (!institutionId) {
        res.status(400);
        throw new Error('User has no institution');
    }

    const activities = await Action.find({ 
        institutionId,
        status: 'approved'
    })
        .populate('userId', 'name profileImage')
        .sort({ createdAt: -1 })
        .limit(20);

    res.json({
        success: true,
        data: activities
    });
});
