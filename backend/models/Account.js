/**
 * Account Model
 * 
 * Stores user account information and balance.
 * Uses optimistic locking with a version field to handle concurrent updates.
 */

const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  // Basic account info
  accountNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  
  // Balance (stored in smallest currency unit, e.g., paise for INR)
  balance: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  
  // Optimistic locking version field
  // This prevents race conditions when two transactions try to update the same account
  version: {
    type: Number,
    default: 0
  },
  
  // Transfer limits
  dailyLimit: {
    type: Number,
    default: 50000 // ₹500 per day (in paise: 50000)
  },
  perTransactionLimit: {
    type: Number,
    default: 25000 // ₹250 per transaction (in paise: 25000)
  },
  
  // Track daily usage for rate limiting
  dailySpent: {
    type: Number,
    default: 0
  },
  lastResetDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Reset daily spent if it's a new day
accountSchema.pre('save', function(next) {
  const now = new Date();
  const lastReset = new Date(this.lastResetDate);
  
  if (now.toDateString() !== lastReset.toDateString()) {
    this.dailySpent = 0;
    this.lastResetDate = now;
  }
  
  next();
});

module.exports = mongoose.model('Account', accountSchema);
