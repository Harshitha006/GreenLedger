// Export all models for easy import
const User = require('./User');
const Institution = require('./Institution');
const Action = require('./Action');
const CreditTransaction = require('./CreditTransaction');
const MarketplaceListing = require('./MarketplaceListing');
const Reward = require('./Reward');
const Competition = require('./Competition');
const FraudAlert = require('./FraudAlert');

module.exports = {
    User,
    Institution,
    Action,
    CreditTransaction,
    MarketplaceListing,
    Reward,
    Competition,
    FraudAlert
};
