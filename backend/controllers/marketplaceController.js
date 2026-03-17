const MarketplaceListing = require('../models/MarketplaceListing');
const Reward = require('../models/Reward');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const creditService = require('../services/creditService');
const AdminLog = require('../models/AdminLog');
const asyncHandler = require('../utils/asyncHandler');
const mongoose = require('mongoose');
const logger = require('../config/logger');

// @desc    Create a new listing
// @route   POST /api/marketplace/listings
// @access  Private
const createListing = asyncHandler(async (req, res) => {
  const {
    creditAmount,
    pricePerCredit,
    title,
    description,
    listingType,
    category,
    tags,
    minPurchaseAmount,
    maxPurchaseAmount,
    expiresInDays = 30
  } = req.body;

  // Check user has enough credits
  const user = await User.findById(req.user._id);
  if (user.walletBalance < creditAmount) {
    res.status(400);
    throw new Error('Insufficient credits');
  }

  // Calculate total price
  const totalPrice = creditAmount * pricePerCredit;

  // Create listing
  const listing = await MarketplaceListing.create({
    sellerId: req.user._id,
    sellerName: user.name,
    sellerRating: user.sustainabilityScore / 20, // Convert to 0-5 scale
    creditAmount,
    availableAmount: creditAmount,
    pricePerCredit,
    totalPrice,
    title,
    description,
    listingType: listingType || 'fixed',
    category: category || 'personal',
    tags: tags || [],
    minPurchaseAmount: minPurchaseAmount || 1,
    maxPurchaseAmount: maxPurchaseAmount || creditAmount,
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    status: 'active'
  });

  // Reserve the credits (deduct from wallet temporarily)
  user.walletBalance -= creditAmount;
  user.marketplaceListings = (user.marketplaceListings || 0) + 1;
  await user.save();

  logger.info(`Listing created: ${listing._id} by user ${req.user._id}`);

  res.status(201).json({
    success: true,
    message: 'Listing created successfully',
    data: listing
  });
});

// @desc    Get all listings with filters
// @route   GET /api/marketplace/listings
// @access  Public
const getListings = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    sort = '-createdAt',
    type,
    category,
    minPrice,
    maxPrice,
    minCredits,
    maxCredits,
    sellerId,
    status = 'active',
    search,
    tags
  } = req.query;

  // Build query
  const query = { status };

  if (type) query.listingType = type;
  if (category) query.category = category;
  if (sellerId) query.sellerId = sellerId;
  
  if (minPrice || maxPrice) {
    query.pricePerCredit = {};
    if (minPrice) query.pricePerCredit.$gte = parseFloat(minPrice);
    if (maxPrice) query.pricePerCredit.$lte = parseFloat(maxPrice);
  }

  if (minCredits || maxCredits) {
    query.creditAmount = {};
    if (minCredits) query.creditAmount.$gte = parseInt(minCredits);
    if (maxCredits) query.creditAmount.$lte = parseInt(maxCredits);
  }

  if (search) {
    query.$text = { $search: search };
  }

  if (tags) {
    const tagArray = tags.split(',');
    query.tags = { $in: tagArray };
  }

  // Parse sort
  const sortOptions = {};
  if (sort.startsWith('-')) {
    sortOptions[sort.substring(1)] = -1;
  } else {
    sortOptions[sort] = 1;
  }

  // Execute query with pagination
  const listings = await MarketplaceListing.find(query)
    .populate('sellerId', 'name email profileImage sustainabilityScore')
    .sort(sortOptions)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await MarketplaceListing.countDocuments(query);

  // Get stats
  const stats = await MarketplaceListing.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: null,
        totalListings: { $sum: 1 },
        totalCredits: { $sum: '$creditAmount' },
        avgPrice: { $avg: '$pricePerCredit' },
        minPrice: { $min: '$pricePerCredit' },
        maxPrice: { $max: '$pricePerCredit' }
      }
    }
  ]);

  res.json({
    success: true,
    data: listings,
    stats: stats[0] || {},
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Get single listing
// @route   GET /api/marketplace/listings/:id
// @access  Public
const getListingById = asyncHandler(async (req, res) => {
  const listing = await MarketplaceListing.findById(req.params.id)
    .populate('sellerId', 'name email profileImage sustainabilityScore createdAt')
    .populate('buyerId', 'name email')
    .populate('highestBidder', 'name email');

  if (!listing) {
    res.status(404);
    throw new Error('Listing not found');
  }

  // Increment view count
  listing.views += 1;
  
  // Track unique views (simplified - in production use IP/cookie)
  if (req.user) {
    // Could track unique views per user
  }
  
  await listing.save();

  res.json({
    success: true,
    data: listing
  });
});

// @desc    Update listing
// @route   PUT /api/marketplace/listings/:id
// @access  Private
const updateListing = asyncHandler(async (req, res) => {
  const listing = await MarketplaceListing.findById(req.params.id);

  if (!listing) {
    res.status(404);
    throw new Error('Listing not found');
  }

  // Check ownership
  if (listing.sellerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to update this listing');
  }

  // Check if listing can be updated
  if (listing.status !== 'active') {
    res.status(400);
    throw new Error('Cannot update inactive listing');
  }

  // Update allowed fields
  const allowedUpdates = [
    'title', 'description', 'pricePerCredit', 'minPurchaseAmount',
    'maxPurchaseAmount', 'category', 'tags', 'images'
  ];

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      listing[field] = req.body[field];
    }
  });

  // Recalculate total price if price changed
  if (req.body.pricePerCredit) {
    listing.totalPrice = listing.creditAmount * listing.pricePerCredit;
  }

  await listing.save();

  logger.info(`Listing updated: ${listing._id}`);

  res.json({
    success: true,
    message: 'Listing updated successfully',
    data: listing
  });
});

