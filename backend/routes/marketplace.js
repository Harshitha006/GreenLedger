const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const {
  createListing,
  getListings,
  getListingById,
  updateListing,
  deleteListing,
  purchaseCredits,
  placeBid,
  getMyListings,
  getRewards,
  getRewardById,
  redeemReward,
  getMarketplaceStats,
  createReward,
  updateReward,
  addListingReview,
  addRewardReview
} = require('../controllers/marketplaceController');

const reviewValidation = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage('Comment must be between 3 and 500 characters'),
  validateRequest
];

// Validation rules
const createListingValidation = [
  body('creditAmount')
    .isInt({ min: 1, max: 100000 })
    .withMessage('Credit amount must be between 1 and 100,000'),
  body('pricePerCredit')
    .isFloat({ min: 0.01, max: 1000 })
    .withMessage('Price per credit must be between ₹0.01 and ₹1000'),
  body('title')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
  validateRequest
];

const purchaseValidation = [
  body('amount')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Purchase amount must be at least 1 credit'),
  validateRequest
];

const bidValidation = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Bid amount must be at least ₹0.01'),
  validateRequest
];

// Public routes
router.get('/listings', getListings);
router.get('/listings/:id', getListingById);
router.get('/rewards', getRewards);
router.get('/rewards/:id', getRewardById);
router.get('/stats', getMarketplaceStats);

// Protected routes
router.post('/listings', protect, createListingValidation, createListing);
router.get('/my-listings', protect, getMyListings);
router.put('/listings/:id', protect, updateListing);
router.delete('/listings/:id', protect, deleteListing);
router.post('/listings/:id/purchase', protect, purchaseValidation, purchaseCredits);
router.post('/listings/:id/bid', protect, bidValidation, placeBid);
router.post('/listings/:id/review', protect, reviewValidation, addListingReview);
router.post('/rewards/:id/redeem', protect, redeemReward);
router.post('/rewards/:id/review', protect, reviewValidation, addRewardReview);

// Reward management (Admins/Partners)
router.post('/rewards', protect, authorize('admin', 'partner'), createReward);
router.put('/rewards/:id', protect, authorize('admin', 'partner'), updateReward);

// Admin routes
router.put('/listings/:id/verify', protect, authorize('admin'), (req, res) => {
  // Admin verification endpoint
  res.json({ success: true, message: 'Endpoint under development' });
});

module.exports = router;
