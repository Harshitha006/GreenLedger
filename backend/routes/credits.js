const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const {
    getCreditSummary,
    getCreditHistory,
    transferCredits,
    getLeaderboard,
    getTransactionById,
    getAllTransactions,
    getPlatformStats,
    reverseTransaction
} = require('../controllers/creditController');

// Validation rules
const transferValidation = [
    body('toUserId')
        .notEmpty()
        .withMessage('Recipient is required'),
    body('amount')
        .isInt({ min: 1, max: 10000 })
        .withMessage('Amount must be between 1 and 10000 credits'),
    body('description')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Description cannot exceed 200 characters'),
    validateRequest
];

// Public routes
router.get('/leaderboard', getLeaderboard);

// Protected routes
router.get('/summary', protect, getCreditSummary);
router.get('/history', protect, getCreditHistory);
router.get('/transaction/:id', protect, getTransactionById);
router.post('/transfer', protect, transferValidation, transferCredits);

// Admin routes
router.get('/admin/transactions', protect, authorize('admin'), getAllTransactions);
router.get('/admin/stats', protect, authorize('admin'), getPlatformStats);
router.post('/admin/reverse/:transactionId', protect, authorize('admin'), reverseTransaction);

module.exports = router;
