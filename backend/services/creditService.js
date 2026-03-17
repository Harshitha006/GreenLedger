const CreditTransaction = require('../models/CreditTransaction');
const User = require('../models/User');
const Institution = require('../models/Institution');
const Action = require('../models/Action');
const { calculateImpact } = require('../utils/impactCalculator');
const logger = require('../config/logger');
const mongoose = require('mongoose');

class CreditService {
    constructor() {
        this.CREDIT_CONVERSION = {
            CO2_PER_CREDIT: 10, // 1 credit = 10 kg CO2
            MIN_CREDITS_PER_TRANSACTION: 1,
            MAX_CREDITS_PER_TRANSACTION: 10000,
            TRANSACTION_FEE_PERCENTAGE: 0.02, // 2% fee
            INSTITUTION_FEE_PERCENTAGE: 0.1, // 10% for institution
        };
    }

    // Issue credits for approved action
    async issueCreditsForAction(actionId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const action = await Action.findById(actionId)
                .populate('userId')
                .session(session);

            if (!action) {
                throw new Error('Action not found');
            }

            if (action.status !== 'approved') {
                throw new Error('Action must be approved before issuing credits');
            }

            if (action.creditsIssued) {
                throw new Error('Credits already issued for this action');
            }

            // Calculate impact if not already calculated
            if (!action.impact || action.impact.creditsEarned === 0) {
                action.impact = await calculateImpact(action);
                await action.save({ session });
            }

            const creditsToIssue = action.impact.creditsEarned;

            if (creditsToIssue <= 0) {
                logger.info(`No credits to issue for action ${actionId}`);
                return { creditsIssued: 0 };
            }

            // Create credit transaction
            const transaction = new CreditTransaction({
                toUser: action.userId._id,
                amount: creditsToIssue,
                type: 'earned',
                actionId: action._id,
                description: `Credits earned for ${action.actionType} action`,
                status: 'completed',
                metadata: {
                    actionType: action.actionType,
                    co2Saved: action.impact.co2SavedKg,
                    verifiedAt: action.verifiedAt
                }
            });

            await transaction.save({ session });

            // Update user wallet
            const user = action.userId;
            user.walletBalance += creditsToIssue;
            user.totalCreditsEarned += creditsToIssue;
            user.totalCO2Saved += action.impact.co2SavedKg;
            user.totalEnergySaved += action.impact.energySavedKwh;
            user.totalWaterSaved += action.impact.waterSavedL;
            user.verifiedActionsCount += 1;

            // Update sustainability score
            user.sustainabilityScore = this.calculateSustainabilityScore(user);

            await user.save({ session });

            // Mark action as credits issued
            action.creditsIssued = true;
            action.creditsIssuedAt = new Date();
            await action.save({ session });

            await session.commitTransaction();

            logger.info(`Issued ${creditsToIssue} credits for action ${actionId} to user ${user._id}`);

            return {
                transactionId: transaction._id,
                creditsIssued: creditsToIssue,
                userBalance: user.walletBalance,
                impact: action.impact
            };

        } catch (error) {
            await session.abortTransaction();
            logger.error('Credit issuance failed:', error);
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Transfer credits between users
    async transferCredits(fromUserId, toUserId, amount, description = '') {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Validate amount
            if (amount < this.CREDIT_CONVERSION.MIN_CREDITS_PER_TRANSACTION) {
                throw new Error(`Minimum transfer amount is ${this.CREDIT_CONVERSION.MIN_CREDITS_PER_TRANSACTION} credits`);
            }

            if (amount > this.CREDIT_CONVERSION.MAX_CREDITS_PER_TRANSACTION) {
                throw new Error(`Maximum transfer amount is ${this.CREDIT_CONVERSION.MAX_CREDITS_PER_TRANSACTION} credits`);
            }

            // Get users
            const fromUser = await User.findById(fromUserId).session(session);
            const toUser = await User.findById(toUserId).session(session);

            if (!fromUser || !toUser) {
                throw new Error('User not found');
            }

            // Check balance
            if (fromUser.walletBalance < amount) {
                throw new Error('Insufficient credits');
            }

            // Calculate fee
            const fee = Math.floor(amount * this.CREDIT_CONVERSION.TRANSACTION_FEE_PERCENTAGE);
            const netAmount = amount - fee;

            // Get balances before
            const balanceBefore = {
                fromUser: fromUser.walletBalance,
                toUser: toUser.walletBalance
            };

            // Update wallets
            fromUser.walletBalance -= amount;
            toUser.walletBalance += netAmount;

            await fromUser.save({ session });
            await toUser.save({ session });

            // Create transaction record
            const transaction = new CreditTransaction({
                fromUser: fromUserId,
                toUser: toUserId,
                amount: netAmount,
                grossAmount: amount,
                fee: {
                    amount: fee,
                    percentage: this.CREDIT_CONVERSION.TRANSACTION_FEE_PERCENTAGE * 100,
                    collectedBy: 'platform'
                },
                type: 'transferred',
                description: description || 'Credit transfer',
                balanceBefore,
                balanceAfter: {
                    fromUser: fromUser.walletBalance,
                    toUser: toUser.walletBalance
                },
                status: 'completed'
            });

            await transaction.save({ session });

            await session.commitTransaction();

            logger.info(`Transferred ${netAmount} credits from ${fromUserId} to ${toUserId}`);

            return {
                transactionId: transaction._id,
                amount: netAmount,
                fee,
                fromBalance: fromUser.walletBalance,
                toBalance: toUser.walletBalance
            };

        } catch (error) {
            await session.abortTransaction();
            logger.error('Credit transfer failed:', error);
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Redeem credits for rewards
    async redeemCredits(userId, rewardId, rewardDetails) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const user = await User.findById(userId).session(session);

            if (!user) {
                throw new Error('User not found');
            }

            const { creditCost, name, partnerId } = rewardDetails;

            // Check balance
            if (user.walletBalance < creditCost) {
                throw new Error('Insufficient credits');
            }

            // Get balances before
            const balanceBefore = user.walletBalance;

            // Update wallet
            user.walletBalance -= creditCost;
            user.totalCreditsRedeemed += creditCost;

            // Update sustainability score (redemption rate is a factor)
            user.sustainabilityScore = this.calculateSustainabilityScore(user);

            await user.save({ session });

            // Create transaction record
            const transaction = new CreditTransaction({
                fromUser: userId,
                amount: creditCost,
                type: 'redeemed',
                description: `Redeemed for: ${name}`,
                redemptionDetails: {
                    rewardId,
                    rewardName: name,
                    partnerId,
                    redemptionCode: this.generateRedemptionCode(),
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
                },
                balanceBefore: {
                    fromUser: balanceBefore
                },
                balanceAfter: {
                    fromUser: user.walletBalance
                },
                status: 'completed'
            });

            await transaction.save({ session });

            await session.commitTransaction();

            logger.info(`User ${userId} redeemed ${creditCost} credits for ${name}`);

            return {
                transactionId: transaction._id,
                creditsRedeemed: creditCost,
                newBalance: user.walletBalance,
                redemptionCode: transaction.redemptionDetails.redemptionCode,
                expiresAt: transaction.redemptionDetails.expiresAt
            };

        } catch (error) {
            await session.abortTransaction();
            logger.error('Redemption failed:', error);
            throw error;
        } finally {
            session.endSession();
        }
    }

