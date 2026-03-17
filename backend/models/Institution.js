const mongoose = require('mongoose');

const institutionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Institution name is required'],
        trim: true,
        unique: true
    },
    type: {
        type: String,
        enum: {
            values: ['college', 'university', 'apartment', 'society', 'company', 'school', 'other'],
            message: '{VALUE} is not a valid institution type'
        },
        required: true
    },
    description: {
        type: String,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    logo: {
        type: String,
        default: 'default-institution.png'
    },

    // Contact Information
    contactEmail: {
        type: String,
        required: true,
        lowercase: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    contactPhone: {
        type: String,
        required: true
    },
    website: String,

    // Address
    address: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
        country: { type: String, default: 'India' }
    },

    // Geolocation
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        }
    },

    // Verification
    verified: {
        type: Boolean,
        default: false
    },
    verificationDocuments: [{
        type: String, // URLs to uploaded documents
        required: function () { return !this.verified; }
    }],
    verifiedAt: Date,
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Admin
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    admins: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    // Members
    totalMembers: {
        type: Number,
        default: 0
    },
    activeMembers: {
        type: Number,
        default: 0
    },

    // Sustainability Metrics
    sustainabilityRank: {
        type: Number,
        default: 0
    },
    totalCredits: {
        type: Number,
        default: 0
    },
    totalCO2Saved: {
        type: Number,
        default: 0
    },
    totalEnergySaved: {
        type: Number,
        default: 0
    },
    totalWaterSaved: {
        type: Number,
        default: 0
    },

    // Stats
    actionsCount: {
        type: Number,
        default: 0
    },
    competitionsCount: {
        type: Number,
        default: 0
    },

    // Settings
    settings: {
        allowPublicRanking: { type: Boolean, default: true },
        allowMemberRegistration: { type: Boolean, default: true },
        requireApproval: { type: Boolean, default: false },
        autoVerifyMembers: { type: Boolean, default: false },
        defaultRole: { type: String, default: 'user' }
    },

    // Subscription
    subscription: {
        plan: {
            type: String,
            enum: ['free', 'basic', 'premium', 'enterprise'],
            default: 'free'
        },
        startDate: Date,
        endDate: Date,
        autoRenew: { type: Boolean, default: true },
        paymentMethod: String
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
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for member count
institutionSchema.virtual('memberCount').get(function () {
    return this.totalMembers;
});

// Virtual for average sustainability score
institutionSchema.virtual('avgSustainabilityScore').get(function () {
    return this.totalCO2Saved > 0 ? (this.totalCredits / this.totalMembers).toFixed(2) : 0;
});

// Indexes
institutionSchema.index({ location: '2dsphere' });
institutionSchema.index({ name: 1 });
institutionSchema.index({ type: 1 });
institutionSchema.index({ city: 1, state: 1 });
institutionSchema.index({ sustainabilityRank: -1 });
institutionSchema.index({ verified: 1 });
institutionSchema.index({ 'subscription.plan': 1 });

const Institution = mongoose.model('Institution', institutionSchema);
module.exports = Institution;
