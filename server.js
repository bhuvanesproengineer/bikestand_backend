const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const User = require('./models/User'); // For seeding
const Vehicle = require('./models/Vehicle');
const Settings = require('./models/Settings');
const Subscription = require('./models/Subscription');
const Payment = require('./models/Payment');
dotenv.config();

// Connect to MongoDB (Real or Memory)
let mongod = null;

const fs = require('fs');
const path = require('path');

const seedAdmin = async () => {
  try {
    const dbPath = path.join(__dirname, 'users_db.json');
    let usersToSeed = [
      { email: 'admin@bikepark.com', password: 'adminpassword123' } // Default Admin
    ];

    // Load persistent users if file exists
    if (fs.existsSync(dbPath)) {
        const fileData = fs.readFileSync(dbPath, 'utf8');
        try {
            const parsed = JSON.parse(fileData);
            if (Array.isArray(parsed)) {
                usersToSeed = parsed;
            }
        } catch (e) {
            console.error('Error parsing users_db.json. Proceeding with default admin only.');
        }
    } else {
        // Create file with default admin
        fs.writeFileSync(dbPath, JSON.stringify(usersToSeed, null, 2));
    }

    // Seed into MongoDB
    for (const u of usersToSeed) {
        const existingUser = await User.findOne({ email: u.email });
        if (!existingUser) {
            // We use the model hooks to hash passwords, but wait, if it's already hashed in DB?
            // Actually, we should just let the User model hash the raw password we stored.
            // If the JSON contains raw passwords, we just create them. If it stores hashed, this is tricky.
            // Wait, the User schema expects raw password and hashes it in pre-save!
            const user = new User({ email: u.email, password: u.password });
            await user.save();
        }
    }
    
    console.log(`--- AUTO-SEED: Restored ${usersToSeed.length} users into Memory Database ---`);

  } catch (err) {
    console.error('Auto-seeding error:', err);
  }
};

const syncDataFile = path.join(__dirname, 'database_dump.json');

const loadMongoData = async () => {
  if (fs.existsSync(syncDataFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(syncDataFile, 'utf8'));
      if (data.vehicles?.length) await Vehicle.insertMany(data.vehicles);
      if (data.settings?.length) await Settings.insertMany(data.settings);
      if (data.subscriptions?.length) await Subscription.insertMany(data.subscriptions);
      if (data.payments?.length) await Payment.insertMany(data.payments);
      console.log('--- RESTORED PREVIOUS DATABASE DATA SUCCESSFULLY ---');
    } catch (e) {
      console.error('Error loading backup data:', e);
    }
  }
};

const saveMongoData = async () => {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const vehicles = await Vehicle.find({});
    const settings = await Settings.find({});
    const subscriptions = await Subscription.find({});
    const payments = await Payment.find({});
    
    fs.writeFileSync(syncDataFile, JSON.stringify({
      vehicles, settings, subscriptions, payments
    }, null, 2));
  } catch (e) {
    console.error('Error saving backup data:', e);
  }
};

const connectDB = async () => {
  try {
    let uri = process.env.MONGODB_URI;
    let isMemory = false;
    
    // Check if we should use memory server
    if (!uri || uri.includes('localhost')) {
      isMemory = true;
      console.log('Using MongoMemoryServer with JSON Auto-Backup Persistence...');
      mongod = await MongoMemoryServer.create();
      uri = mongod.getUri();
    }
    
    await mongoose.connect(uri);
    console.log('Connected to MongoDB Successfully');
    
    if (isMemory) await loadMongoData();
    
    // Auto-seed admin user
    await seedAdmin();

    if (isMemory) {
        setInterval(saveMongoData, 5000); // Save every 5 seconds securely
    }
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  await saveMongoData();
  if (mongod) await mongod.stop();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await saveMongoData();
  if (mongod) await mongod.stop();
  process.exit(0);
});

connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} using local JSON database for persistence`);
});