// @desc    Delete/cancel listing
// @route   DELETE /api/marketplace/listings/:id
// @access  Private
const deleteListing = asyncHandler(async (req, res) => {
  const listing = await MarketplaceListing.findById(req.params.id);

  if (!listing) {
    res.status(404);
    throw new Error('Listing not found');
  }

  // Check ownership
  if (listing.sellerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to delete this listing');
  }

  // Check if listing can be cancelled
  if (listing.status !== 'active') {
    res.status(400);
    throw new Error('Cannot delete inactive listing');
  }

  // Return credits to seller
  const seller = await User.findById(listing.sellerId);
  seller.walletBalance += listing.availableAmount;
  await seller.save();

  // Update listing status
  listing.status = 'cancelled';
  await listing.save();

  logger.info(`Listing cancelled: ${listing._id}, credits returned: ${listing.availableAmount}`);

  res.json({
    success: true,
    message: 'Listing cancelled successfully'
  });
});

// @desc    Purchase credits from listing
// @route   POST /api/marketplace/listings/:id/purchase
// @access  Private
const purchaseCredits = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const listing = await MarketplaceListing.findById(req.params.id);

  if (!listing) {
    res.status(404);
    throw new Error('Listing not found');
  }

  // Validate listing
  if (listing.status !== 'active') {
    res.status(400);
    throw new Error('Listing is not active');
  }

  if (listing.sellerId.toString() === req.user._id.toString()) {
    res.status(400);
    throw new Error('Cannot purchase your own listing');
  }

  // Validate amount
  const purchaseAmount = amount || listing.creditAmount;
  if (purchaseAmount < listing.minPurchaseAmount) {
    res.status(400);
    throw new Error(`Minimum purchase amount is ${listing.minPurchaseAmount} credits`);
  }

  if (listing.maxPurchaseAmount && purchaseAmount > listing.maxPurchaseAmount) {
    res.status(400);
    throw new Error(`Maximum purchase amount is ${listing.maxPurchaseAmount} credits`);
  }

  if (purchaseAmount > listing.availableAmount) {
    res.status(400);
    throw new Error(`Only ${listing.availableAmount} credits available`);
  }

  // Calculate price
  const totalPrice = purchaseAmount * listing.pricePerCredit;

  // Check buyer has sufficient funds (in production, would handle payment)
  const buyer = await User.findById(req.user._id);
  
  // For demo, we'll assume payment is processed externally
  // In production, integrate with payment gateway

  // Process purchase
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Update listing
    listing.availableAmount -= purchaseAmount;
    
    if (listing.availableAmount === 0) {
      listing.status = 'sold';
      listing.buyerId = req.user._id;
      listing.buyerName = buyer.name;
      listing.soldAt = new Date();
      listing.purchaseAmount = totalPrice;
    }
    
    await listing.save({ session });

    // Transfer credits using credit service
    const transfer = await creditService.transferCredits(
      listing.sellerId,
      req.user._id,
      purchaseAmount,
      `Purchased from listing: ${listing.title}`
    );

    // Create transaction record
    const transaction = await CreditTransaction.create([{
      fromUser: listing.sellerId,
      toUser: req.user._id,
      amount: purchaseAmount,
      type: 'purchased',
      listingId: listing._id,
      description: `Purchased ${purchaseAmount} credits from "${listing.title}"`,
      metadata: {
        listingTitle: listing.title,
        pricePerCredit: listing.pricePerCredit,
        totalPrice
      }
    }], { session });

    await session.commitTransaction();

    logger.info(`Purchase completed: ${purchaseAmount} credits from listing ${listing._id}`);

    res.json({
      success: true,
      message: 'Purchase successful',
      data: {
        transaction: transaction[0],
        listing: {
          id: listing._id,
          remainingCredits: listing.availableAmount,
          status: listing.status
        },
        transfer
      }
    });

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// @desc    Place bid on auction
// @route   POST /api/marketplace/listings/:id/bid
// @access  Private
const placeBid = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const listing = await MarketplaceListing.findById(req.params.id);

  if (!listing) {
    res.status(404);
    throw new Error('Listing not found');
  }

  // Validate auction
  if (listing.listingType !== 'auction') {
    res.status(400);
    throw new Error('This listing is not an auction');
  }

  if (listing.status !== 'active') {
    res.status(400);
    throw new Error('Auction is not active');
  }

  if (listing.auctionEndTime && listing.auctionEndTime < Date.now()) {
    res.status(400);
    throw new Error('Auction has ended');
  }

  if (listing.sellerId.toString() === req.user._id.toString()) {
    res.status(400);
    throw new Error('Cannot bid on your own auction');
  }

  // Validate bid amount
  const currentBid = listing.currentBid || listing.startingBid || 0;
  const minBidIncrement = currentBid * 0.05; // 5% minimum increment

  if (amount <= currentBid) {
    res.status(400);
    throw new Error(`Bid must be higher than current bid of ${currentBid}`);
  }

  if (amount < currentBid + minBidIncrement) {
    res.status(400);
    throw new Error(`Minimum bid increment is ${minBidIncrement.toFixed(2)}`);
  }

  // Place bid
  const bidder = await User.findById(req.user._id);

  listing.bidHistory.push({
    bidderId: req.user._id,
    bidderName: bidder.name,
    amount,
    timestamp: new Date()
  });

  listing.currentBid = amount;
  listing.highestBidder = req.user._id;

  await listing.save();

  logger.info(`Bid placed: ${amount} on auction ${listing._id} by user ${req.user._id}`);

  // Notify previous highest bidder (in production, send email/push)

  res.json({
    success: true,
    message: 'Bid placed successfully',
    data: {
      currentBid: listing.currentBid,
      bidCount: listing.bidHistory.length,
      auctionEndTime: listing.auctionEndTime
    }
  });
});

