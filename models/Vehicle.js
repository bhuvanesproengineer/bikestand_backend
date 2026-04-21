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
    uppercase: true,
    index: true
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

// Pre-save hook to remove spaces from vehicleNumber
VehicleSchema.pre('save', function() {
    if (this.vehicleNumber) {
        this.vehicleNumber = this.vehicleNumber.replace(/\s+/g, '').toUpperCase();
    }
});

// Static to get balance from previous active/completed sessions for a vehicle
VehicleSchema.statics.getHistoricalBalance = async function (vehicleNumber) {
    const vNum = vehicleNumber.toUpperCase();
    
    // 1. Calculate sum using aggregation (Instant regardless of record count)
    const result = await this.aggregate([
        { $match: { vehicleNumber: vNum, status: 'completed', paymentStatus: 'pending' } },
        { $group: { _id: null, total: { $sum: "$totalDue" } } }
    ]);
    const totalBalance = result.length > 0 ? result[0].total : 0;

    // 2. Mark as transferred in one go (Bulk Operation)
    if (totalBalance > 0) {
        await this.updateMany(
            { vehicleNumber: vNum, status: 'completed', paymentStatus: 'pending' },
            { $set: { paymentStatus: 'transferred' } }
        );
    }
    
    return totalBalance;
};

module.exports = mongoose.model('Vehicle', VehicleSchema);
