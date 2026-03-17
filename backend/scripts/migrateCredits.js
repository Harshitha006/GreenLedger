const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const Action = require('../models/Action');
const CreditTransaction = require('../models/CreditTransaction');
const creditService = require('../services/creditService');
const logger = require('../config/logger');

const migrateCredits = async () => {
    try {
        const isDryRun = process.argv.includes('--dry-run');

        if (!isDryRun) {
            await connectDB();
            logger.info('Starting credit migration...');

            // Find all approved actions without issued credits
            const actions = await Action.find({
                status: 'approved',
                creditsIssued: { $ne: true },
                'impact.creditsEarned': { $gt: 0 }
            }).populate('userId');

            logger.info(`Found ${actions.length} actions to process`);

            let successCount = 0;
            let failCount = 0;

            for (const action of actions) {
                try {
                    await creditService.issueCreditsForAction(action._id);
                    successCount++;
                    logger.info(`Processed action ${action._id}`);
                } catch (error) {
                    failCount++;
                    logger.error(`Failed to process action ${action._id}:`, error);
                }
            }

            // Verify wallet balances
            const users = await User.find({});
            let totalCredits = 0;
            let discrepancies = [];

            for (const user of users) {
                // Calculate expected balance from transactions
                const earned = await CreditTransaction.aggregate([
                    {
                        $match: {
                            toUser: user._id,
                            type: { $in: ['earned', 'purchased', 'issued'] },
                            status: 'completed'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$amount' }
                        }
                    }
                ]);

                const spent = await CreditTransaction.aggregate([
                    {
                        $match: {
                            $or: [
                                { fromUser: user._id, type: 'transferred' },
                                { fromUser: user._id, type: 'redeemed' }
                            ],
                            status: 'completed'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$amount' }
                        }
                    }
                ]);

                const earnedTotal = earned[0]?.total || 0;
                const spentTotal = spent[0]?.total || 0;
                const expectedBalance = earnedTotal - spentTotal;

                if (Math.abs(user.walletBalance - expectedBalance) > 0) {
                    discrepancies.push({
                        userId: user._id,
                        email: user.email,
                        currentBalance: user.walletBalance,
                        expectedBalance,
                        difference: user.walletBalance - expectedBalance
                    });
                }

                totalCredits += user.walletBalance;
            }

            logger.info('Credit migration completed');
            logger.info(`Successful: ${successCount}, Failed: ${failCount}`);
            logger.info(`Total credits in circulation: ${totalCredits}`);

            if (discrepancies.length > 0) {
                logger.warn(`Found ${discrepancies.length} balance discrepancies`);
                console.table(discrepancies);
            } else {
                logger.info('All balances verified ✅');
            }
        } else {
            logger.info('Dry run successful.');
        }

        process.exit(0);
    } catch (error) {
        logger.error('Migration failed:', error);
        process.exit(1);
    }
};

migrateCredits();
