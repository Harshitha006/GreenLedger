const mongoose = require('mongoose');
const connectDB = require('../config/database');
const {
    User,
    Institution,
    Action,
    CreditTransaction,
    MarketplaceListing,
    Reward,
    Competition,
    FraudAlert
} = require('../models');

const createIndexes = async () => {
    try {
        await connectDB();
        console.log('📊 Creating database indexes...');

        // User indexes
        await User.createIndexes();
        console.log('✅ User indexes created');

        // Institution indexes
        await Institution.createIndexes();
        console.log('✅ Institution indexes created');

        // Action indexes
        await Action.createIndexes();
        console.log('✅ Action indexes created');

        // CreditTransaction indexes
        await CreditTransaction.createIndexes();
        console.log('✅ CreditTransaction indexes created');

        // MarketplaceListing indexes
        await MarketplaceListing.createIndexes();
        console.log('✅ MarketplaceListing indexes created');

        // Reward indexes
        await Reward.createIndexes();
        console.log('✅ Reward indexes created');

        // Competition indexes
        await Competition.createIndexes();
        console.log('✅ Competition indexes created');

        // FraudAlert indexes
        await FraudAlert.createIndexes();
        console.log('✅ FraudAlert indexes created');

        console.log('🎉 All indexes created successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating indexes:', error);
        process.exit(1);
    }
};

createIndexes();
