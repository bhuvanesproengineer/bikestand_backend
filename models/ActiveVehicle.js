const mongoose = require('mongoose');

const ActiveVehicleSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    required: true,
    unique: true
  },
  vehicleNumber: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  entryTime: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    default: 'active'
  },
  paymentStatus: {
    type: String,
    default: 'pending'
  },
  historyBalance: {
    type: Number,
    default: 0
  },
  otp: {
    type: String
  }
}, { timestamps: true, collection: 'activevehicles' });

// Pre-save hook for normalization
ActiveVehicleSchema.pre('save', function() {
    if (this.vehicleNumber) {
        this.vehicleNumber = this.vehicleNumber.replace(/\s+/g, '').toUpperCase();
    }
});

module.exports = mongoose.model('ActiveVehicle', ActiveVehicleSchema);