    // CSR purchase (company buys credits)
    async csrPurchase(companyId, amount, purpose) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const company = await User.findById(companyId).session(session);

            if (!company) {
                throw new Error('Company not found');
            }

            // In real implementation, this would process payment
            // For now, we'll create the transaction

            // Calculate distribution
            const userShare = Math.floor(amount * 0.7); // 70% to users
            const platformShare = Math.floor(amount * 0.2); // 20% to platform
            const institutionShare = Math.floor(amount * 0.1); // 10% to institutions

            // Create transaction record
            const transaction = new CreditTransaction({
                toUser: companyId,
                amount: amount,
                type: 'purchased',
                description: `CSR purchase: ${purpose}`,
                csrDetails: {
                    companyId,
                    companyName: company.name,
                    purpose,
                    invoiceNumber: this.generateInvoiceNumber()
                },
                status: 'completed',
                metadata: {
                    distribution: {
                        userShare,
                        platformShare,
                        institutionShare
                    }
                }
            });

            await transaction.save({ session });

            // Update company wallet (they now own the credits)
            company.walletBalance += amount;
            await company.save({ session });

            await session.commitTransaction();

            logger.info(`CSR purchase: ${company.name} bought ${amount} credits`);

            return {
                transactionId: transaction._id,
                amount,
                invoiceNumber: transaction.csrDetails.invoiceNumber,
                distribution: {
                    userShare,
                    platformShare,
                    institutionShare
                }
            };

        } catch (error) {
            await session.abortTransaction();
            logger.error('CSR purchase failed:', error);
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Get user credit history
    async getUserCreditHistory(userId, filters = {}) {
        const { type, limit = 50, page = 1 } = filters;

        const query = {
            $or: [
                { fromUser: userId },
                { toUser: userId }
            ]
        };

        if (type) {
            query.type = type;
        }

        const transactions = await CreditTransaction.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('fromUser', 'name email')
            .populate('toUser', 'name email')
            .populate('actionId');

        const total = await CreditTransaction.countDocuments(query);

        // Calculate summary
        const summary = await CreditTransaction.aggregate([
            {
                $match: {
                    $or: [
                        { fromUser: new mongoose.Types.ObjectId(userId) },
                        { toUser: new mongoose.Types.ObjectId(userId) }
                    ]
                }
            },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        return {
            transactions,
            summary,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    // Get user credit summary
    async getUserCreditSummary(userId) {
        const user = await User.findById(userId)
            .select('walletBalance totalCreditsEarned totalCreditsRedeemed sustainabilityScore');

        if (!user) {
            throw new Error('User not found');
        }

        // Get recent activity
        const recentTransactions = await CreditTransaction.find({
            $or: [
                { fromUser: userId },
                { toUser: userId }
            ]
        })
            .sort({ createdAt: -1 })
            .limit(5);

        // Get monthly stats
        const monthlyStats = await CreditTransaction.aggregate([
            {
                $match: {
                    $or: [
                        { fromUser: new mongoose.Types.ObjectId(userId) },
                        { toUser: new mongoose.Types.ObjectId(userId) }
                    ],
                    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    earned: {
                        $sum: {
                            $cond: [
                                { $eq: ['$type', 'earned'] },
                                '$amount',
                                0
                            ]
                        }
                    },
                    spent: {
                        $sum: {
                            $cond: [
                                { $in: ['$type', ['redeemed', 'transferred']] },
                                '$amount',
                                0
                            ]
                        }
                    }
                }
            },
            { $sort: { '_id': -1 } },
            { $limit: 30 }
        ]);

        return {
            currentBalance: user.walletBalance,
            totalEarned: user.totalCreditsEarned,
            totalRedeemed: user.totalCreditsRedeemed,
            sustainabilityScore: user.sustainabilityScore,
            recentTransactions,
            monthlyStats,
            utilizationRate: user.totalCreditsEarned > 0
                ? (user.totalCreditsRedeemed / user.totalCreditsEarned * 100).toFixed(2)
                : 0
        };
    }

    // Get leaderboard
    async getLeaderboard(filters = {}) {
        const { institutionId, limit = 100 } = filters;

        const query = {};
        if (institutionId) {
            query.institutionId = institutionId;
        }

        const leaderboard = await User.find(query)
            .select('name walletBalance totalCreditsEarned sustainabilityScore profileImage institutionId')
            .sort({ walletBalance: -1 })
            .limit(limit)
            .populate('institutionId', 'name');

        // Add ranks
        return leaderboard.map((user, index) => ({
            rank: index + 1,
            ...user.toObject()
        }));
    }

    // Calculate sustainability score
    calculateSustainabilityScore(user) {
        const factors = {
            creditsEarned: Math.min(user.totalCreditsEarned / 1000, 40), // Max 40 points
            consistency: Math.min(user.verifiedActionsCount * 2, 20), // Max 20 points
            co2Saved: Math.min(user.totalCO2Saved / 500, 20), // Max 20 points
            redemptionRate: user.totalCreditsEarned > 0
                ? Math.min((user.totalCreditsRedeemed / user.totalCreditsEarned) * 10, 10) // Max 10 points
                : 0,
            accountAge: Math.min(Math.floor((Date.now() - user.createdAt) / (30 * 24 * 60 * 60 * 1000)), 10) // Max 10 points
        };

        const total = Object.values(factors).reduce((sum, val) => sum + val, 0);
        return Math.min(Math.round(total), 100);
    }

    // Generate redemption code
    generateRedemptionCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `GL-${code}`;
    }

    // Generate invoice number
    generateInvoiceNumber() {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 7).toUpperCase();
        return `INV-${timestamp}-${random}`;
    }

    // Validate credit amount
    validateCreditAmount(amount, type = 'transfer') {
        if (!Number.isInteger(amount)) {
            throw new Error('Amount must be an integer');
        }

        if (amount < this.CREDIT_CONVERSION.MIN_CREDITS_PER_TRANSACTION) {
            throw new Error(`Minimum amount is ${this.CREDIT_CONVERSION.MIN_CREDITS_PER_TRANSACTION} credits`);
        }

        if (amount > this.CREDIT_CONVERSION.MAX_CREDITS_PER_TRANSACTION) {
            throw new Error(`Maximum amount is ${this.CREDIT_CONVERSION.MAX_CREDITS_PER_TRANSACTION} credits`);
        }

        return true;
    }

    // Batch issue credits
    async batchIssueCredits(actionIds) {
        const results = {
            succeeded: [],
            failed: []
        };

        for (const actionId of actionIds) {
            try {
                const result = await this.issueCreditsForAction(actionId);
                results.succeeded.push({
                    actionId,
                    creditsIssued: result.creditsIssued
                });
            } catch (error) {
                logger.error(`Batch issue failed for action ${actionId}:`, error);
                results.failed.push({
                    actionId,
                    error: error.message
                });
            }
        }

        return results;
    }
}

module.exports = new CreditService();
