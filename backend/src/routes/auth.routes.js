/**
 * TrustVault Backend - Authentication Routes
 * Exposes registration, email verification, login, profile, and dual-option recovery endpoints.
 */

import { Router } from 'express';
import { 
  register, 
  login, 
  getMe, 
  getProfile,
  updateProfile,
  changePassword, 
  resetPassword,
  requestPasswordReset,
  requestEmailPasswordReset,
  verifyEmail,
  resendVerification,
  requestOwnerAccess,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { 
  authRateLimiter,
  passwordResetRateLimiter, 
  changePasswordRateLimiter 
} from '../middleware/security.middleware.js';

const router = Router();

// Public Authentication Endpoints
router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);

// Email Verification Endpoints
router.get('/verify-email', verifyEmail);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', passwordResetRateLimiter, resendVerification);

// Option A: Admin-Assisted Password Reset Request
router.post('/forgot-password', passwordResetRateLimiter, requestPasswordReset);
router.post('/forgot-password/admin', passwordResetRateLimiter, requestPasswordReset);

// Option B: Self-Service Password Reset via Email Link
router.post('/forgot-password-email', passwordResetRateLimiter, requestEmailPasswordReset);
router.post('/request-email-reset', passwordResetRateLimiter, requestEmailPasswordReset);

// Complete Token Password Reset (used for both email reset link and token entry)
router.post('/reset-password', passwordResetRateLimiter, resetPassword);
router.post('/reset-password-email', passwordResetRateLimiter, resetPassword);

// Protected Identity & Security Endpoints
router.get('/me', requireAuth, getMe);
router.get('/profile', requireAuth, getProfile);
router.put('/profile', requireAuth, authRateLimiter, updateProfile);
router.patch('/profile', requireAuth, authRateLimiter, updateProfile);
router.post('/change-password', requireAuth, changePasswordRateLimiter, changePassword);
router.post('/request-owner-access', requireAuth, authRateLimiter, requestOwnerAccess);

export default router;
