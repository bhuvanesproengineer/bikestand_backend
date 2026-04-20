const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// POST /api/auth/signup -> Register new user
router.post('/signup', async (req, res) => {
  try {
    console.log(`--- [AUTH] Signup Attempt: ${req.body?.email} ---`);
    console.log('Headers:', req.headers['content-type']);
    
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('Login error: req.body is empty or undefined.');
      return res.status(400).json({ success: false, message: 'Invalid request format' });
    }

    const { email, password } = req.body;

    // Simple validation
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Create new user in Mongo
    const newUser = new User({ email, password });
    await newUser.save();

    // Store in persistent file to survive Memory DB restarts
    try {
      const fs = require('fs');
      const path = require('path');
      const dbPath = path.join(__dirname, '../users_db.json');
      let users = [];
      if (fs.existsSync(dbPath)) {
        users = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      }
      users.push({ email, password }); // Storing raw password for restore (model hashes it on save)
      fs.writeFileSync(dbPath, JSON.stringify(users, null, 2));
    } catch (fsErr) {
      console.error('Failed to save to users_db.json:', fsErr);
    }

    res.status(201).json({ success: true, message: 'User registered successfully. Please login.' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error occurred during signup' });
  }
});

// POST /api/auth/login -> User login with JWT
router.post('/login', async (req, res) => {
  try {
    console.log(`--- [AUTH] Login Attempt: ${req.body?.email} ---`);
    console.log('Headers:', req.headers['content-type']);
    
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('Login error: req.body is empty or undefined.');
      return res.status(400).json({ success: false, message: 'Invalid request format' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );

    res.json({ 
      success: true, 
      token,
      user: { email: user.email } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

module.exports = router;
