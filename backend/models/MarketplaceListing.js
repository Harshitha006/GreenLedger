const mongoose = require('mongoose');

const marketplaceListingSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Seller ID is required'],
    index: true
  },
  sellerName: {
    type: String,
    required: true
  },
  sellerRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  sellerVerified: {
    type: Boolean,
    default: false
  },
  
  creditAmount: {
    type: Number,
    required: [true, 'Credit amount is required'],
    min: [1, 'Must list at least 1 credit'],
    max: [100000, 'Cannot list more than 100,000 credits']
  },
  
  availableAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  pricePerCredit: {
    type: Number,
    required: [true, 'Price per credit is required'],
    min: [0.01, 'Price must be at least ₹0.01'],
    max: [1000, 'Price cannot exceed ₹1000']
  },
  
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  
  currency: {
    type: String,
    enum: ['INR', 'USD', 'EUR'],
    default: 'INR'
  },
  
  listingType: {
    type: String,
    enum: ['fixed', 'negotiable', 'auction', 'bulk'],
    default: 'fixed'
  },
  
  // For bulk listings
  minPurchaseAmount: {
    type: Number,
    default: 1
  },
  maxPurchaseAmount: {
    type: Number,
    default: null
  },
  
  // For auctions
  startingBid: {
    type: Number,
    min: 0
  },
  currentBid: {
    type: Number,
    min: 0
  },
  highestBidder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  bidHistory: [{
    bidderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    bidderName: String,
    amount: {
      type: Number,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    automatic: {
      type: Boolean,
      default: false
    }
  }],
  reservePrice: {
    type: Number,
    min: 0
  },
  auctionEndTime: {
    type: Date
  },
  
  // Listing details
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    minlength: [5, 'Title must be at least 5 characters'],
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    minlength: [10, 'Description must be at least 10 characters'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  
  category: {
    type: String,
    enum: ['personal', 'institutional', 'csr', 'charity', 'business'],
    default: 'personal'
  },
  
  tags: [{
    type: String,
    trim: true
  }],
  
  images: [{
    url: String,
    caption: String,
    isPrimary: { type: Boolean, default: false }
  }],
  
  // Credit source
  creditSource: {
    type: String,
    enum: ['earned', 'purchased', 'inherited', 'reward'],
    default: 'earned'
  },
  
  // For institutional listings
  institutionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution'
  },
  institutionName: String,
  
  // For CSR listings
  csrDetails: {
    companyId: String,
    companyName: String,
    purpose: String,
    taxBenefit: Boolean
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'sold', 'expired', 'cancelled', 'pending'],
    default: 'active'
  },
  
  // Verification
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedAt: Date,
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verificationNotes: String,
  
  // Purchase tracking
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  buyerName: String,
  soldAt: Date,
  purchaseAmount: Number,
  
  // Expiry
  expiresAt: {
    type: Date,
    required: true,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    }
  },
  
  // Stats
  views: {
    type: Number,
    default: 0
  },
  uniqueViews: {
    type: Number,
    default: 0
  },
  interestedCount: {
    type: Number,
    default: 0
  },
  shareCount: {
    type: Number,
    default: 0
  },
  
  // Reviews
  reviews: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    createdAt: { type: Date, default: Date.now }
  }],
  averageRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  
  // Transaction
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CreditTransaction'
  },
  
  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
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

// Virtual for remaining time
marketplaceListingSchema.virtual('timeRemaining').get(function() {
  const now = Date.now();
  if (now > this.expiresAt) return 'Expired';
  
  const diff = this.expiresAt - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
});

// Virtual for discount percentage
marketplaceListingSchema.virtual('discountPercentage').get(function() {
  // Compare with average market price (would need external data)
  return 0;
});

// Virtual for completion percentage (for bulk listings)
marketplaceListingSchema.virtual('completionPercentage').get(function() {
  if (!this.creditAmount) return 0;
  const sold = this.creditAmount - (this.availableAmount || this.creditAmount);
  return Math.round((sold / this.creditAmount) * 100);
});

// Virtual for bid count (auctions)
marketplaceListingSchema.virtual('bidCount').get(function() {
  return this.bidHistory?.length || 0;
});

// Pre-save middleware
marketplaceListingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate total price
  this.totalPrice = this.creditAmount * this.pricePerCredit;
  
  // Set available amount if not set
  if (!this.availableAmount) {
    this.availableAmount = this.creditAmount;
  }
  
  // Update auction status
  if (this.listingType === 'auction' && this.auctionEndTime) {
    if (Date.now() > this.auctionEndTime) {
      this.status = 'expired';
    }
  }
  
  // Update average rating
  if (this.reviews && this.reviews.length > 0) {
    const sum = this.reviews.reduce((acc, review) => acc + review.rating, 0);
    this.averageRating = sum / this.reviews.length;
  }
  
  next();
});

// Indexes
marketplaceListingSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
marketplaceListingSchema.index({ status: 1, expiresAt: 1 });
marketplaceListingSchema.index({ listingType: 1, status: 1, pricePerCredit: 1 });
marketplaceListingSchema.index({ category: 1, status: 1 });
marketplaceListingSchema.index({ tags: 1 });
marketplaceListingSchema.index({ 'sellerRating': -1 });
marketplaceListingSchema.index({ createdAt: -1 });
marketplaceListingSchema.index({ pricePerCredit: 1 });
marketplaceListingSchema.index({ creditAmount: 1 });
marketplaceListingSchema.index({ institutionId: 1, status: 1 });

const MarketplaceListing = mongoose.model('MarketplaceListing', marketplaceListingSchema);
module.exports = MarketplaceListing;
