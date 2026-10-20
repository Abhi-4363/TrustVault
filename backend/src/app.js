/**
 * TrustVault Backend - Express Application Factory
 * Configures global middleware, routes, 404 handling, and central error handling.
 * Decoupled from server listening to facilitate automated integration testing.
 */

import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import healthRoutes from './routes/health.routes.js';

export function createApp() {
  const app = express();

  // Cross-Origin Resource Sharing (CORS) configured for frontend client origin
  app.use(
    cors({
      origin: config.clientUrl,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  );

  // Body parsing middleware
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // Mount API route modules
  app.use('/api', healthRoutes);

  // 404 Not Found Handler for unmatched routes
  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist on TrustVault API.`,
      },
    });
  });

  // Central Error Handling Middleware
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // Log error internally in non-production environments
    if (!config.isProduction && !config.isTest) {
      console.error('[Error caught by central handler]:', err);
    }

    const statusCode = err.status || err.statusCode || 500;
    const message =
      config.isProduction && statusCode === 500
        ? 'An unexpected internal server error occurred.'
        : err.message || 'Internal Server Error';

    res.status(statusCode).json({
      error: {
        code: err.code || 'SERVER_ERROR',
        message,
        ...(config.nodeEnv === 'development' ? { stack: err.stack } : {}),
      },
    });
  });

  return app;
}
