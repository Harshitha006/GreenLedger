const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const upload = require('../middleware/upload');
const { handleUploadError } = require('../middleware/upload');
const {
    uploadAction,
    getMyActions,
    getActionById,
    updateAction,
    deleteAction,
    getPendingActions,
    getFraudActions,
} = require('../controllers/actionController');

// Validation rules
const uploadValidation = [
    body('actionType')
        .isIn(['electricity', 'solar', 'ev', 'transport', 'water', 'tree'])
        .withMessage('Invalid action type'),
    body('userInput')
        .optional()
        .isString()
        .withMessage('User input must be a string'),
];

// Upload route — handleUploadError catches multer-specific errors (size limit, wrong type)
router.post(
    '/upload',
    protect,
    (req, res, next) => upload.array('proofs', 5)(req, res, (err) => handleUploadError(err, req, res, next)),
    uploadValidation,
    validateRequest,
    uploadAction
);

router.get('/my-actions', protect, getMyActions);
router.get('/pending', protect, authorize('admin'), getPendingActions);
router.get('/fraud', protect, authorize('admin'), getFraudActions);
router.get('/:id', protect, getActionById);
router.put('/:id', protect, authorize('admin'), updateAction);
router.delete('/:id', protect, deleteAction);

module.exports = router;
