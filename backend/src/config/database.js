/**
 * TrustVault Backend - Database Connection Configuration
 * Prepared for Stage 2 (MongoDB integration).
 * Non-blocking in Stage 1 so server and health-check operate independently.
 */

import { config } from './env.js';

export async function connectDatabase() {
  if (config.isTest) {
    // Tests in Stage 1 do not require database connections
    return null;
  }

  // Stage 1 notice: MongoDB driver will be integrated in Stage 2
  // For now, report connection readiness without crashing the server
  if (process.env.DEBUG || config.nodeEnv === 'development') {
    console.log(`[Database] MongoDB configuration prepared for URI: ${config.mongoUri.replace(/:([^:@]+)@/, ':****@')}`);
    console.log('[Database] Active persistence scheduled for Stage 2 (Authentication & User Model).');
  }

  return {
    status: 'prepared',
    connected: false,
    stage: 'stage-1-foundation',
  };
}
