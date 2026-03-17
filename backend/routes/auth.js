const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const {
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
} = require('../controllers/authController');

// Validation rules
const registerValidation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
    body('email')
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
        .matches(/^(?=.*[A-Za-z])(?=.*\d)/).withMessage('Password must contain at least one letter and one number'),
    body('phoneNumber')
        .optional()
        .matches(/^[0-9]{10}$/).withMessage('Please enter a valid 10-digit phone number'),
];

const loginValidation = [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
];

const updateProfileValidation = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
    body('phoneNumber')
        .optional()
        .matches(/^[0-9]{10}$/).withMessage('Please enter a valid 10-digit phone number'),
    body('address.street').optional().trim(),
    body('address.city').optional().trim(),
    body('address.state').optional().trim(),
    body('address.pincode').optional().trim(),
    body('preferences.emailNotifications').optional().isBoolean(),
    body('preferences.pushNotifications').optional().isBoolean(),
    body('preferences.weeklyReport').optional().isBoolean(),
    body('preferences.language').optional().isIn(['en', 'hi', 'ta', 'te', 'bn']),
];

const changePasswordValidation = [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
        .matches(/^(?=.*[A-Za-z])(?=.*\d)/).withMessage('Password must contain at least one letter and one number'),
];

const emailValidation = [
    body('email').isEmail().withMessage('Please provide a valid email'),
];

const resetPasswordValidation = [
    body('password')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
        .matches(/^(?=.*[A-Za-z])(?=.*\d)/).withMessage('Password must contain at least one letter and one number'),
];

// Routes
router.post('/register', registerValidation, validateRequest, register);
router.post('/login', loginValidation, validateRequest, login);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfileValidation, validateRequest, updateProfile);
router.put('/change-password', protect, changePasswordValidation, validateRequest, changePassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', emailValidation, validateRequest, resendVerification);
router.post('/forgot-password', emailValidation, validateRequest, forgotPassword);
router.post('/reset-password/:token', resetPasswordValidation, validateRequest, resetPassword);
router.post('/logout', protect, logout);
router.post('/refresh-token', refreshToken);

module.exports = router;
