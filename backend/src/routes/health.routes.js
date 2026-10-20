/**
 * TrustVault Backend - Health Check Routes
 * Provides operational liveness and readiness information.
 * Security Note: Strictly suppresses environment variables, credentials, internal file paths, and package versions.
 */

import { Router } from 'express';
import { config } from '../config/env.js';

const router = Router();
const serverStartTime = Date.now();

router.get('/health', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);

  res.status(200).json({
    status: 'ok',
    service: 'TrustVault API',
    timestamp: new Date().toISOString(),
    uptime: uptimeSeconds,
    environment: config.nodeEnv,
  });
});

export default router;
