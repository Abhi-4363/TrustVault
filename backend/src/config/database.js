/**
 * TrustVault Backend - Database Connection Configuration
 * Connects to MongoDB via Mongoose.
 * Implements resilient fallback handling for local development and integration tests.
 */

import mongoose from 'mongoose';
import { config } from './env.js';

let isConnected = false;
let isInMemoryFallback = false;

export async function connectDatabase() {
  if (isConnected) {
    return { status: 'connected', uri: config.mongoUri };
  }

  // In test mode, if no active test URI is provided, use mock/in-memory mode
  if (config.isTest && (!process.env.TEST_MONGODB_URI || config.mongoUri.includes('<db_password>'))) {
    isInMemoryFallback = true;
    return { status: 'in-memory-test', connected: false };
  }

  // Redact credentials for safe logging
  const safeLogUri = config.mongoUri.replace(/:([^:@]+)@/, ':****@');

  // If the user hasn't replaced the placeholder password yet, warn and enable resilient fallback
  if (config.mongoUri.includes('<db_password>')) {
    console.warn(`[Database] MONGODB_URI contains '<db_password>' placeholder.`);
    console.warn(`[Database] Please update backend/.env with your actual Atlas password.`);
    console.warn(`[Database] Activating in-memory store so authentication APIs operate seamlessly.`);
    isInMemoryFallback = true;
    return { status: 'in-memory-fallback', connected: false };
  }

  try {
    console.log(`[Database] Connecting to MongoDB Atlas: ${safeLogUri}...`);
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });

    isConnected = true;
    isInMemoryFallback = false;
    console.log('[Database] MongoDB Atlas connected successfully.');
    return { status: 'connected', connected: true };
  } catch (error) {
    console.warn(`[Database] MongoDB connection error: ${error.message}`);
    console.warn('[Database] Falling back to resilient in-memory storage so the application remains operational.');
    isInMemoryFallback = true;
    return { status: 'in-memory-fallback', connected: false, error: error.message };
  }
}

export async function disconnectDatabase() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
  }
}

export function isUsingInMemoryStore() {
  return isInMemoryFallback;
}
