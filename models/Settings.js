const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  revenueTodayResetTimestamp: {
    type: Date,
    default: null
  },
  revenueWeeklyResetTimestamp: {
    type: Date,
    default: null
  },
  revenueMonthlyResetTimestamp: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Ensure only one settings document exists
SettingsSchema.statics.get = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

SettingsSchema.statics.resetTodayRevenue = async function () {
  const settings = await this.get();
  settings.revenueTodayResetTimestamp = new Date();
  await settings.save();
};

SettingsSchema.statics.resetWeeklyRevenue = async function () {
  const settings = await this.get();
  settings.revenueWeeklyResetTimestamp = new Date();
  await settings.save();
};

SettingsSchema.statics.resetMonthlyRevenue = async function () {
  const settings = await this.get();
  settings.revenueMonthlyResetTimestamp = new Date();
  await settings.save();
};

module.exports = mongoose.model('Settings', SettingsSchema);
