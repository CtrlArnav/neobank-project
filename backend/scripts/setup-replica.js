/**
 * MongoDB Replica Set Setup Script
 * 
 * MongoDB transactions require a replica set (not a standalone instance).
 * This script sets up a local replica set with 3 nodes for development.
 * 
 * Prerequisites: MongoDB installed locally
 * 
 * Usage: node scripts/setup-replica.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REPLICA_SET_NAME = 'rs0';

console.log('🔧 Setting up MongoDB replica set for ACID transactions...\n');

// Create data directories for 3 replica set members
const ports = [27017, 27018, 27019];

ports.forEach((port, idx) => {
  const dir = path.join(DATA_DIR, `rs${idx}`);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created data directory: ${dir}`);
  }
});

// Start MongoDB instances
console.log('\n📦 Starting MongoDB instances...');

ports.forEach((port, idx) => {
  const dir = path.join(DATA_DIR, `rs${idx}`);
  const cmd = `mongod --replSet ${REPLICA_SET_NAME} --port ${port} --dbpath ${dir} --oplogSize 128`;
  
  try {
    // Check if already running
    execSync(`lsof -i :${port}`, { stdio: 'ignore' });
    console.log(`⚠️  Port ${port} already in use, skipping...`);
  } catch (e) {
    // Not running, start it
    console.log(`🚀 Starting MongoDB on port ${port}...`);
    execSync(`${cmd} > /dev/null 2>&1 &`, { stdio: 'ignore' });
  }
});

// Wait for MongoDB to start
console.log('\n⏳ Waiting for MongoDB to start...');
execSync('sleep 5');

// Initialize replica set
console.log('\n🔄 Initializing replica set...');

const initCmd = `mongo --port 27017 --eval '
rs.initiate({
  _id: "${REPLICA_SET_NAME}",
  members: [
    { _id: 0, host: "localhost:27017" },
    { _id: 1, host: "localhost:27018" },
    { _id: 2, host: "localhost:27019" }
  ]
})
'`;

try {
  execSync(initCmd, { stdio: 'inherit' });
  console.log('\n✅ Replica set initialized successfully!');
} catch (error) {
  console.log('\n⚠️  Replica set may already be initialized');
}

// Wait for replica set to elect primary
console.log('\n⏳ Waiting for primary election...');
execSync('sleep 10');

console.log('\n✨ MongoDB replica set is ready!');
console.log('\n📍 Connection string: mongodb://localhost:27017,localhost:27018,localhost:27019/neobank?replicaSet=rs0');
console.log('\n🚀 You can now start the NeoBank server: npm start\n');
