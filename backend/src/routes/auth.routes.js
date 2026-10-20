/**
 * TrustVault Backend - Authentication Routes
 * Exposes registration, login, and user profile endpoints.
 */

import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Public Authentication Endpoints
router.post('/register', register);
router.post('/login', login);

// Protected Identity Endpoint
router.get('/me', requireAuth, getMe);

export default router;
