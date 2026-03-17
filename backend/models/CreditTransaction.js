const mongoose = require('mongoose');

const creditTransactionSchema = new mongoose.Schema({
    fromUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function () {
            return this.type !== 'earned' && this.type !== 'purchased';
        }
    },
    toUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function () {
            return this.type !== 'redeemed' && this.type !== 'burned';
        }
    },
    fromInstitution: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institution'
    },
    toInstitution: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institution'
    },

    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [1, 'Amount must be at least 1']
    },

    grossAmount: {
        type: Number,
        comment: 'Amount before fees'
    },

    fee: {
        amount: Number,
        percentage: Number,
        collectedBy: {
            type: String,
            enum: ['platform', 'institution']
        }
    },

    type: {
        type: String,
        enum: {
            values: ['earned', 'transferred', 'redeemed', 'purchased', 'issued', 'burned'],
            message: '{VALUE} is not a valid transaction type'
        },
        required: true
    },

    description: {
        type: String,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },

    reference: String,

    // For earned credits
    actionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Action'
    },

    // For marketplace transactions
    listingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketplaceListing'
    },

    // For redemptions
    redemptionDetails: {
        rewardId: String,
        rewardName: String,
        rewardCategory: String,
        partnerId: String,
        partnerName: String,
        discountValue: Number,
        redemptionCode: String,
        qrCode: String,
        expiresAt: Date,
        redeemedAt: Date
    },

    // For CSR purchases
    csrDetails: {
        companyId: String,
        companyName: String,
        purpose: String,
        invoiceNumber: String,
        paymentReference: String,
        paymentMethod: String
    },

    // Balance before/after
    balanceBefore: {
        fromUser: Number,
        toUser: Number,
        fromInstitution: Number,
        toInstitution: Number
    },
    balanceAfter: {
        fromUser: Number,
        toUser: Number,
        fromInstitution: Number,
        toInstitution: Number
    },

    // Status
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'reversed'],
        default: 'pending'
    },
    failureReason: String,

    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        comment: 'Additional transaction data'
    },

    tags: [String],

    // Blockchain (optional)
    blockchainHash: String,
    blockchainTxId: String,

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    completedAt: Date,
    reversedAt: Date
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for formatted amount
creditTransactionSchema.virtual('formattedAmount').get(function () {
    return `${this.amount} GC`;
});

// Virtual for net effect
creditTransactionSchema.virtual('netEffect').get(function () {
    if (this.type === 'earned' || this.type === 'purchased' || this.type === 'issued') {
        return 'positive';
    }
    if (this.type === 'redeemed' || this.type === 'burned') {
        return 'negative';
    }
    return 'neutral';
});

// Virtual for fee percentage display
creditTransactionSchema.virtual('feePercentageDisplay').get(function () {
    return this.fee?.percentage ? `${this.fee.percentage}%` : '0%';
});

// Update completedAt
creditTransactionSchema.pre('save', function (next) {
    if (this.status === 'completed' && !this.completedAt) {
        this.completedAt = Date.now();
    }
    if (this.status === 'reversed' && !this.reversedAt) {
        this.reversedAt = Date.now();
    }
    next();
});

// Indexes
creditTransactionSchema.index({ fromUser: 1, createdAt: -1 });
creditTransactionSchema.index({ toUser: 1, createdAt: -1 });
creditTransactionSchema.index({ actionId: 1 }, { sparse: true });
creditTransactionSchema.index({ listingId: 1 }, { sparse: true });
creditTransactionSchema.index({ type: 1, status: 1 });
creditTransactionSchema.index({ createdAt: -1 });
creditTransactionSchema.index({ 'redemptionDetails.redemptionCode': 1 }, { sparse: true });
creditTransactionSchema.index({ 'csrDetails.invoiceNumber': 1 }, { sparse: true });
creditTransactionSchema.index({ blockchainHash: 1 }, { sparse: true });
creditTransactionSchema.index({ status: 1, createdAt: 1 });

const CreditTransaction = mongoose.model('CreditTransaction', creditTransactionSchema);
module.exports = CreditTransaction;
