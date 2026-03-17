require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/database');
const {
    User,
    Institution,
    Action,
    CreditTransaction,
    MarketplaceListing,
    Reward,
    Competition
} = require('../models');

const seedData = async () => {
    try {
        await connectDB();
        console.log('🌱 Seeding database...');

        // Clear existing data
        await Promise.all([
            User.deleteMany({}),
            Institution.deleteMany({}),
            Action.deleteMany({}),
            CreditTransaction.deleteMany({}),
            MarketplaceListing.deleteMany({}),
            Reward.deleteMany({}),
            Competition.deleteMany({})
        ]);
        console.log('✅ Cleared existing data');

        // Create admin user
        const admin = await User.create({
            name: 'Admin User',
            email: 'admin@greenledger.com',
            password: 'admin123',
            role: 'admin',
            isEmailVerified: true
        });
        console.log('✅ Admin user created');

        // Create test institution
        const institution = await Institution.create({
            name: 'Test University',
            type: 'university',
            description: 'A leading university in sustainability',
            contactEmail: 'sustainability@testuni.edu',
            contactPhone: '9876543210',
            address: {
                street: 'University Road',
                city: 'Mumbai',
                state: 'Maharashtra',
                pincode: '400001'
            },
            location: {
                coordinates: [72.8777, 19.0760]
            },
            adminId: admin._id,
            admins: [admin._id]
        });
        console.log('✅ Test institution created');

        // Create test users
        const users = await User.create([
            {
                name: 'John Student',
                email: 'john@testuni.edu',
                password: 'password123',
                role: 'user',
                institutionId: institution._id,
                isEmailVerified: true,
                walletBalance: 250,
                totalCreditsEarned: 500,
                totalCO2Saved: 1250,
                sustainabilityScore: 75
            },
            {
                name: 'Jane Teacher',
                email: 'jane@testuni.edu',
                password: 'password123',
                role: 'institution',
                institutionId: institution._id,
                isEmailVerified: true,
                walletBalance: 150,
                totalCreditsEarned: 300,
                totalCO2Saved: 750,
                sustainabilityScore: 85
            }
        ]);
        console.log('✅ Test users created');

        // Create sample actions
        const actions = await Action.create([
            {
                userId: users[0]._id,
                institutionId: institution._id,
                actionType: 'electricity',
                proofUrls: ['https://example.com/bill1.jpg'],
                status: 'approved',
                extractedData: {
                    billNumber: 'EB123456',
                    consumerNumber: 'CONS001',
                    previousReading: 450,
                    currentReading: 380,
                    unitsConsumed: 70,
                    billDate: new Date('2024-02-15')
                },
                impact: {
                    co2SavedKg: 57.4,
                    energySavedKwh: 70,
                    creditsEarned: 5
                }
            },
            {
                userId: users[0]._id,
                institutionId: institution._id,
                actionType: 'transport',
                proofUrls: ['https://example.com/metro1.jpg'],
                status: 'approved',
                extractedData: {
                    fromLocation: 'Station A',
                    toLocation: 'Station B',
                    distance: 15,
                    mode: 'metro',
                    ticketNumber: 'M123456'
                },
                impact: {
                    co2SavedKg: 2.25,
                    creditsEarned: 0
                }
            }
        ]);
        console.log('✅ Sample actions created');

        // Create credit transactions
        await CreditTransaction.create([
            {
                toUser: users[0]._id,
                amount: 5,
                type: 'earned',
                actionId: actions[0]._id,
                description: 'Credits earned for electricity saving',
                balanceAfter: {
                    toUser: 250
                }
            },
            {
                fromUser: users[0]._id,
                toUser: users[1]._id,
                amount: 10,
                type: 'transferred',
                description: 'Transfer for coffee',
                balanceBefore: {
                    fromUser: 250,
                    toUser: 150
                },
                balanceAfter: {
                    fromUser: 240,
                    toUser: 160
                }
            }
        ]);
        console.log('✅ Credit transactions created');

        // Create marketplace listings
        await MarketplaceListing.create({
            sellerId: users[0]._id,
            sellerName: users[0].name,
            creditAmount: 50,
            availableAmount: 50,
            pricePerCredit: 2,
            totalPrice: 100,
            title: '50 Green Credits for Sale',
            description: 'Earned through electricity savings',
            status: 'active',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
        console.log('✅ Marketplace listings created');

        // Create rewards
        await Reward.create([
            {
                name: 'Free Coffee',
                description: 'Get a free coffee at campus café. Present your QR code at the counter.',
                category: 'food',
                imageUrl: 'https://via.placeholder.com/300x200?text=Free+Coffee',
                creditCost: 10,
                partnerId: admin._id,
                partnerName: 'Campus Café',
                stock: 100,
                redemptionType: 'qr',
                validFrom: new Date(),
                validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                redemptionInstructions: 'Show QR code at the counter',
                howToUse: 'Scan the QR code at Campus Café'
            },
            {
                name: 'Movie Ticket',
                description: '1 movie ticket at campus cinema. Book your favorite show.',
                category: 'entertainment',
                imageUrl: 'https://via.placeholder.com/300x200?text=Movie+Ticket',
                creditCost: 50,
                partnerId: admin._id,
                partnerName: 'Campus Cinema',
                stock: 20,
                redemptionType: 'code',
                validFrom: new Date(),
                validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                redemptionInstructions: 'Use the code at the box office',
                howToUse: 'Show the redemption code at Campus Cinema'
            }
        ]);
        console.log('✅ Rewards created');

        // Create competition
        await Competition.create({
            name: 'Greenest Student 2024',
            description: 'Compete to be the most sustainable student',
            institutionId: institution._id,
            type: 'individual',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-12-31'),
            scoringType: 'total_credits',
            prizes: [
                { rank: 1, reward: '₹5000 Scholarship', creditsAmount: 500 },
                { rank: 2, reward: '₹3000 Scholarship', creditsAmount: 300 },
                { rank: 3, reward: '₹1000 Scholarship', creditsAmount: 100 }
            ],
            status: 'active',
            currentParticipants: 2
        });
        console.log('✅ Competition created');

        console.log('🎉 Seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
};

seedData();
