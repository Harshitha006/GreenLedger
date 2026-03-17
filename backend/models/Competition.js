const mongoose = require('mongoose');

const competitionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Competition name is required']
    },
    description: String,

    institutionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institution',
        required: true
    },

    type: {
        type: String,
        enum: ['individual', 'team', 'institution'],
        default: 'individual'
    },

    // Duration
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },

    // Scoring
    scoringType: {
        type: String,
        enum: ['total_credits', 'co2_saved', 'actions_count', 'improvement_percentage'],
        default: 'total_credits'
    },

    // Prizes
    prizes: [{
        rank: Number,
        reward: String,
        creditsAmount: Number
    }],

    // Participants
    participants: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        teamId: String,
        joinedAt: Date,
        finalScore: Number,
        rank: Number
    }],

    // Leaderboard
    leaderboard: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        score: Number,
        lastUpdated: Date
    }],

    // Status
    status: {
        type: String,
        enum: ['upcoming', 'active', 'completed', 'cancelled'],
        default: 'upcoming'
    },

    // Rules
    rules: [String],
    allowedActions: [String],
    minActionsRequired: Number,

    // Metadata
    bannerImage: String,
    maxParticipants: Number,
    currentParticipants: {
        type: Number,
        default: 0
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Virtual for progress percentage
competitionSchema.virtual('progress').get(function () {
    const now = Date.now();
    const total = this.endDate - this.startDate;
    const elapsed = now - this.startDate;

    if (now < this.startDate) return 0;
    if (now > this.endDate) return 100;

    return (elapsed / total) * 100;
});

// Update timestamps
competitionSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Update status based on dates
competitionSchema.pre('save', function (next) {
    const now = Date.now();

    if (now < this.startDate) {
        this.status = 'upcoming';
    } else if (now > this.endDate) {
        this.status = 'completed';
    } else {
        this.status = 'active';
    }

    next();
});

// Indexes
competitionSchema.index({ institutionId: 1, status: 1 });
competitionSchema.index({ startDate: 1, endDate: 1 });
competitionSchema.index({ status: 1, startDate: 1 });

const Competition = mongoose.model('Competition', competitionSchema);
module.exports = Competition;
