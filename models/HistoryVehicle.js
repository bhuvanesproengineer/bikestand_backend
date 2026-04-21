const mongoose = require('mongoose');

const HistoryVehicleSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    required: true,
    index: true
  },
  vehicleNumber: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  entryTime: {
    type: Date,
    required: true
  },
  exitTime: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    default: 'completed'
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'transferred'],
    default: 'paid'
  },
  amount: {
    type: Number,
    default: 0
  },
  totalDue: {
    type: Number,
    default: 0
  },
  historyBalance: {
    type: Number,
    default: 0
  },
  otp: {
    type: String
  }
}, { timestamps: true, collection: 'historyvehicles' });

// Pre-save hook for normalization
HistoryVehicleSchema.pre('save', function() {
    if (this.vehicleNumber) {
        this.vehicleNumber = this.vehicleNumber.replace(/\s+/g, '').toUpperCase();
    }
});

module.exports = mongoose.model('HistoryVehicle', HistoryVehicleSchema);
