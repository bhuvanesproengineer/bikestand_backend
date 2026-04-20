const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function testPersistence() {
    const dbPath = path.join(__dirname, 'test-db');
    if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath);

    console.log("Starting Mongo DB with persistence at:", dbPath);
    try {
        const mongod = await MongoMemoryServer.create({
            instance: {
                dbPath: dbPath,
                storageEngine: 'wiredTiger'
            }
        });
        
        const uri = mongod.getUri();
        await mongoose.connect(uri);
        
        // create a schema
        const TestModel = mongoose.model('Test', new mongoose.Schema({ name: String }));
        
        const docs = await TestModel.find({});
        console.log("Found docs:", docs.length);
        
        await TestModel.create({ name: 'Test User ' + Date.now() });
        console.log("Created a test user.");
        
        await mongoose.disconnect();
        await mongod.stop();
        console.log("Stopped. Run again to see if docs > 0");
    } catch (e) {
        console.error(e);
    }
}
testPersistence();
