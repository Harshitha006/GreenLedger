const { body, validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};

const registerValidation = [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    validateRequest
];

const loginValidation = [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
    validateRequest
];

const actionValidation = [
    body('actionType')
        .isIn(['electricity', 'solar', 'ev', 'transport', 'water', 'waste'])
        .withMessage('Invalid action type'),
    body('proofData').optional().isObject(),
    validateRequest
];

module.exports = {
    validateRequest,
    registerValidation,
    loginValidation,
    actionValidation
};
