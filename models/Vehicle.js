const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    required: true,
    unique: true
  },
  vehicleNumber: {
    type: String,
    required: true,
    uppercase: true
  },
  entryTime: {
    type: Date,
    default: Date.now
  },
  exitTime: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'transferred'],
    default: 'pending'
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
}, { timestamps: true });

// Static to get balance from previous active/completed sessions for a vehicle
VehicleSchema.statics.getHistoricalBalance = async function (vehicleNumber) {
    const historicalRecords = await this.find({ 
        vehicleNumber: vehicleNumber.toUpperCase(), 
        status: 'completed', 
        paymentStatus: 'pending' 
    });
    
    let totalBalance = 0;
    for (const record of historicalRecords) {
        totalBalance += (record.totalDue || 0);
        // Mark as transferred to the new ticket
        record.paymentStatus = 'transferred';
        await record.save();
    }
    return totalBalance;
};

module.exports = mongoose.model('Vehicle', VehicleSchema);
