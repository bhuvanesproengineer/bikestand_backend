const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    required: true
  },
  vehicleNumber: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['parking', 'monthly_subscription', 'weekly_pass'],
    default: 'parking'
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);
