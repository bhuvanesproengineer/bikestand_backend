const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  subscriptionId: {
    type: String,
    required: true,
    unique: true
  },
  vehicleNumber: {
    type: String,
    required: true,
    uppercase: true
  },
  ownerName: {
    type: String,
    default: 'N/A'
  },
  type: {
    type: String,
    enum: ['weekly', 'monthly'],
    default: 'monthly'
  },
  amount: {
    type: Number,
    required: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'expired'],
    default: 'active'
  }
}, { timestamps: true });

// Helper to check if a specific subscription is currently active
SubscriptionSchema.methods.isActive = function() {
    return this.status === 'active' && this.expiryDate > new Date();
};

module.exports = mongoose.model('Subscription', SubscriptionSchema);
