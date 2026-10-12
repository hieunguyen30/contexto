const mongoose = require('mongoose');
const dns = require('dns');
const logger = require('./utils/logger');

// mongodb+srv:// needs SRV lookups, which some local resolvers (VPN/Tailscale/WSL stubs) refuse.
// DNS_SERVERS=8.8.8.8,1.1.1.1 makes Node use those instead of the system resolver.
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean));
}

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected');
  });
  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB error', { err });
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  return mongoose.connection;
}

module.exports = { connectDB, mongoose };
