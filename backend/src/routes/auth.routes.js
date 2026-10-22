/**
 * TrustVault Backend - Authentication Routes
 * Exposes registration, login, and user profile endpoints.
 */

import { Router } from 'express';
import { 
  register, 
  login, 
  getMe, 
  changePassword, 
  resetPassword,
  requestPasswordReset 
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { 
  passwordResetRateLimiter, 
  changePasswordRateLimiter 
} from '../middleware/security.middleware.js';

const router = Router();

// Public Authentication Endpoints
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', passwordResetRateLimiter, requestPasswordReset);
router.post('/reset-password', resetPassword);

// Protected Identity & Security Endpoints
router.get('/me', requireAuth, getMe);
router.post('/change-password', requireAuth, changePasswordRateLimiter, changePassword);

export default router;

