const mongoose = require('mongoose');

const fraudAlertSchema = new mongoose.Schema({
    actionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Action',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    alertType: {
        type: String,
        enum: {
            values: ['duplicate', 'anomaly', 'tampered', 'suspicious_pattern', 'multiple_accounts', 'unusual_location', 'ai_generated'],
            message: '{VALUE} is not a valid alert type'
        },
        required: true
    },

    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        required: true
    },

    confidence: {
        type: Number,
        min: 0,
        max: 1,
        required: true
    },

    description: String,

    evidence: {
        documentHash: String,
        ipAddress: String,
        deviceId: String,
        location: {
            lat: Number,
            lng: Number
        },
        timestamps: [Date],
        similarityScore: Number,
        matchedWith: [{
            actionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Action' },
            similarity: Number
        }]
    },

    // Detection method
    detectedBy: {
        type: String,
        enum: ['ocr', 'duplicate_detector', 'anomaly_detector', 'ensemble_model', 'manual'],
        required: true
    },
    modelVersion: String,

    // Status
    status: {
        type: String,
        enum: ['new', 'investigating', 'confirmed', 'false_positive', 'resolved'],
        default: 'new'
    },

    // Review
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    reviewedAt: Date,
    reviewNotes: String,

    // Actions taken
    actionsTaken: [{
        action: String,
        takenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now }
    }],

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

// Update timestamps
fraudAlertSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Indexes
fraudAlertSchema.index({ userId: 1, status: 1 });
fraudAlertSchema.index({ actionId: 1 }, { unique: true });
fraudAlertSchema.index({ severity: 1, status: 1 });
fraudAlertSchema.index({ detectedBy: 1, createdAt: -1 });
fraudAlertSchema.index({ createdAt: -1 });

const FraudAlert = mongoose.model('FraudAlert', fraudAlertSchema);
module.exports = FraudAlert;
