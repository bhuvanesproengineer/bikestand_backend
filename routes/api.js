const express = require('express');
const router = express.Router();
const Vehicle = require('../models/Vehicle');
const Settings = require('../models/Settings');
const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');

// Helper to generate Ticket ID
const generateTicketId = () => {
  return 'BK-' + Math.random().toString(36).substring(2, 8).toUpperCase();
};

// --- SUBSCRIPTION STATUS CHECK ---
router.get('/subscriptions/check/:vNum', async (req, res) => {
    try {
        const vNum = req.params.vNum.toUpperCase().slice(-4);
        console.log(`[API] Checking status for vehicle: ${vNum}`);

        const sub = await Subscription.findOne({
            vehicleNumber: vNum,
            status: 'active',
            expiryDate: { $gt: new Date() }
        }).sort({ expiryDate: -1 });

        if (!sub) {
            const expired = await Subscription.findOne({
                vehicleNumber: vNum,
                status: 'expired'
            }).sort({ expiryDate: -1 });
            
            if (expired) {
                return res.json({ status: 'expired', expiryDate: expired.expiryDate });
            }
            return res.json({ status: 'none' });
        }

        res.json({
            status: 'active',
            type: sub.type || 'monthly',
            startDate: sub.startDate,
            expiryDate: sub.expiryDate
        });
    } catch (error) {
        console.error('Check error:', error);
        res.status(500).json({ message: 'Check error' });
    }
});

