const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Users/Harshitha/GreenLedger/backend/.env' });

async function checkDb() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        const actions = await mongoose.connection.db.collection('actions').find().sort({ _id: -1 }).limit(3).toArray();
        console.log('--- Top 3 Latest Actions ---');
        actions.forEach(a => {
            console.log(`ID: ${a._id}, Status: ${a.status}, CreatedAt: ${a.createdAt || 'N/A'}, ActionType: ${a.actionType}`);
            console.log(`ProofMetadata: ${JSON.stringify(a.proofMetadata, null, 2)}`);
            console.log('---');
        });
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDb();
