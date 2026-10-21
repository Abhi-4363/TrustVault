/**
 * TrustVault Backend - Administrator Routes (Stage 8)
 * All routes are protected by requireAuth + requireRole('admin').
 * Non-admin users receive 403 Forbidden.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/auth.middleware.js';
import {
  getAnalytics,
  getGlobalAuditLogs,
  exportAuditLogs,
  listAllUsers,
  getUserDetail,
  deactivateUser,
  reactivateUser,
} from '../controllers/admin.controller.js';

const router = Router();

// All admin routes require authentication + admin role
router.use(requireAuth);
router.use(requireRole('admin'));

// System analytics dashboard
router.get('/analytics', getAnalytics);

// Global audit log viewer (paginated)
router.get('/audit-logs', getGlobalAuditLogs);

// Audit log export (CSV/JSON, no truncation)
router.get('/audit-logs/export', exportAuditLogs);

// User management console
router.get('/users', listAllUsers);
router.get('/users/:userId', getUserDetail);
router.patch('/users/:userId/deactivate', deactivateUser);
router.patch('/users/:userId/reactivate', reactivateUser);

export default router;
