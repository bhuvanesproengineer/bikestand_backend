const mongoose = require('mongoose');
const Vehicle = require('../models/Vehicle');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function verify() {
    console.log('--- STARTING VERIFICATION ---');
    
    // 1. Setup Memory Server
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log('Connected to Memory DB');

    try {
        // 2. Test Normalization in Schema (Pre-save)
        const v1 = new Vehicle({
            ticketId: 'TEST-1',
            vehicleNumber: 'tn 34 ab 1234',
            status: 'active'
        });
        await v1.save();
        console.log('Saved vehicleNumber:', v1.vehicleNumber);
        
        if (v1.vehicleNumber === 'TN34AB1234') {
            console.log('✅ SCHEMA NORMALIZATION SUCCESS: Spaces removed and Uppercased');
        } else {
            console.log('❌ SCHEMA NORMALIZATION FAILED:', v1.vehicleNumber);
        }

        // 3. Test Indexing
        console.log('Waiting for indexes to build...');
        await Vehicle.ensureIndexes(); // Ensure indexes are built
        const indexes = await Vehicle.collection.getIndexes();
        console.log('Current Indexes:', Object.keys(indexes));
        if (indexes.vehicleNumber_1) {
            console.log('✅ INDEX SUCCESS: vehicleNumber index exists');
        } else {
            console.log('❌ INDEX FAILED: vehicleNumber index not found');
        }

    } catch (err) {
        console.error('Verification Error:', err);
    } finally {
        await mongoose.disconnect();
        await mongod.stop();
        console.log('--- VERIFICATION COMPLETE ---');
    }
}

verify();