// @desc    Get user's listings
// @route   GET /api/marketplace/my-listings
// @access  Private
const getMyListings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const query = { sellerId: req.user._id };
  if (status) query.status = status;

  const listings = await MarketplaceListing.find(query)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await MarketplaceListing.countDocuments(query);

  // Get summary
  const summary = await MarketplaceListing.aggregate([
    { $match: { sellerId: mongoose.Types.ObjectId(req.user._id) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalCredits: { $sum: '$creditAmount' },
        soldCredits: { $sum: { $subtract: ['$creditAmount', '$availableAmount'] } }
      }
    }
  ]);

  res.json({
    success: true,
    data: listings,
    summary,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Get all rewards
// @route   GET /api/marketplace/rewards
// @access  Public
const getRewards = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    category,
    minCredits,
    maxCredits,
    search,
    sort = '-featured,-createdAt'
  } = req.query;

  // Build query
  const query = { 
    isActive: true,
    validUntil: { $gt: new Date() },
    validFrom: { $lt: new Date() }
  };

  if (category) query.category = category;
  
  if (minCredits || maxCredits) {
    query.creditCost = {};
    if (minCredits) query.creditCost.$gte = parseInt(minCredits);
    if (maxCredits) query.creditCost.$lte = parseInt(maxCredits);
  }

  if (search) {
    query.$text = { $search: search };
  }

  // Parse sort
  const sortOptions = {};
  const sortFields = sort.split(',');
  sortFields.forEach(field => {
    if (field.startsWith('-')) {
      sortOptions[field.substring(1)] = -1;
    } else {
      sortOptions[field] = 1;
    }
  });

  const rewards = await Reward.find(query)
    .populate('partnerId', 'name profileImage')
    .sort(sortOptions)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Reward.countDocuments(query);

  // Get categories with counts
  const categories = await Reward.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.json({
    success: true,
    data: rewards,
    categories,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Get single reward
// @route   GET /api/marketplace/rewards/:id
// @access  Public
const getRewardById = asyncHandler(async (req, res) => {
  const reward = await Reward.findById(req.params.id)
    .populate('partnerId', 'name email profileImage');

  if (!reward) {
    res.status(404);
    throw new Error('Reward not found');
  }

  // Increment view count
  reward.views += 1;
  await reward.save();

  res.json({
    success: true,
    data: reward
  });
});

// @desc    Redeem a reward
// @route   POST /api/marketplace/rewards/:id/redeem
// @access  Private
const redeemReward = asyncHandler(async (req, res) => {
  const reward = await Reward.findById(req.params.id);

  if (!reward) {
    res.status(404);
    throw new Error('Reward not found');
  }

  // Check availability
  if (!reward.isActive) {
    res.status(400);
    throw new Error('Reward is not active');
  }

  if (reward.validUntil < Date.now()) {
    res.status(400);
    throw new Error('Reward has expired');
  }

  if (reward.validFrom > Date.now()) {
    res.status(400);
    throw new Error('Reward is not yet available');
  }

  if (reward.stock === 0) {
    res.status(400);
    throw new Error('Reward is out of stock');
  }

  // Check user eligibility
  const user = await User.findById(req.user._id);

  if (reward.eligibility) {
    if (reward.eligibility.minSustainabilityScore > user.sustainabilityScore) {
      res.status(400);
      throw new Error(`Minimum sustainability score required: ${reward.eligibility.minSustainabilityScore}`);
    }

    if (reward.eligibility.minCreditsEarned > user.totalCreditsEarned) {
      res.status(400);
      throw new Error(`Minimum credits earned required: ${reward.eligibility.minCreditsEarned}`);
    }

    if (reward.eligibility.institutionOnly && 
        (!user.institutionId || !reward.eligibility.institutionIds.includes(user.institutionId))) {
      res.status(400);
      throw new Error('This reward is only available to specific institutions');
    }
  }

  // Check user hasn't exceeded max per user
  const userRedemptions = await CreditTransaction.countDocuments({
    fromUser: req.user._id,
    'redemptionDetails.rewardId': reward._id,
    type: 'redeemed'
  });

  if (userRedemptions >= reward.maxPerUser) {
    res.status(400);
    throw new Error(`Maximum redemptions per user: ${reward.maxPerUser}`);
  }

  // Check credit balance
  if (user.walletBalance < reward.creditCost) {
    res.status(400);
    throw new Error('Insufficient credits');
  }

  // Process redemption
  const redemptionResult = await creditService.redeemCredits(
    req.user._id,
    reward._id,
    {
      creditCost: reward.creditCost,
      name: reward.name,
      partnerId: reward.partnerId
    }
  );

  // Update reward stats
  reward.totalClaimed += 1;
  if (reward.stock > 0) {
    reward.stock -= 1;
  }
  await reward.save();

  logger.info(`Reward redeemed: ${reward.name} by user ${req.user._id}`);

  res.json({
    success: true,
    message: 'Reward redeemed successfully',
    data: {
      reward: {
        id: reward._id,
        name: reward.name,
        creditCost: reward.creditCost
      },
      redemption: redemptionResult,
      instructions: reward.redemptionInstructions,
      howToUse: reward.howToUse
    }
  });
});

// @desc    Get marketplace stats
// @route   GET /api/marketplace/stats
// @access  Public
const getMarketplaceStats = asyncHandler(async (req, res) => {
  const [listingStats, rewardStats, transactionStats] = await Promise.all([
    // Listing stats
    MarketplaceListing.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: null,
          totalListings: { $sum: 1 },
          totalCredits: { $sum: '$creditAmount' },
          avgPrice: { $avg: '$pricePerCredit' },
          minPrice: { $min: '$pricePerCredit' },
          maxPrice: { $max: '$pricePerCredit' }
        }
      }
    ]),

    // Reward stats
    Reward.aggregate([
      { $match: { isActive: true, validUntil: { $gt: new Date() } } },
      {
        $group: {
          _id: null,
          totalRewards: { $sum: 1 },
          avgCredits: { $avg: '$creditCost' },
          minCredits: { $min: '$creditCost' },
          maxCredits: { $max: '$creditCost' },
          totalValue: { $sum: '$monetaryValue' }
        }
      }
    ]),

    // Transaction stats (last 30 days)
    CreditTransaction.aggregate([
      {
        $match: {
          type: 'purchased',
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: null,
          totalVolume: { $sum: '$amount' },
          totalTransactions: { $sum: 1 },
          avgTransaction: { $avg: '$amount' }
        }
      }
    ])
  ]);

  // Get category distribution
  const categoryDistribution = await MarketplaceListing.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalCredits: { $sum: '$creditAmount' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.json({
    success: true,
    data: {
      listings: listingStats[0] || { totalListings: 0, totalCredits: 0 },
      rewards: rewardStats[0] || { totalRewards: 0 },
      transactions: transactionStats[0] || { totalVolume: 0, totalTransactions: 0 },
      categoryDistribution,
      timestamp: new Date()
    }
  });
});

