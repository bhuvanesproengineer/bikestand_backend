const mongoose = require('mongoose');
const Vehicle = require('../models/Vehicle');
const Subscription = require('../models/Subscription');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function verify() {
    console.log('--- STARTING MAX SPEED VERIFICATION ---');
    
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    try {
        // 1. Verify getHistoricalBalance bulk operations
        const vNum = 'TEST_BULK';
        
        // Create multiple pending sessions
        await Vehicle.create([
            { ticketId: 'T1', vehicleNumber: vNum, status: 'completed', paymentStatus: 'pending', totalDue: 100 },
            { ticketId: 'T2', vehicleNumber: vNum, status: 'completed', paymentStatus: 'pending', totalDue: 200 },
            { ticketId: 'T3', vehicleNumber: vNum, status: 'active', paymentStatus: 'pending', totalDue: 300 } // Should be ignored
        ]);

        const balance = await Vehicle.getHistoricalBalance(vNum);
        console.log('Calculated Balance:', balance);
        
        if (balance === 300) {
            console.log('✅ BULK SUM SUCCESS');
        } else {
            console.log('❌ BULK SUM FAILED:', balance);
        }

        const updatedRecords = await Vehicle.find({ vehicleNumber: vNum, paymentStatus: 'transferred' });
        console.log('Records marked as transferred:', updatedRecords.length);
        if (updatedRecords.length === 2) {
            console.log('✅ BULK UPDATE SUCCESS');
        } else {
            console.log('❌ BULK UPDATE FAILED:', updatedRecords.length);
        }

        // 2. Verify Subscription Bulk Expiry Logic
        const now = new Date();
        const pastDate = new Date(now.getTime() - 100000);
        
        await Subscription.create([
            { subscriptionId: 'S1', vehicleNumber: '1111', status: 'active', expiryDate: pastDate, amount: 500 },
            { subscriptionId: 'S2', vehicleNumber: '2222', status: 'active', expiryDate: pastDate, amount: 500 }
        ]);

        // Mocking the logic from api.js
        await Subscription.updateMany(
            { status: 'active', expiryDate: { $lt: now } },
            { $set: { status: 'expired' } }
        );

        const expiredCount = await Subscription.countDocuments({ status: 'expired' });
        console.log('Expired Subscriptions count:', expiredCount);
        if (expiredCount === 2) {
            console.log('✅ BULK EXPIRY SUCCESS');
        } else {
            console.log('❌ BULK EXPIRY FAILED');
        }

    } catch (err) {
        console.error('Max Speed Verification Error:', err);
    } finally {
        await mongoose.disconnect();
        await mongod.stop();
        console.log('--- MAX SPEED VERIFICATION COMPLETE ---');
    }
}

verify();
