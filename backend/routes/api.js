/**
 * API Routes
 * 
 * Endpoints:
 * - POST /api/accounts - Create a new account
 * - GET /api/accounts/:accountNumber - Get account details
 * - POST /api/transfer - Transfer money (with idempotency)
 * - GET /api/accounts/:accountNumber/transactions - Get transaction history
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const Account = require('../models/Account');
const LedgerEntry = require('../models/LedgerEntry');
const { transfer } = require('../services/transferService');
const idempotencyMiddleware = require('../middleware/idempotency');

// Rate limiting: max 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' }
});

router.use(apiLimiter);

/**
 * POST /api/accounts
 * Create a new account
 */
router.post('/accounts', async (req, res) => {
  try {
    const { name, email, initialBalance = 0 } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    // Generate unique account number
    const accountNumber = 'ACC' + Date.now().toString().slice(-10);
    
    const account = new Account({
      accountNumber,
      name,
      email,
      balance: initialBalance * 100, // Convert to paise
      dailyLimit: 50000, // ₹500
      perTransactionLimit: 25000 // ₹250
    });
    
    await account.save();
    
    res.status(201).json({
      success: true,
      account: {
        accountNumber: account.accountNumber,
        name: account.name,
        email: account.email,
        balance: account.balance, // Return in paise, frontend will convert
        dailyLimit: account.dailyLimit,
        perTransactionLimit: account.perTransactionLimit,
        dailySpent: account.dailySpent
      }
    });
    
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Create account error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

/**
 * GET /api/accounts/:accountNumber
 * Get account details
 */
router.get('/accounts/:accountNumber', async (req, res) => {
  try {
    const account = await Account.findOne({ accountNumber: req.params.accountNumber });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json({
      accountNumber: account.accountNumber,
      name: account.name,
      email: account.email,
      balance: account.balance, // Return in paise
      dailyLimit: account.dailyLimit,
      perTransactionLimit: account.perTransactionLimit,
      dailySpent: account.dailySpent
    });
    
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

/**
 * POST /api/transfer
 * Transfer money between accounts
 * 
 * Requires idempotency-key header to prevent duplicate transactions
 */
router.post('/transfer', idempotencyMiddleware, async (req, res) => {
  try {
    const { fromAccountNumber, toAccountNumber, amount, description } = req.body;
    
    if (!fromAccountNumber || !toAccountNumber || !amount) {
      return res.status(400).json({ 
        error: 'fromAccountNumber, toAccountNumber, and amount are required' 
      });
    }
    
    // Generate idempotency key if not provided
    const idempotencyKey = req.idempotencyKey || uuidv4();
    
    const result = await transfer({
      fromAccountNumber,
      toAccountNumber,
      amount: Math.round(amount * 100), // Convert rupees to paise
      description,
      idempotencyKey,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    res.json({
      ...result,
      amount: result.amount // Return in paise
    });
    
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/accounts/:accountNumber/transactions
 * Get transaction history for an account
 */
router.get('/accounts/:accountNumber/transactions', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const transactions = await LedgerEntry.find({
      accountNumber: req.params.accountNumber,
      status: 'COMPLETED'
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(offset))
    .select('-_id -__v');
    
    const total = await LedgerEntry.countDocuments({
      accountNumber: req.params.accountNumber,
      status: 'COMPLETED'
    });
    
    res.json({
      transactions: transactions.map(tx => ({
        ...tx.toObject(),
        amount: tx.amount, // Return in paise
        balanceAfter: tx.balanceAfter // Return in paise
      })),
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

module.exports = router;