// @desc    Create a new reward (Admin/Partner)
// @route   POST /api/marketplace/rewards
// @access  Private/Admin
const createReward = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    category,
    imageUrl,
    creditCost,
    monetaryValue,
    partnerName,
    stock,
    validUntil,
    redemptionType,
    redemptionInstructions,
    termsAndConditions,
    howToUse
  } = req.body;

  const reward = await Reward.create({
    name,
    description,
    category,
    imageUrl,
    creditCost,
    monetaryValue,
    partnerId: req.user._id,
    partnerName: partnerName || req.user.name,
    partnerVerified: req.user.role === 'admin',
    stock: stock || -1,
    validUntil: validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    redemptionType: redemptionType || 'qr',
    redemptionInstructions,
    termsAndConditions,
    howToUse: howToUse || [],
    isActive: true
  });

  // Log administrative action
  await AdminLog.create({
    adminId: req.user._id,
    adminName: req.user.name,
    action: 'CREATE_REWARD',
    targetType: 'Reward',
    targetId: reward._id,
    details: { name: reward.name, cost: reward.creditCost },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  logger.info(`Reward created: ${reward._id} by ${req.user._id}`);

  res.status(201).json({
    success: true,
    data: reward
  });
});

// @desc    Update reward
// @route   PUT /api/marketplace/rewards/:id
// @access  Private/Admin
const updateReward = asyncHandler(async (req, res) => {
  const reward = await Reward.findById(req.params.id);

  if (!reward) {
    res.status(404);
    throw new Error('Reward not found');
  }

  // Check ownership (only if partner or admin)
  if (reward.partnerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to update this reward');
  }

  const updatedReward = await Reward.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  // Log administrative action
  await AdminLog.create({
    adminId: req.user._id,
    adminName: req.user.name,
    action: 'UPDATE_REWARD',
    targetType: 'Reward',
    targetId: updatedReward._id,
    details: { changes: Object.keys(req.body) },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  res.json({
    success: true,
    data: updatedReward
  });
});

// @desc    Add review to listing
// @route   POST /api/marketplace/listings/:id/review
// @access  Private
const addListingReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const listing = await MarketplaceListing.findById(req.params.id);

  if (!listing) {
    res.status(404);
    throw new Error('Listing not found');
  }

  // Check if user already reviewed
  const alreadyReviewed = listing.reviews.find(
    (r) => r.userId.toString() === req.user._id.toString()
  );

  if (alreadyReviewed) {
    res.status(400);
    throw new Error('Listing already reviewed');
  }

  const review = {
    userId: req.user._id,
    rating: Number(rating),
    comment,
    createdAt: new Date()
  };

  listing.reviews.push(review);
  await listing.save();

  res.status(201).json({ success: true, message: 'Review added' });
});

// @desc    Add review to reward
// @route   POST /api/marketplace/rewards/:id/review
// @access  Private
const addRewardReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const reward = await Reward.findById(req.params.id);

  if (!reward) {
    res.status(404);
    throw new Error('Reward not found');
  }

  const review = {
    userId: req.user._id,
    rating: Number(rating),
    comment,
    createdAt: new Date()
  };

  reward.reviews.push(review);
  await reward.save();

  res.status(201).json({ success: true, message: 'Review added' });
});

module.exports = {
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
};
