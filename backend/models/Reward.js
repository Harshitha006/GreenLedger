const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Reward name is required'],
    trim: true,
    minlength: [3, 'Name must be at least 3 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    minlength: [10, 'Description must be at least 10 characters'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [200, 'Short description cannot exceed 200 characters']
  },
  category: {
    type: String,
    enum: {
      values: ['food', 'shopping', 'transport', 'donation', 'education', 'entertainment', 'health', 'travel', 'other'],
      message: '{VALUE} is not a valid category'
    },
    required: true,
    index: true
  },
  subcategory: String,
  
  // Images
  imageUrl: {
    type: String,
    required: [true, 'Reward image is required']
  },
  gallery: [{
    url: String,
    caption: String
  }],
  
  // Cost
  creditCost: {
    type: Number,
    required: true,
    min: [1, 'Credit cost must be at least 1'],
    max: [100000, 'Credit cost cannot exceed 100,000']
  },
  monetaryValue: {
    type: Number,
    min: 0,
    comment: 'Approximate monetary value in INR'
  },
  
  // Discount/Value proposition
  discountPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  savingsAmount: {
    type: Number,
    min: 0
  },
  
  // Partner
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  partnerName: {
    type: String,
    required: true
  },
  partnerLogo: String,
  partnerRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  partnerVerified: {
    type: Boolean,
    default: false
  },
  
  // Availability
  stock: {
    type: Number,
    default: -1 // -1 means unlimited
  },
  totalClaimed: {
    type: Number,
    default: 0
  },
  maxPerUser: {
    type: Number,
    default: 1 // Maximum claims per user
  },
  
  // Validity
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: true
  },
  redemptionWindow: {
    type: Number, // days after purchase to redeem
    default: 30
  },
  
  // Redemption details
  redemptionType: {
    type: String,
    enum: ['qr', 'code', 'link', 'instore', 'coupon'],
    default: 'qr'
  },
  redemptionInstructions: {
    type: String,
    maxlength: 1000
  },
  termsAndConditions: {
    type: String,
    maxlength: 5000
  },
  howToUse: [String],
  
  // Location (for in-store)
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      index: '2dsphere'
    },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: 'India' }
    },
    landmark: String
  },
  
  // Online redemption
  website: String,
  phoneNumber: String,
  email: String,
  
  // Status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  featured: {
    type: Boolean,
    default: false,
    index: true
  },
  trending: {
    type: Boolean,
    default: false
  },
  verified: {
    type: Boolean,
    default: false
  },
  
  // Tags and categories
  tags: [{
    type: String,
    index: true
  }],
  
  // Eligibility
  eligibility: {
    minSustainabilityScore: { type: Number, default: 0 },
    minCreditsEarned: { type: Number, default: 0 },
    institutionOnly: { type: Boolean, default: false },
    institutionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Institution' }],
    countryRestriction: [String],
    ageRestriction: { type: Number, min: 0 }
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
  clicks: {
    type: Number,
    default: 0
  },
  favorites: {
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
  reviewCount: {
    type: Number,
    default: 0
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

// Virtual for popularity score
rewardSchema.virtual('popularity').get(function() {
  if (this.views === 0) return 0;
  return ((this.totalClaimed * 10) + (this.favorites * 5) + (this.clicks)) / this.views;
});

// Virtual for savings percentage
rewardSchema.virtual('savingsPercentage').get(function() {
  if (!this.monetaryValue || this.monetaryValue === 0) return 0;
  const effectiveValue = this.creditCost * 10; // Assuming ₹10 per credit
  return Math.round(((this.monetaryValue - effectiveValue) / this.monetaryValue) * 100);
});

// Virtual for is available
rewardSchema.virtual('isAvailable').get(function() {
  if (!this.isActive) return false;
  if (this.stock === 0) return false;
  if (this.validUntil && this.validUntil < Date.now()) return false;
  if (this.validFrom && this.validFrom > Date.now()) return false;
  return true;
});

// Pre-save middleware
rewardSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Update average rating
  if (this.reviews && this.reviews.length > 0) {
    const sum = this.reviews.reduce((acc, review) => acc + review.rating, 0);
    this.averageRating = sum / this.reviews.length;
    this.reviewCount = this.reviews.length;
  }
  
  next();
});

// Indexes
rewardSchema.index({ category: 1, isActive: 1, featured: -1 });
rewardSchema.index({ creditCost: 1 });
rewardSchema.index({ partnerId: 1, isActive: 1 });
rewardSchema.index({ validFrom: 1, validUntil: 1 });
rewardSchema.index({ tags: 1 });
rewardSchema.index({ averageRating: -1 });
rewardSchema.index({ createdAt: -1 });
rewardSchema.index({ 'location.coordinates': '2dsphere' });

const Reward = mongoose.model('Reward', rewardSchema);
module.exports = Reward;
