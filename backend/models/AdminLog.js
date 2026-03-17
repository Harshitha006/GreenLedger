const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  adminName: String,
  action: {
    type: String,
    required: true,
    enum: [
      'APPROVE_ACTION', 'REJECT_ACTION', 'BAN_USER', 'UNBAN_USER', 'UPDATE_USER',
      'CREATE_REWARD', 'UPDATE_REWARD', 'DELETE_LISTING', 'VERIFY_LISTING',
      'SYSTEM_CONFIG_CHANGE', 'RESOLVE_FRAUD', 'VERIFY_PARTNER'
    ]
  },
  targetType: {
    type: String,
    required: true,
    enum: ['User', 'Action', 'MarketplaceListing', 'Reward', 'FraudAlert', 'System']
  },
  targetId: mongoose.Schema.Types.ObjectId,
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: String,
  userAgent: String,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

const AdminLog = mongoose.model('AdminLog', adminLogSchema);
module.exports = AdminLog;
