const mongoose = require('mongoose');

const actionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    institutionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institution'
    },
    actionType: {
        type: String,
        enum: {
            values: ['electricity', 'solar', 'ev', 'transport', 'water', 'tree'],
            message: '{VALUE} is not a valid action type'
        },
        required: [true, 'Action type is required']
    },

    // Proof Documents
    proofUrls: [{
        type: String,
        required: [true, 'At least one proof document is required']
    }],
    proofMetadata: [{
        filename: String,
        size: Number,
        mimeType: String,
        uploadedAt: Date,
        hash: String,
        phash: String, // Perceptual hash for duplicate detection
        isDuplicate: { type: Boolean, default: false },
        duplicateType: { type: String, enum: ['exact', 'similar', null], default: null }
    }],

    // QR/API Verification
    hasQR: {
        type: Boolean,
        default: false
    },
    qrData: {
        transactionId: String,
        issuerId: String,
        timestamp: Date,
        signature: String,
        verified: { type: Boolean, default: false }
    },

    // Extracted Data (from OCR)
    extractedData: {
        billNumber: String,
        consumerNumber: String,
        previousReading: Number,
        currentReading: Number,
        unitsConsumed: Number,
        billDate: Date,
        billAmount: Number,
        issuerName: String,
        issuerId: String,
        address: String,

        // Solar specific
        capacity: Number, // kW
        installationDate: Date,
        installerId: String,

        // Transport specific
        fromLocation: String,
        toLocation: String,
        distance: Number, // km
        mode: String,
        ticketNumber: String,

        // Water specific
        volume: Number, // liters
        harvestType: String,

        // Waste specific
        wasteType: String,
        weight: Number, // kg

        // Tree specific
        treeCount: Number,
        treeSpecies: [String],
        location: {
            lat: Number,
            lng: Number
        }
    },

    // User Input (for cases where OCR fails)
    userInput: {
        provided: { type: Boolean, default: false },
        data: mongoose.Schema.Types.Mixed,
        verifiedByAdmin: { type: Boolean, default: false }
    },

    // Verification Results
    verificationResults: {
        // Layer 1: Document Authenticity
        duplicateCheck: {
            passed: { type: Boolean, default: false },
            confidence: { type: Number, min: 0, max: 1 },
            details: String
        },
        tamperCheck: {
            passed: { type: Boolean, default: false },
            confidence: { type: Number, min: 0, max: 1 },
            elaScore: Number,
            metadataRisk: Number,
            copyMoveScore: Number
        },

        // Layer 2: Statistical
        anomalyCheck: {
            passed: { type: Boolean, default: false },
            confidence: { type: Number, min: 0, max: 1 },
            zScore: Number,
            isAnomaly: Boolean
        },
        trendCheck: {
            passed: { type: Boolean, default: false },
            confidence: { type: Number, min: 0, max: 1 },
            trendDeviation: Number,
            seasonalOk: Boolean
        },

        // Layer 3: Source
        sourceCheck: {
            passed: { type: Boolean, default: false },
            confidence: { type: Number, min: 0, max: 1 },
            issuerVerified: Boolean,
            apiVerified: Boolean
        },

        // Ensemble Fraud Detection
        fraudDetection: {
            fraudProbability: { type: Number, min: 0, max: 1 },
            riskLevel: {
                type: String,
                enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
            },
            topFactors: [String],
            modelVersion: String
        },

        // Overall
        overallConfidence: { type: Number, min: 0, max: 1 },
        verifiedAt: Date,
        verifiedBy: {
            type: String,
            enum: ['system', 'admin', 'both']
        }
    },

    // Impact Calculation
    impact: {
        co2SavedKg: { type: Number, default: 0 },
        energySavedKwh: { type: Number, default: 0 },
        waterSavedL: { type: Number, default: 0 },
        wasteDivertedKg: { type: Number, default: 0 },
        treesEquivalent: { type: Number, default: 0 },
        creditsEarned: { type: Number, default: 0 },
        calculationFormula: String,
        calculatedAt: Date
    },

    // Status
    status: {
        type: String,
        enum: {
            values: ['pending', 'verifying', 'approved', 'rejected', 'flagged', 'needs_review'],
            message: '{VALUE} is not a valid status'
        },
        default: 'pending'
    },
    rejectionReason: String,
    flags: [{
        type: {
            type: String,
            enum: ['duplicate', 'anomaly', 'tampered', 'suspicious', 'user_reported']
        },
        severity: {
            type: String,
            enum: ['low', 'medium', 'high']
        },
        description: String,
        resolved: { type: Boolean, default: false },
        resolvedAt: Date,
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: { type: Date, default: Date.now }
    }],

    // Metadata
    submissionDate: {
        type: Date,
        default: Date.now
    },
    submissionIp: String,
    submissionUserAgent: String,
    submissionLocation: {
        lat: Number,
        lng: Number
    },

    // Review
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    reviewedAt: Date,
    reviewNotes: String,

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
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for time in queue
actionSchema.virtual('queueTime').get(function () {
    if (this.reviewedAt) {
        return (this.reviewedAt - this.createdAt) / (1000 * 60 * 60); // hours
    }
    return (Date.now() - this.createdAt) / (1000 * 60 * 60);
});

// Update timestamps
actionSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Indexes
actionSchema.index({ userId: 1, createdAt: -1 });
actionSchema.index({ institutionId: 1, createdAt: -1 });
actionSchema.index({ actionType: 1, status: 1 });
actionSchema.index({ status: 1, createdAt: 1 });
actionSchema.index({ 'extractedData.consumerNumber': 1 });
actionSchema.index({ 'qrData.transactionId': 1 }, { sparse: true });
actionSchema.index({ 'verificationResults.fraudDetection.riskLevel': 1 });
actionSchema.index({ createdAt: -1 });
actionSchema.index({ 'flags.resolved': 1 });

const Action = mongoose.model('Action', actionSchema);
module.exports = Action;
