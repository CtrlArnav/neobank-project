/**
 * Ledger Entry Model (Double-Entry Bookkeeping)
 * 
 * Every transfer creates TWO ledger entries:
 * 1. DEBIT entry (money leaving source account)
 * 2. CREDIT entry (money entering destination account)
 * 
 * This ensures the accounting equation always balances:
 * Total Debits = Total Credits
 * 
 * Ledger entries are IMMUTABLE - never edited, only appended.
 * This creates a complete audit trail of every transaction.
 */

const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema({
  // Unique transaction ID (links the debit and credit pair)
  transactionId: {
    type: String,
    required: true,
    index: true
  },
  
  // Idempotency key (prevents duplicate transactions)
  idempotencyKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Which account this entry affects
  accountNumber: {
    type: String,
    required: true,
    index: true
  },
  
  // DEBIT or CREDIT
  type: {
    type: String,
    enum: ['DEBIT', 'CREDIT'],
    required: true
  },
  
  // Amount (always positive, the type determines direction)
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Balance after this transaction
  balanceAfter: {
    type: Number,
    required: true
  },
  
  // Description/narration
  description: {
    type: String,
    required: true,
    trim: true
  },
  
  // Counterparty account (who sent/received)
  counterpartyAccount: {
    type: String,
    required: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['COMPLETED', 'FAILED'],
    default: 'COMPLETED'
  },
  
  // Metadata
  metadata: {
    ipAddress: String,
    userAgent: String
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
ledgerEntrySchema.index({ accountNumber: 1, createdAt: -1 });

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);