router.get('/subscriptions', async (req, res) => {
  try {
    const rawSubs = await Subscription.find().sort({ createdAt: -1 });
    const now = new Date();
    
    // Auto-Expire Logic natively hooked into the GET request
    const subs = await Promise.all(rawSubs.map(async (sub) => {
      if (sub.status === 'active' && new Date(sub.expiryDate) < now) {
        sub.status = 'expired';
        await sub.save();
      }
      return sub;
    }));

    res.json(subs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching subscriptions' });
  }
});

router.delete('/subscriptions/:id', async (req, res) => {
  try {
    const doc = await Subscription.findOneAndDelete({ subscriptionId: req.params.id });
    if (!doc) return res.status(404).json({ message: 'Subscription not found' });
    res.json({ success: true, message: 'Subscription securely deleted from database' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting subscription' });
  }
});

// POST /api/register -> Add new vehicle
router.post('/register', async (req, res) => {
  try {
    const { vehicleNumber } = req.body || {};
    if (!vehicleNumber) return res.status(400).json({ message: 'Vehicle number is required' });

    const vNum = vehicleNumber.toUpperCase();

    // Check if vehicle is already parked
    const existing = await Vehicle.findOne({ vehicleNumber: vNum, status: 'active' });
    if (existing) {
      return res.status(400).json({ message: 'Vehicle is already inside' });
    }

    // Check if vehicle has an active subscription
    const vNumLast4 = vNum.slice(-4);
    const activeSub = await Subscription.findOne({
        vehicleNumber: vNumLast4,
        expiryDate: { $gt: new Date() }
    });
    
    if (activeSub) {
      return res.status(400).json({ 
        message: `Vehicle already has an Active ${activeSub.type === 'weekly' ? 'Weekly' : 'Monthly'} Pass` 
      });
    }

    // Fetch historical balance
    const historyBalance = await Vehicle.getHistoricalBalance(vNum);

    const ticketId = generateTicketId();
    const otp = Math.floor(1000 + Math.random() * 9000).toString(); 

    const newVehicle = new Vehicle({
      ticketId,
      vehicleNumber: vNum,
      entryTime: new Date(),
      status: 'active',
      paymentStatus: 'pending',
      historyBalance: historyBalance,
      otp: otp
    });

    await newVehicle.save();
    res.status(201).json({ 
      success: true,
      message: 'Vehicle registered successfully', 
      ticketId,
      otp,
      entryTime: newVehicle.entryTime,
      historyBalance: historyBalance,
      vehicleNumber: vNum
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// POST /api/exit -> Calculate billing
router.post('/exit', async (req, res) => {
  try {
    const { vehicleNumber } = req.body || {};
    if (!vehicleNumber) return res.status(400).json({ message: 'Vehicle Number is required' });

    const vNum = vehicleNumber.toUpperCase();
    const vehicle = await Vehicle.findOne({
      vehicleNumber: vNum,
      status: 'active'
    });

    if (!vehicle) return res.status(404).json({ message: 'Active vehicle session not found' });

    // --- Subscription Check for Exit ---
    const vNumLast4 = vNum.slice(-4);
    const now = new Date();
    
    // Find most recent subscription
    const subscription = await Subscription.findOne({
        vehicleNumber: vNumLast4
    }).sort({ expiryDate: -1 });

    let subStatus = 'none';
    let isActive = false;
    if (subscription) {
        isActive = subscription.expiryDate > now;
        subStatus = isActive ? 'active' : 'expired';
    }

    const currentExitTime = new Date();
    const durationMs = currentExitTime - vehicle.entryTime;
    const durationHours = Math.floor(durationMs / (1000 * 60 * 60));

    const fullDays = Math.floor(durationHours / 24);
    const remainingHours = durationHours % 24;
    
    // If active subscription exists, parking fee is 0
    let amount = (fullDays * 20) + (remainingHours > 0 || durationHours === 0 ? 10 : 0);
    if (isActive) {
        amount = 0;
    }

    const totalDue = amount + (vehicle.historyBalance || 0);

    // Update vehicle with calculations
    vehicle.amount = amount;
    vehicle.totalDue = totalDue;
    vehicle.exitTime = currentExitTime;
    await vehicle.save();

    res.json({
      success: true,
      details: {
        vehicleNumber: vehicle.vehicleNumber,
        ticketId: vehicle.ticketId,
        entryTime: vehicle.entryTime,
        exitTime: currentExitTime,
        duration: { days: fullDays, hours: remainingHours },
        amount: amount,
        historyBalance: vehicle.historyBalance,
        totalDue,
        otp: vehicle.otp,
        subscription: subscription ? {
            type: subscription.type || 'monthly',
            startDate: subscription.startDate,
            expiryDate: subscription.expiryDate,
            status: subStatus,
            isActive: isActive 
        } : null
      }
    });
  } catch (error) {
    console.error('Exit error:', error);
    res.status(500).json({ message: 'Server error during exit calculation' });
  }
});

// POST /api/pay -> Process payment
router.post('/pay', async (req, res) => {
  try {
    const { ticketId, amount } = req.body || {};
    if (!ticketId) return res.status(400).json({ message: 'Ticket ID is required' });

    const vehicle = await Vehicle.findOne({ ticketId });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle record not found' });

    const finalAmount = Number(amount) || vehicle.totalDue || 0;

    const payment = new Payment({
      ticketId: vehicle.ticketId,
      vehicleNumber: vehicle.vehicleNumber,
      amount: finalAmount,
      type: 'parking'
    });
    await payment.save();

    vehicle.status = 'completed';
    vehicle.paymentStatus = 'paid';
    await vehicle.save();

    res.json({ success: true, message: 'Payment processed successfully', amount: finalAmount });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ message: 'Server error during payment' });
  }
});

// GET /api/stats -> Dashboard Statistics
router.get('/stats', async (req, res) => {
  try {
    const settings = await Settings.get();
    
    // 0 epoch fallback if no manual reset was ever done
    const todayStartTime = settings.revenueTodayResetTimestamp || new Date(0);
    const weeklyStartTime = settings.revenueWeeklyResetTimestamp || new Date(0);
    const monthlyStartTime = settings.revenueMonthlyResetTimestamp || new Date(0);

    const activeVehicles = await Vehicle.countDocuments({ status: 'active' });
    const todayEntries = await Vehicle.countDocuments({ entryTime: { $gte: todayStartTime } });
    
    // optimize by fetching from the earliest of the 3 reset times, but for safety in memory fetch all then filter
    const payments = await Payment.find();
    
    const todayRevenue = payments
      .filter(p => p.date >= todayStartTime)
      .reduce((sum, p) => sum + p.amount, 0);
      
    const weeklyRevenue = payments
      .filter(p => p.date >= weeklyStartTime)
      .reduce((sum, p) => sum + p.amount, 0);
      
    const monthlyRevenue = payments
      .filter(p => p.date >= monthlyStartTime)
      .reduce((sum, p) => sum + p.amount, 0);

    res.json({
      activeVehicles,
      todayEntries,
      todayRevenue,
      weeklyRevenue,
      monthlyRevenue
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: 'Error fetching statistics' });
  }
});

// POST /api/settings/reset-today -> Manually target settings schema
router.post('/settings/reset-today', async (req, res) => {
  try {
    await Settings.resetTodayRevenue();
    res.json({ success: true, message: 'Today revenue reset successfully' });
  } catch (error) {
    console.error('Reset revenue error:', error);
    res.status(500).json({ message: 'Failed to reset revenue' });
  }
});

// POST /api/settings/reset-weekly
router.post('/settings/reset-weekly', async (req, res) => {
  try {
    await Settings.resetWeeklyRevenue();
    res.json({ success: true, message: 'Weekly revenue reset successfully' });
  } catch (error) {
    console.error('Reset revenue error:', error);
    res.status(500).json({ message: 'Failed to reset weekly revenue' });
  }
});

// POST /api/settings/reset-monthly
router.post('/settings/reset-monthly', async (req, res) => {
  try {
    await Settings.resetMonthlyRevenue();
    res.json({ success: true, message: 'Monthly revenue reset successfully' });
  } catch (error) {
    console.error('Reset revenue error:', error);
    res.status(500).json({ message: 'Failed to reset monthly revenue' });
  }
});

// Subscription Routes
router.post('/subscriptions/register', async (req, res) => {
  try {
    const { vehicleNumber, ownerName, type } = req.body;
    if (!vehicleNumber) return res.status(400).json({ message: 'Vehicle number required' });

    // Explicitly check for weekly, otherwise default to monthly
    const passType = String(type).toLowerCase() === 'weekly' ? 'weekly' : 'monthly';
    const amount = passType === 'weekly' ? 130 : 500;
    const durationDays = passType === 'weekly' ? 7 : 30;

    console.log(`[Subscription] Registering ${passType} pass for ${vehicleNumber}`);

    const vNum = vehicleNumber.toUpperCase().slice(-4);
    const existing = await Subscription.findOne({ 
        vehicleNumber: vNum, 
        status: 'active', 
        expiryDate: { $gt: new Date() } 
    });
    
    if (existing) return res.status(400).json({ message: 'Active pass already exists for this vehicle' });

    const subId = 'SUB-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // INCLUSIVE DATE LOGIC:
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0); // Start of day

    const expiryDate = new Date();
    // For 7 days: Start Date + 6 Days = Total 7 days inclusive
    expiryDate.setDate(expiryDate.getDate() + (durationDays - 1));
    expiryDate.setHours(23, 59, 59, 999); // End of day

    const sub = new Subscription({ 
        subscriptionId: subId, 
        vehicleNumber: vNum, 
        ownerName,
        type: passType,
        amount: amount,
        startDate: startDate,
        expiryDate: expiryDate
    });
    await sub.save();

    const payment = new Payment({ 
        ticketId: subId, 
        vehicleNumber: vNum, 
        amount: amount, 
        type: passType === 'weekly' ? 'weekly_pass' : 'monthly_subscription' 
    });
    await payment.save();

    res.status(201).json({ success: true, message: 'Pass registered successfully', subscription: sub });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ message: 'Subscription error' });
  }
});

module.exports = router;
