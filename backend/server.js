/**
 * TrustVault Backend - Server Entry Point
 * Manages network listener binding and process termination signals.
 */

import { createApp } from './src/app.js';
import { config } from './src/config/env.js';
import { connectDatabase } from './src/config/database.js';

async function startServer() {
  try {
    // Initialize database configuration stub
    await connectDatabase();

    const app = createApp();

    const server = app.listen(config.port, () => {
      console.log(`=========================================`);
      console.log(` TrustVault API Service Running`);
      console.log(` Port:        ${config.port}`);
      console.log(` Environment: ${config.nodeEnv}`);
      console.log(` Health:      http://localhost:${config.port}/api/health`);
      console.log(` Client URL:  ${config.clientUrl}`);
      console.log(`=========================================`);
    });

    // Graceful process termination handlers
    const shutdown = (signal) => {
      console.log(`\n[Process] Received ${signal}. Initiating graceful shutdown...`);
      server.close(() => {
        console.log('[Process] HTTP server closed. Process exiting.');
        process.exit(0);
      });

      // Force shutdown after timeout if pending connections hang
      setTimeout(() => {
        console.error('[Process] Forcing shutdown after timeout.');
        process.exit(1);
      }, 5000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return server;
  } catch (error) {
    console.error('[Startup Error] Failed to initialize TrustVault API:', error);
    process.exit(1);
  }
}

// Start server when executed directly
startServer();
