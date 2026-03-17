const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendEmail } = require('../utils/emailService');
const asyncHandler = require('../utils/asyncHandler');
const generateToken = require('../utils/generateToken');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
    const { name, email, password, phoneNumber, institutionId } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    // Create verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const user = await User.create({
        name,
        email,
        password,
        phoneNumber,
        institutionId,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    if (user) {
        // Send verification email
        try {
            await sendEmail({
                email: user.email,
                subject: 'Verify your GreenLedger account',
                template: 'emailVerification',
                data: {
                    name: user.name,
                    verificationLink: `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`,
                },
            });
        } catch (error) {
            console.error('Email sending failed:', error);
            // Continue even if email fails
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please verify your email.',
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id),
            },
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        res.status(401);
        throw new Error('Invalid email or password');
    }

    // Check if account is locked
    if (user.isLocked()) {
        const lockTimeRemaining = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
        res.status(423);
        throw new Error(`Account locked. Try again in ${lockTimeRemaining} minutes`);
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
        // Increment login attempts
        await user.incLoginAttempts();

        res.status(401);
        throw new Error('Invalid email or password');
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
        user.loginAttempts = 0;
        user.lockUntil = undefined;
        await user.save();
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save();

    // Check if email is verified
    if (!user.isEmailVerified) {
        res.status(401);
        throw new Error('Please verify your email before logging in');
    }

    res.json({
        success: true,
        data: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            profileImage: user.profileImage,
            walletBalance: user.walletBalance,
            sustainabilityScore: user.sustainabilityScore,
            isEmailVerified: user.isEmailVerified,
            token: generateToken(user._id),
        },
    });
});

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
        .populate('institutionId', 'name type logo')
        .select('-emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires');

    res.json({
        success: true,
        data: user,
    });
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Update fields
    const { name, phoneNumber, address, preferences } = req.body;

    if (name) user.name = name;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (address) user.address = { ...user.address, ...address };
    if (preferences) user.preferences = { ...user.preferences, ...preferences };

    const updatedUser = await user.save();

    res.json({
        success: true,
        data: {
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            phoneNumber: updatedUser.phoneNumber,
            address: updatedUser.address,
            preferences: updatedUser.preferences,
            profileImage: updatedUser.profileImage,
        },
    });
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Check current password
    const isPasswordMatch = await user.comparePassword(currentPassword);
    if (!isPasswordMatch) {
        res.status(401);
        throw new Error('Current password is incorrect');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Send email notification
    try {
        await sendEmail({
            email: user.email,
            subject: 'Your GreenLedger password was changed',
            template: 'passwordChanged',
            data: { name: user.name },
        });
    } catch (error) {
        console.error('Email sending failed:', error);
    }

    res.json({
        success: true,
        message: 'Password changed successfully',
    });
});

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
const verifyEmail = asyncHandler(async (req, res) => {
    const { token } = req.params;

    const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired verification token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({
        success: true,
        message: 'Email verified successfully',
    });
});

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
const resendVerification = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (user.isEmailVerified) {
        res.status(400);
        throw new Error('Email already verified');
    }

    // Generate new token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    // Send email
    try {
        await sendEmail({
            email: user.email,
            subject: 'Verify your GreenLedger account',
            template: 'emailVerification',
            data: {
                name: user.name,
                verificationLink: `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`,
            },
        });
    } catch (error) {
        console.error('Email sending failed:', error);
    }

    res.json({
        success: true,
        message: 'Verification email sent',
    });
});

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = Date.now() + 1 * 60 * 60 * 1000; // 1 hour
    await user.save();

    // Send email
    try {
        await sendEmail({
            email: user.email,
            subject: 'Reset your GreenLedger password',
            template: 'passwordReset',
            data: {
                name: user.name,
                resetLink: `${process.env.FRONTEND_URL}/reset-password/${resetToken}`,
            },
        });
    } catch (error) {
        console.error('Email sending failed:', error);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        res.status(500);
        throw new Error('Email could not be sent');
    }

    res.json({
        success: true,
        message: 'Password reset email sent',
    });
});

// @desc    Reset password
// @route   POST /api/auth/reset-password/:token
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired reset token');
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({
        success: true,
        message: 'Password reset successfully',
    });
});

// @desc    Logout (client side only - JWT is stateless)
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res) => {
    // With JWT, logout is handled client-side by removing token
    // But we can blacklist the token if needed (requires Redis)
    res.json({
        success: true,
        message: 'Logged out successfully',
    });
});

// @desc    Refresh token
// @route   POST /api/auth/refresh-token
// @access  Public
const refreshToken = asyncHandler(async (req, res) => {
    const { token } = req.body;

    if (!token) {
        res.status(401);
        throw new Error('No token provided');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            res.status(401);
            throw new Error('User not found');
        }

        // Generate new token
        const newToken = generateToken(user._id);

        res.json({
            success: true,
            data: {
                token: newToken,
            },
        });
    } catch (error) {
        res.status(401);
        throw new Error('Invalid or expired token');
    }
});

module.exports = {
    register,
    login,
    getProfile,
    updateProfile,
    changePassword,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    logout,
    refreshToken,
};
