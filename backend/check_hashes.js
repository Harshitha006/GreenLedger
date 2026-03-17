const mongoose = require('mongoose');
const Action = require('./models/Action');
require('dotenv').config();

const checkHashes = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/greenledger');
        console.log('Connected to DB');

        const actions = await Action.find().sort({ createdAt: -1 }).limit(5);
        if (actions.length === 0) {
            console.log('No actions found in DB');
            process.exit(0);
        }

        console.log(`Found ${actions.length} latest actions. checking metadata...`);
        actions.forEach(a => {
            console.log(`\nID: ${a._id} [Status: ${a.status}] type: ${a.actionType}`);
            a.proofMetadata.forEach((m, idx) => {
                console.log(`  File ${idx + 1}: ${m.filename}`);
                console.log(`    Hash (SHA256): ${m.hash ? m.hash.substring(0, 10) + '...' : 'MISSING'}`);
                console.log(`    PHash: ${m.phash ? m.phash : 'MISSING'}`);
                console.log(`    Duplicate: ${m.isDuplicate ? 'YES (' + m.duplicateType + ')' : 'NO'}`);
            });
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkHashes();
