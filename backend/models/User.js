const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters'],
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false // Don't return password by default
    },
    role: {
        type: String,
        enum: {
            values: ['user', 'admin', 'institution'],
            message: '{VALUE} is not a valid role'
        },
        default: 'user'
    },
    profileImage: {
        type: String,
        default: 'default-avatar.png'
    },
    phoneNumber: {
        type: String,
        match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
    },
    address: {
        street: String,
        city: String,
        state: String,
        pincode: String,
        country: { type: String, default: 'India' }
    },
    institutionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institution'
    },

    // Wallet & Credits
    walletBalance: {
        type: Number,
        default: 0,
        min: [0, 'Wallet balance cannot be negative']
    },
    totalCreditsEarned: {
        type: Number,
        default: 0
    },
    totalCreditsRedeemed: {
        type: Number,
        default: 0
    },

    // Sustainability Metrics
    sustainabilityScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    totalCO2Saved: {
        type: Number,
        default: 0, // in kg
    },
    totalEnergySaved: {
        type: Number,
        default: 0, // in kWh
    },
    totalWaterSaved: {
        type: Number,
        default: 0, // in liters
    },

    // Stats
    actionsCount: {
        type: Number,
        default: 0
    },
    verifiedActionsCount: {
        type: Number,
        default: 0
    },
    lastActive: {
        type: Date,
        default: Date.now
    },

    // Preferences
    preferences: {
        emailNotifications: { type: Boolean, default: true },
        pushNotifications: { type: Boolean, default: true },
        weeklyReport: { type: Boolean, default: false },
        language: { type: String, default: 'en' }
    },

    // Verification
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    isPhoneVerified: {
        type: Boolean,
        default: false
    },
    isKYCVerified: {
        type: Boolean,
        default: false
    },

    // Email verification
    emailVerificationToken: String,
    emailVerificationExpires: Date,

    // Password reset
    passwordResetToken: String,
    passwordResetExpires: Date,

    // Security
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorSecret: String,
    lastLogin: Date,
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: Date,

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

// Virtual for available credits (wallet balance)
userSchema.virtual('availableCredits').get(function () {
    return this.walletBalance;
});

// Virtual for redemption rate
userSchema.virtual('redemptionRate').get(function () {
    if (this.totalCreditsEarned === 0) return 0;
    return (this.totalCreditsRedeemed / this.totalCreditsEarned * 100).toFixed(2);
});

// Encrypt password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Update timestamps
userSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Check if account is locked
userSchema.methods.isLocked = function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incLoginAttempts = function () {
    // If lock has expired, reset attempts
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 }
        });
    }

    // Otherwise increment
    const updates = { $inc: { loginAttempts: 1 } };

    // Lock account if too many attempts
    if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
        updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // Lock for 2 hours
    }

    return this.updateOne(updates);
};

// Add to User schema methods
userSchema.methods.hasEnoughCredits = function (amount) {
    return this.walletBalance >= amount;
};

userSchema.methods.addCredits = function (amount, description = '') {
    this.walletBalance += amount;
    this.totalCreditsEarned += amount;
    return this.save();
};

userSchema.methods.deductCredits = function (amount, description = '') {
    if (!this.hasEnoughCredits(amount)) {
        throw new Error('Insufficient credits');
    }
    this.walletBalance -= amount;
    this.totalCreditsRedeemed += amount;
    return this.save();
};

userSchema.methods.getTransactionHistory = async function (limit = 50) {
    const CreditTransaction = mongoose.model('CreditTransaction');
    return await CreditTransaction.find({
        $or: [
            { fromUser: this._id },
            { toUser: this._id }
        ]
    })
        .sort({ createdAt: -1 })
        .limit(limit);
};

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ institutionId: 1 });
userSchema.index({ sustainabilityScore: -1 });
userSchema.index({ totalCreditsEarned: -1 });
userSchema.index({ createdAt: -1 });

const User = mongoose.model('User', userSchema);
module.exports = User;
