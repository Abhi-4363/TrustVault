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
  updateUserRole,
  updateUserPassword,
  initiatePasswordReset,
  listOwnerRequests,
  approveOwnerRequest,
  rejectOwnerRequest,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  approvePasswordResetNotification,
  rejectPasswordResetNotification,
  approveOwnerRequestNotification,
  rejectOwnerRequestNotification,
  approveUserPasswordReset,
  rejectUserPasswordReset,
} from '../controllers/admin.controller.js';

const router = Router();

// All admin routes require authentication + admin role
router.use(requireAuth);
router.use(requireRole('admin'));

// Administrator Notification Center
router.get('/notifications', listNotifications);
router.patch('/notifications/:id/read', markNotificationRead);
router.post('/notifications/mark-all-read', markAllNotificationsRead);
router.post('/notifications/:id/reset-password', approvePasswordResetNotification);
router.post('/notifications/:id/reject-password-reset', rejectPasswordResetNotification);
router.post('/notifications/:id/approve-owner', approveOwnerRequestNotification);
router.post('/notifications/:id/reject-owner', rejectOwnerRequestNotification);

// System analytics dashboard
router.get('/analytics', getAnalytics);

// Global audit log viewer (paginated)
router.get('/audit-logs', getGlobalAuditLogs);

// Audit log export (CSV/JSON, no truncation)
router.get('/audit-logs/export', exportAuditLogs);

// Owner access requests
router.get('/owner-requests', listOwnerRequests);
router.post('/owner-requests/:userId/approve', approveOwnerRequest);
router.post('/owner-requests/:userId/reject', rejectOwnerRequest);

// User management console
router.get('/users', listAllUsers);
router.get('/users/:userId', getUserDetail);
router.patch('/users/:userId/role', updateUserRole);
router.patch('/users/:userId/password', updateUserPassword);
router.post('/users/:userId/reset-password', initiatePasswordReset);
router.post('/users/:userId/password-reset/approve', approveUserPasswordReset);
router.post('/users/:userId/password-reset/reject', rejectUserPasswordReset);
router.patch('/users/:userId/deactivate', deactivateUser);
router.patch('/users/:userId/reactivate', reactivateUser);

export default router;
