/**
 * NeoBank Server
 * 
 * Concurrent-safe digital banking ledger with:
 * - Double-entry bookkeeping
 * - ACID transactions (MongoDB replica set required)
 * - Idempotency keys
 * - Optimistic locking
 * - Fraud risk scoring
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
  credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// MongoDB connection with retry logic
async function connectWithRetry() {
  const maxRetries = 5;
  const retryDelay = 5000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ MongoDB connected');
      return;
    } catch (error) {
      console.error(`❌ MongoDB connection attempt ${i + 1} failed:`, error.message);
      if (i < maxRetries - 1) {
        console.log(`Retrying in ${retryDelay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  console.error('❌ Failed to connect to MongoDB after maximum retries');
  process.exit(1);
}

// Start server
connectWithRetry().then(() => {
  app.listen(PORT, () => {
    console.log(`🏦 NeoBank server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 API base: http://localhost:${PORT}/api`);
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});
