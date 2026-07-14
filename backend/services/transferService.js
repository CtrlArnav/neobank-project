/**
 * Transfer Service
 * 
 * Core business logic for transferring money between accounts.
 * Implements all 4 key features:
 * 
 * 1. Double-Entry Bookkeeping: Every transfer creates 2 ledger entries (debit + credit)
 * 2. ACID Transactions: Uses MongoDB transactions for atomicity
 * 3. Optimistic Locking: Version field prevents race conditions
 * 4. Fraud Risk Scoring: Analyzes 5 signals before processing
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Account = require('../models/Account');
const LedgerEntry = require('../models/LedgerEntry');

/**
 * Calculate fraud risk score (0-100)
 * 
 * Signals:
 * 1. Unusual amount (>3x user's average transfer)
 * 2. Unusual time (2-5 AM when user never transacts)
 * 3. High velocity (>3 transfers in 10 minutes)
 * 4. New recipient (first time sending to this account)
 * 5. Large round number (10000, 50000, etc.)
 */
async function calculateRiskScore(fromAccount, toAccountNumber, amount) {
  let score = 0;
  const signals = [];
  
  // Signal 1: Unusual amount
  const recentTransactions = await LedgerEntry.find({
    accountNumber: fromAccount.accountNumber,
    type: 'DEBIT',
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
  }).limit(50);
  
  if (recentTransactions.length > 0) {
    const avgAmount = recentTransactions.reduce((sum, tx) => sum + tx.amount, 0) / recentTransactions.length;
    if (amount > avgAmount * 3) {
      score += 30;
      signals.push('UNUSUAL_AMOUNT');
    }
  }
  
  // Signal 2: Unusual time (2-5 AM)
  const hour = new Date().getHours();
  if (hour >= 2 && hour <= 5) {
    score += 20;
    signals.push('UNUSUAL_TIME');
  }
  
  // Signal 3: High velocity (>3 transfers in 10 minutes)
  const recentTransfers = await LedgerEntry.find({
    accountNumber: fromAccount.accountNumber,
    type: 'DEBIT',
    createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } // Last 10 minutes
  });
  
  if (recentTransfers.length >= 3) {
    score += 25;
    signals.push('HIGH_VELOCITY');
  }
  
  // Signal 4: New recipient
  const previousTransfers = await LedgerEntry.findOne({
    accountNumber: fromAccount.accountNumber,
    type: 'DEBIT',
    counterpartyAccount: toAccountNumber
  });
  
  if (!previousTransfers) {
    score += 15;
    signals.push('NEW_RECIPIENT');
  }
  
  // Signal 5: Large round number
  if (amount % 10000 === 0 && amount >= 10000) {
    score += 10;
    signals.push('ROUND_NUMBER');
  }
  
  return { score, signals };
}

/**
 * Transfer money between accounts
 * 
 * This is the main function that implements all safety features:
 * - ACID transactions (all-or-nothing)
 * - Double-entry bookkeeping (debit + credit)
 * - Optimistic locking (version check)
 * - Balance validation
 * - Limit enforcement
 */
async function transfer({ fromAccountNumber, toAccountNumber, amount, description, idempotencyKey, metadata }) {
  // Start a MongoDB session for ACID transactions
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // 1. Validate accounts exist
    const fromAccount = await Account.findOne({ accountNumber: fromAccountNumber }).session(session);
    const toAccount = await Account.findOne({ accountNumber: toAccountNumber }).session(session);
    
    if (!fromAccount) {
      throw new Error('Source account not found');
    }
    if (!toAccount) {
      throw new Error('Destination account not found');
    }
    if (fromAccountNumber === toAccountNumber) {
      throw new Error('Cannot transfer to the same account');
    }
    
    // 2. Calculate fraud risk score
    const { score: riskScore, signals: riskSignals } = await calculateRiskScore(fromAccount, toAccountNumber, amount);
    
    // Block if risk score > 60
    if (riskScore > 60) {
      throw new Error(`Transaction blocked: High risk score (${riskScore}). Signals: ${riskSignals.join(', ')}`);
    }
    
    // 3. Validate amount
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    if (amount > fromAccount.perTransactionLimit) {
      throw new Error(`Amount exceeds per-transaction limit of ₹${fromAccount.perTransactionLimit / 100}`);
    }
    
    // 4. Check daily limit
    if (fromAccount.dailySpent + amount > fromAccount.dailyLimit) {
      throw new Error(`Daily limit exceeded. Remaining: ₹${(fromAccount.dailyLimit - fromAccount.dailySpent) / 100}`);
    }
    
    // 5. Check sufficient balance
    if (fromAccount.balance < amount) {
      throw new Error(`Insufficient balance. Available: ₹${fromAccount.balance / 100}`);
    }
    
    // 6. OPTIMISTIC LOCKING: Update accounts with version check
    // This prevents race conditions when two transactions try to update the same account
    
    const fromResult = await Account.findOneAndUpdate(
      { 
        accountNumber: fromAccountNumber,
        version: fromAccount.version // Only update if version matches
      },
      {
        $inc: { 
          balance: -amount, 
          dailySpent: amount,
          version: 1 // Increment version
        }
      },
      { 
        new: true, 
        session,
        runValidators: true
      }
    );
    
    if (!fromResult) {
      throw new Error('Transaction failed: Account was modified by another transaction. Please retry.');
    }
    
    const toResult = await Account.findOneAndUpdate(
      { 
        accountNumber: toAccountNumber,
        version: toAccount.version
      },
      {
        $inc: { 
          balance: amount,
          version: 1
        }
      },
      { 
        new: true, 
        session,
        runValidators: true
      }
    );
    
    if (!toResult) {
      throw new Error('Transaction failed: Destination account was modified. Please retry.');
    }
    
    // 7. DOUBLE-ENTRY BOOKKEEPING: Create ledger entries
    const transactionId = uuidv4();
    
    // DEBIT entry (money leaving source)
    await LedgerEntry.create([{
      transactionId,
      idempotencyKey,
      accountNumber: fromAccountNumber,
      type: 'DEBIT',
      amount,
      balanceAfter: fromResult.balance,
      description: description || `Transfer to ${toAccountNumber}`,
      counterpartyAccount: toAccountNumber,
      status: 'COMPLETED',
      metadata
    }], { session });
    
    // CREDIT entry (money entering destination)
    await LedgerEntry.create([{
      transactionId,
      idempotencyKey: `${idempotencyKey}-credit`, // Unique key for credit entry
      accountNumber: toAccountNumber,
      type: 'CREDIT',
      amount,
      balanceAfter: toResult.balance,
      description: description || `Transfer from ${fromAccountNumber}`,
      counterpartyAccount: fromAccountNumber,
      status: 'COMPLETED',
      metadata
    }], { session });
    
    // 8. Commit the transaction (all-or-nothing)
    await session.commitTransaction();
    
    console.log(`✅ Transfer successful: ₹${amount/100} from ${fromAccountNumber} to ${toAccountNumber}`);
    console.log(`   Risk score: ${riskScore}/100 (${riskSignals.join(', ') || 'no signals'})`);
    
    return {
      success: true,
      transactionId,
      amount,
      fromAccount: {
        accountNumber: fromResult.accountNumber,
        balance: fromResult.balance
      },
      toAccount: {
        accountNumber: toResult.accountNumber,
        balance: toResult.balance
      },
      riskScore,
      riskSignals
    };
    
  } catch (error) {
    // Rollback on any error
    await session.abortTransaction();
    console.error('❌ Transfer failed:', error.message);
    throw error;
  } finally {
    session.endSession();
  }
}

module.exports = { transfer };
