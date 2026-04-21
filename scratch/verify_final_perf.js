const mongoose = require('mongoose');
const Vehicle = require('../models/Vehicle');
const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function verify() {
    console.log('--- STARTING FINAL VERIFICATION ---');
    
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    try {
        // 1. Wait for all models to build indexes
        await Promise.all([
            Vehicle.ensureIndexes(),
            Subscription.ensureIndexes(),
            Payment.ensureIndexes()
        ]);

        // 2. Check Database Indexes
        const vIndexes = await Vehicle.collection.getIndexes();
        const sIndexes = await Subscription.collection.getIndexes();
        const pIndexes = await Payment.collection.getIndexes();

        console.log('Vehicle Indexes:', Object.keys(vIndexes));
        console.log('Subscription Indexes:', Object.keys(sIndexes));
        console.log('Payment Indexes:', Object.keys(pIndexes));

        const success = vIndexes.vehicleNumber_1 && sIndexes.vehicleNumber_1 && pIndexes.date_1;
        if (success) {
            console.log('✅ INDEX VERIFICATION SUCCESS');
        } else {
            console.log('❌ INDEX VERIFICATION FAILED');
        }

        // 3. Test Subscription Normalization
        const sub = new Subscription({
            subscriptionId: 'SUB-TEST',
            vehicleNumber: 'tn 34 ab 1234',
            expiryDate: new Date(),
            amount: 500
        });
        await sub.save();
        console.log('Saved Subscription vehicleNumber:', sub.vehicleNumber);
        if (sub.vehicleNumber === 'TN34AB1234') {
            console.log('✅ SUBSCRIPTION NORMALIZATION SUCCESS');
        } else {
            console.log('❌ SUBSCRIPTION NORMALIZATION FAILED');
        }

    } catch (err) {
        console.error('Final Verification Error:', err);
    } finally {
        await mongoose.disconnect();
        await mongod.stop();
        console.log('--- FINAL VERIFICATION COMPLETE ---');
    }
}

verify();
