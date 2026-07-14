/**
 * Idempotency Middleware
 * 
 * Prevents duplicate transactions by checking if an idempotency key
 * has already been processed.
 * 
 * How it works:
 * 1. Client sends a unique UUID with each transfer request
 * 2. Server checks if this UUID was already used
 * 3. If yes → return the cached response
 * 4. If no → process the transaction and cache the result
 * 
 * This protects against:
 * - User double-clicking the "Send" button
 * - Network retries
 * - Browser auto-retry on timeout
 */

const LedgerEntry = require('../models/LedgerEntry');

const idempotencyMiddleware = async (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'];
  
  // If no idempotency key provided, skip this middleware
  if (!idempotencyKey) {
    return next();
  }
  
  try {
    // Check if this idempotency key was already used
    const existingEntry = await LedgerEntry.findOne({ idempotencyKey });
    
    if (existingEntry) {
      // This transaction was already processed!
      // Return success response (don't process again)
      console.log(`⚠️  Duplicate request detected: ${idempotencyKey}`);
      
      return res.status(200).json({
        success: true,
        message: 'Transaction already processed (idempotent)',
        duplicate: true,
        transactionId: existingEntry.transactionId
      });
    }
    
    // Attach the key to the request for later use
    req.idempotencyKey = idempotencyKey;
    next();
    
  } catch (error) {
    console.error('Idempotency check failed:', error);
    next(); // Continue even if check fails
  }
};

module.exports = idempotencyMiddleware;
