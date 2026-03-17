const mongoose = require('mongoose');
const User = require('../models/User');
const MarketplaceListing = require('../models/MarketplaceListing');
const Reward = require('../models/Reward');
const logger = require('../config/logger');
require('dotenv').config();

const seedMarketplace = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/greenledger');
    logger.info('Connected to MongoDB for marketplace seeding...');

    // Clear existing data
    await MarketplaceListing.deleteMany({});
    await Reward.deleteMany({});
    logger.info('Cleared existing marketplace data');

    // Get users
    const users = await User.find({ role: 'user' }).limit(5);
    const admin = await User.findOne({ role: 'admin' });

    if (users.length === 0) {
      logger.error('No users found. Run seedData.js first.');
      process.exit(1);
    }

    // Create sample listings
    const listings = [];
    const listingTitles = [
      'Eco-friendly credits from solar savings',
      'Surplus electricity reduction credits',
      'Green commute credits available',
      'Water conservation credits for sale',
      'Tree plantation carbon credits'
    ];

    for (let i = 0; i < 5; i++) {
      const seller = users[i % users.length];
      const creditAmount = Math.floor(Math.random() * 500) + 100;
      const pricePerCredit = (Math.random() * 5 + 2).toFixed(2);
      
      listings.push({
        sellerId: seller._id,
        sellerName: seller.name,
        sellerRating: Math.random() * 2 + 3,
        creditAmount,
        availableAmount: creditAmount,
        pricePerCredit: parseFloat(pricePerCredit),
        totalPrice: creditAmount * pricePerCredit,
        title: listingTitles[i],
        description: `I earned these credits through ${['solar panels', 'electricity saving', 'public transport', 'rainwater harvesting', 'tree planting'][i]}. Looking to sell to support more green initiatives.`,
        listingType: ['fixed', 'negotiable', 'auction', 'bulk'][Math.floor(Math.random() * 4)],
        category: ['personal', 'institutional', 'charity'][Math.floor(Math.random() * 3)],
        tags: ['green', 'carbon', 'sustainable', 'eco-friendly'],
        status: 'active',
        views: Math.floor(Math.random() * 100),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }

    await MarketplaceListing.insertMany(listings);
    logger.info(`Created ${listings.length} sample listings`);

    // Create sample rewards
    const rewards = [
      {
        name: 'Free Coffee at Campus Cafe',
        description: 'Get a free coffee at any campus cafe. Valid for one month.',
        shortDescription: 'Complimentary coffee at campus cafes',
        category: 'food',
        imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93',
        creditCost: 25,
        monetaryValue: 150,
        discountPercentage: 40,
        partnerId: admin?._id || users[0]._id,
        partnerName: 'Campus Cafe Chain',
        stock: 100,
        totalClaimed: 45,
        maxPerUser: 2,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        redemptionType: 'qr',
        redemptionInstructions: 'Show the QR code at any participating cafe. Barista will scan to validate.',
        termsAndConditions: 'Valid only on weekdays. Cannot be combined with other offers.',
        howToUse: ['Order your coffee', 'Show QR code to cashier', 'Enjoy your free coffee!'],
        isActive: true,
        featured: true,
        tags: ['coffee', 'food', 'campus'],
        views: 234,
        favorites: 56,
        averageRating: 4.5,
        reviewCount: 12
      },
      {
        name: 'Movie Ticket Discount',
        description: 'Get 50% off on movie tickets at City Cinema',
        shortDescription: 'Half-price movie tickets',
        category: 'entertainment',
        imageUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c',
        creditCost: 50,
        monetaryValue: 400,
        discountPercentage: 50,
        partnerId: admin?._id || users[0]._id,
        partnerName: 'City Cinema',
        stock: 50,
        totalClaimed: 23,
        maxPerUser: 4,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        redemptionType: 'code',
        redemptionInstructions: 'You will receive a unique code. Enter it at the booking counter.',
        termsAndConditions: 'Valid for weekdays only. Not applicable on holidays.',
        howToUse: ['Book your tickets', 'Enter the discount code', 'Pay the discounted amount'],
        isActive: true,
        featured: true,
        tags: ['movie', 'entertainment', 'discount'],
        views: 156,
        favorites: 34,
        averageRating: 4.2,
        reviewCount: 8
      },
      {
        name: 'Eco-friendly Product Bundle',
        description: 'Get a bundle of eco-friendly products including reusable bag, bamboo toothbrush, and metal straw set.',
        shortDescription: 'Sustainable product bundle',
        category: 'shopping',
        imageUrl: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09',
        creditCost: 100,
        monetaryValue: 800,
        discountPercentage: 30,
        partnerId: admin?._id || users[0]._id,
        partnerName: 'Green Store',
        stock: 25,
        totalClaimed: 8,
        maxPerUser: 1,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
        redemptionType: 'link',
        redemptionInstructions: 'Click the redemption link and enter your shipping address.',
        termsAndConditions: 'Shipping within India only. Delivery in 5-7 business days.',
        howToUse: ['Redeem the reward', 'Fill shipping details', 'Receive products at home'],
        isActive: true,
        featured: false,
        tags: ['eco-friendly', 'products', 'bundle'],
        views: 89,
        favorites: 12,
        averageRating: 5.0,
        reviewCount: 3
      },
      {
        name: 'Public Transport Pass',
        description: 'One month unlimited public transport pass',
        shortDescription: 'Free transport for a month',
        category: 'transport',
        imageUrl: 'https://images.unsplash.com/photo-1577083552431-6e5fd01988b7',
        creditCost: 75,
        monetaryValue: 500,
        discountPercentage: 100,
        partnerId: admin?._id || users[0]._id,
        partnerName: 'City Transport Authority',
        stock: -1, // Unlimited
        totalClaimed: 67,
        maxPerUser: 1,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        redemptionType: 'qr',
        redemptionInstructions: 'QR code will be generated. Scan at metro/bus gates.',
        termsAndConditions: 'Valid for one calendar month from activation.',
        howToUse: ['Redeem reward', 'Activate pass', 'Scan QR while travelling'],
        isActive: true,
        featured: true,
        tags: ['transport', 'metro', 'bus', 'commute'],
        views: 312,
        favorites: 78,
        averageRating: 4.7,
        reviewCount: 15
      },
      {
        name: 'Donate to Tree Plantation',
        description: 'Donate your credits to plant trees in urban areas',
        shortDescription: 'Plant trees with your credits',
        category: 'donation',
        imageUrl: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09',
        creditCost: 10,
        monetaryValue: 100,
        discountPercentage: 0,
        partnerId: admin?._id || users[0]._id,
        partnerName: 'Green India Trust',
        stock: -1,
        totalClaimed: 189,
        maxPerUser: -1,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        redemptionType: 'link',
        redemptionInstructions: 'Your donation will be used to plant trees in urban areas.',
        termsAndConditions: 'Tax receipt available on request.',
        howToUse: ['Choose donation amount', 'Confirm donation', 'Get certificate'],
        isActive: true,
        featured: false,
        tags: ['donation', 'trees', 'environment'],
        views: 567,
        favorites: 123,
        averageRating: 4.9,
        reviewCount: 45
      }
    ];

    await Reward.insertMany(rewards);
    logger.info(`Created ${rewards.length} sample rewards`);

    // Create some sold/completed listings
    const soldListings = [];
    for (let i = 0; i < 3; i++) {
      const seller = users[i % users.length];
      const buyer = users[(i + 1) % users.length];
      const creditAmount = Math.floor(Math.random() * 300) + 50;
      
      soldListings.push({
        sellerId: seller._id,
        sellerName: seller.name,
        creditAmount,
        availableAmount: 0,
        pricePerCredit: (Math.random() * 4 + 3).toFixed(2),
        totalPrice: creditAmount * (Math.random() * 4 + 3),
        title: `Sold: ${listingTitles[i]}`,
        description: 'This listing has been sold.',
        listingType: 'fixed',
        category: 'personal',
        status: 'sold',
        buyerId: buyer._id,
        buyerName: buyer.name,
        soldAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000)
      });
    }

    await MarketplaceListing.insertMany(soldListings);
    logger.info(`Created ${soldListings.length} sold listings`);

    logger.info('✅ Marketplace seeding completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedMarketplace();
