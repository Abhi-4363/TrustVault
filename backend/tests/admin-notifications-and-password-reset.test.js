/**
 * TrustVault Backend - Admin Notifications & Password Reset Comprehensive Test Suite
 * Validates:
 * 1. Change password for all authenticated roles (Admin, Owner, Viewer) with current verification,
 *    complexity checks, hash persistence, and audit trail without credential leakage.
 * 2. Public forgot-password request with anti-enumeration neutral responses, deduplication,
 *    and unread admin notification creation.
 * 3. Admin Notification Center: Role protection, unread badge counters, filtering,
 *    single mark-as-read, and mark-all-read.
 * 4. Password Reset Admin Workflow: Confirmation to temporary credential 'Password@123',
 *    bcrypt hashing, session invalidation, mustChangePassword mandatory policy enforcement,
 *    and rejection flow without password modification.
 * 5. Owner access request notifications and synchronization with role approvals/rejections.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Document } from '../src/models/document.model.js';
import { AuditLog } from '../src/models/audit.model.js';
import { AdminNotification } from '../src/models/notification.model.js';
import { PasswordResetRequest } from '../src/models/passwordResetRequest.model.js';

describe('Admin Notifications and Password Reset Suite (Stage 9)', () => {
  const app = createApp();

  let adminToken, adminId, adminUser;
  let ownerToken, ownerId, ownerUser;
  let viewerToken, viewerId, viewerUser;

  beforeEach(async () => {
    User.clearInMemory();
    Document.clearInMemory();
    AuditLog.clearInMemory();
    AdminNotification.clearInMemory();
    PasswordResetRequest.clearInMemory();

    // 1. Seed Administrator
    const resAdmin = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Chief Administrator',
        email: 'admin@trustvault.internal',
        password: 'AdminPassword123!',
      });
    adminToken = resAdmin.body.data.token;
    adminId = resAdmin.body.data.user._id || resAdmin.body.data.user.id;
    await User.findByIdAndUpdate(adminId, { role: 'admin' });
    adminUser = await User.findById(adminId);

    // 2. Seed Document Owner
    const resOwner = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Olivia Owner',
        email: 'olivia.owner@trustvault.internal',
        password: 'OwnerPassword123!',
      });
    ownerToken = resOwner.body.data.token;
    ownerId = resOwner.body.data.user._id || resOwner.body.data.user.id;
    await User.findByIdAndUpdate(ownerId, { role: 'owner' });
    ownerUser = await User.findById(ownerId);

    // 3. Seed Viewer
    const resViewer = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Victor Viewer',
        email: 'victor.viewer@trustvault.internal',
        password: 'ViewerPassword123!',
      });
    viewerToken = resViewer.body.data.token;
    viewerId = resViewer.body.data.user._id || resViewer.body.data.user.id;
    viewerUser = await User.findById(viewerId);
  });

  // =========================================================================
  // SECTION 1: CHANGE PASSWORD FOR ALL AUTHENTICATED ROLES
  // =========================================================================
  describe('1. Change Password for Every User Role', () => {
    it('1.1 Allows Administrator to change their own password with correct current password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: 'AdminPassword123!',
          newPassword: 'BrandNewAdminPass456!',
          confirmPassword: 'BrandNewAdminPass456!',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/success/i);

      // Verify old password no longer works
      const loginOld = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@trustvault.internal', password: 'AdminPassword123!' });
      expect(loginOld.status).toBe(401);

      // Verify new password works
      const loginNew = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@trustvault.internal', password: 'BrandNewAdminPass456!' });
      expect(loginNew.status).toBe(200);

      // Role must remain admin
      const updatedUser = await User.findById(adminId);
      expect(updatedUser.role).toBe('admin');
    });

    it('1.2 Allows Document Owner to change their own password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          currentPassword: 'OwnerPassword123!',
          newPassword: 'UpdatedOwnerPass789!',
          confirmPassword: 'UpdatedOwnerPass789!',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/success/i);

      // Verify new password works
      const loginNew = await request(app)
        .post('/api/auth/login')
        .send({ email: 'olivia.owner@trustvault.internal', password: 'UpdatedOwnerPass789!' });
      expect(loginNew.status).toBe(200);
    });

    it('1.3 Allows Viewer to change their own password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          currentPassword: 'ViewerPassword123!',
          newPassword: 'UpdatedViewerPass101!',
          confirmPassword: 'UpdatedViewerPass101!',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/success/i);

      const loginNew = await request(app)
        .post('/api/auth/login')
        .send({ email: 'victor.viewer@trustvault.internal', password: 'UpdatedViewerPass101!' });
      expect(loginNew.status).toBe(200);
    });

    it('1.4 Rejects password change when current password is incorrect', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          currentPassword: 'WrongPassword!',
          newPassword: 'UpdatedViewerPass101!',
          confirmPassword: 'UpdatedViewerPass101!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.message).toMatch(/current password/i);

      // Original password must still work
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'victor.viewer@trustvault.internal', password: 'ViewerPassword123!' });
      expect(login.status).toBe(200);
    });

    it('1.5 Rejects password change when new password and confirmation mismatch', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          currentPassword: 'ViewerPassword123!',
          newPassword: 'UpdatedViewerPass101!',
          confirmPassword: 'DifferentPass101!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.message).toMatch(/match/i);
    });

    it('1.6 Rejects weak new passwords (< 8 characters or missing letters/numbers)', async () => {
      const resShort = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          currentPassword: 'ViewerPassword123!',
          newPassword: '12345',
          confirmPassword: '12345',
        });
      expect(resShort.status).toBe(400);

      const resNoNum = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          currentPassword: 'ViewerPassword123!',
          newPassword: 'abcdefghijk',
          confirmPassword: 'abcdefghijk',
        });
      expect(resNoNum.status).toBe(400);
    });

    it('1.7 Stores passwords strictly as bcrypt hashes, never plaintext', async () => {
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          currentPassword: 'ViewerPassword123!',
          newPassword: 'ValidNewSecretPass123!',
          confirmPassword: 'ValidNewSecretPass123!',
        });

      const userInDb = await User.findById(viewerId);
      expect(userInDb.passwordHash).toBeDefined();
      expect(userInDb.passwordHash).not.toBe('ValidNewSecretPass123!');
      expect(userInDb.passwordHash.startsWith('$2b$') || userInDb.passwordHash.startsWith('$2a$')).toBe(true);
      const isMatch = await userInDb.comparePassword('ValidNewSecretPass123!');
      expect(isMatch).toBe(true);
    });

    it('1.8 Records audit log on password change without storing passwords or hashes', async () => {
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          currentPassword: 'ViewerPassword123!',
          newPassword: 'ValidNewSecretPass123!',
          confirmPassword: 'ValidNewSecretPass123!',
        });

      const logs = await AuditLog.find({ action: 'USER_PASSWORD_CHANGED' });
      expect(logs.length).toBeGreaterThanOrEqual(1);
      const log = logs[0];
      const logString = JSON.stringify(log);
      expect(logString).not.toContain('ValidNewSecretPass123!');
      expect(logString).not.toContain('ViewerPassword123!');
      expect(logString).not.toContain('$2b$');
    });
  });

  // =========================================================================
  // SECTION 2: FORGOT PASSWORD PUBLIC WORKFLOW
  // =========================================================================
  describe('2. Forgot Password on Login Page', () => {
    it('2.1 Submitting forgot-password for registered user creates DB record and unread Admin notification', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'victor.viewer@trustvault.internal' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toMatch(/submitted to an administrator/i);

      // Check PasswordResetRequest record
      const reqRecord = await PasswordResetRequest.findOne({ userEmail: 'victor.viewer@trustvault.internal' });
      expect(reqRecord).toBeDefined();
      expect(reqRecord.status).toBe('pending');
      expect(reqRecord.userName).toBe('Victor Viewer');

      // Check AdminNotification record
      const notifs = await AdminNotification.find({
        type: 'password_reset_request',
        userEmail: 'victor.viewer@trustvault.internal',
      });
      expect(notifs.length).toBe(1);
      expect(notifs[0].status).toBe('pending');
      expect(notifs[0].isRead).toBe(false);
    });

    it('2.2 Returns neutral response for unregistered email without enumeration or crashing', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'unregistered.intruder@external.io' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toMatch(/submitted to an administrator/i);

      // No request should be stored for unregistered user
      const reqRecord = await PasswordResetRequest.findOne({ userEmail: 'unregistered.intruder@external.io' });
      expect(reqRecord).toBeNull();
    });

    it('2.3 Deduplicates repeated requests and prevents spamming duplicate notifications', async () => {
      // First request
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'victor.viewer@trustvault.internal' });

      // Second request immediately after
      const res2 = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'victor.viewer@trustvault.internal' });

      expect(res2.status).toBe(200);
      expect(res2.body.message).toMatch(/submitted to an administrator/i);

      // Count notifications — should still be only 1
      const notifs = await AdminNotification.find({
        type: 'password_reset_request',
        userEmail: 'victor.viewer@trustvault.internal',
      });
      expect(notifs.length).toBe(1);
    });
  });

  // =========================================================================
  // SECTION 3: ADMIN NOTIFICATION CENTER
  // =========================================================================
  describe('3. Admin Notification Center', () => {
    beforeEach(async () => {
      // Seed a password reset notification
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'victor.viewer@trustvault.internal' });

      // Seed an owner access request notification using requestedRole: 'owner'
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Rachel Requester',
          email: 'rachel.requester@trustvault.internal',
          password: 'Password123!',
          requestedRole: 'owner',
        });
    });

    it('3.1 Only authenticated administrators can view notifications', async () => {
      // Anonymous
      const resAnon = await request(app).get('/api/admin/notifications');
      expect(resAnon.status).toBe(401);

      // Viewer
      const resViewer = await request(app)
        .get('/api/admin/notifications')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(resViewer.status).toBe(403);

      // Owner
      const resOwner = await request(app)
        .get('/api/admin/notifications')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(resOwner.status).toBe(403);

      // Admin
      const resAdmin = await request(app)
        .get('/api/admin/notifications')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.notifications).toHaveLength(2);
      expect(resAdmin.body.unreadCount).toBe(2);
    });

    it('3.2 Supports filtering by unread, owner_requests, and password_resets', async () => {
      // Filter by password_resets
      const resResets = await request(app)
        .get('/api/admin/notifications?filter=password_resets')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resResets.status).toBe(200);
      expect(resResets.body.notifications.length).toBe(1);
      expect(resResets.body.notifications[0].type).toBe('password_reset_request');

      // Filter by owner_requests
      const resOwners = await request(app)
        .get('/api/admin/notifications?filter=owner_requests')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resOwners.status).toBe(200);
      expect(resOwners.body.notifications.length).toBe(1);
      expect(resOwners.body.notifications[0].type).toBe('owner_access_request');
    });

    it('3.3 Allows admin to mark single notification as read', async () => {
      const listRes = await request(app)
        .get('/api/admin/notifications')
        .set('Authorization', `Bearer ${adminToken}`);
      const targetNotif = listRes.body.notifications[0];

      const patchRes = await request(app)
        .patch(`/api/admin/notifications/${targetNotif._id || targetNotif.id}/read`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.notification.isRead).toBe(true);
      expect(patchRes.body.unreadCount).toBe(1);
    });

    it('3.4 Allows admin to mark all notifications as read', async () => {
      const res = await request(app)
        .post('/api/admin/notifications/mark-all-read')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const listRes = await request(app)
        .get('/api/admin/notifications')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listRes.body.unreadCount).toBe(0);
      listRes.body.notifications.forEach((n) => expect(n.isRead).toBe(true));
    });
  });

  // =========================================================================
  // SECTION 4: EXACT ADMIN PASSWORD RESET WORKFLOW & MANDATORY TEMPORARY POLICY
  // =========================================================================
  describe('4. Admin Password Reset to Password@123 and Mandatory Policy', () => {
    let resetNotifId;

    beforeEach(async () => {
      // User Victor Viewer submits forgot password
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'victor.viewer@trustvault.internal' });

      const listRes = await request(app)
        .get('/api/admin/notifications?filter=password_resets')
        .set('Authorization', `Bearer ${adminToken}`);
      const notif = listRes.body.notifications[0];
      resetNotifId = notif._id || notif.id;
    });

    it('4.1 Rejects reset when requester is not an administrator', async () => {
      const res = await request(app)
        .post(`/api/admin/notifications/${resetNotifId}/reset-password`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });

    it('4.2 Admin confirms reset: resets password to Password@123, sets mustChangePassword: true, logs audit', async () => {
      const res = await request(app)
        .post(`/api/admin/notifications/${resetNotifId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toMatch(/Password@123/);

      // Verify user in database has mustChangePassword: true and password hash matches Password@123
      const updatedUser = await User.findById(viewerId);
      expect(updatedUser.mustChangePassword).toBe(true);
      const isTempPasswordValid = await updatedUser.comparePassword('Password@123');
      expect(isTempPasswordValid).toBe(true);

      // Verify notification status is completed and read
      const updatedNotif = await AdminNotification.findById(resetNotifId);
      expect(updatedNotif.status).toBe('completed');
      expect(updatedNotif.isRead).toBe(true);

      // Verify audit log
      const logs = await AuditLog.find({ action: 'PASSWORD_RESET_APPROVED' });
      expect(logs.length).toBeGreaterThanOrEqual(1);
      const log = logs[0];
      expect(log.metadata?.affectedUserEmail).toBe('victor.viewer@trustvault.internal');
      expect(log.metadata?.outcome).toBe('completed');
      // Plaintext temporary password must NEVER appear in audit log
      expect(JSON.stringify(log)).not.toContain('Password@123');
    });

    it('4.3 Mandatory temporary password policy: blocks vault access until password is changed', async () => {
      // 1. Admin resets password
      await request(app)
        .post(`/api/admin/notifications/${resetNotifId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`);

      // 2. Victor Viewer logs in with temporary password Password@123
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'victor.viewer@trustvault.internal',
          password: 'Password@123',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.user.mustChangePassword).toBe(true);
      const tempUserToken = loginRes.body.data.token;

      // 3. User attempts to access documents or other protected vault routes
      const docAccessRes = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${tempUserToken}`);

      // Must be blocked with 403 PASSWORD_CHANGE_REQUIRED
      expect(docAccessRes.status).toBe(403);
      expect(docAccessRes.body.error?.code).toBe('PASSWORD_CHANGE_REQUIRED');

      // 4. User changes their password to a permanent credential
      const changeRes = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${tempUserToken}`)
        .send({
          currentPassword: 'Password@123',
          newPassword: 'MyPermanentSecurePassword999!',
          confirmPassword: 'MyPermanentSecurePassword999!',
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.message).toMatch(/success/i);

      // 5. User logs in with new permanent credential
      const newLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'victor.viewer@trustvault.internal',
          password: 'MyPermanentSecurePassword999!',
        });

      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.data.user.mustChangePassword).toBe(false);
      const permanentToken = newLoginRes.body.data.token;

      // 6. User can now access vault documents without restriction
      const vaultAccessRes = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${permanentToken}`);
      expect(vaultAccessRes.status).toBe(200);
    });

    it('4.4 Admin rejects password reset: marks request rejected without modifying password', async () => {
      const rejectRes = await request(app)
        .post(`/api/admin/notifications/${resetNotifId}/reject-password-reset`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.status).toBe('success');

      // Notification updated
      const notif = await AdminNotification.findById(resetNotifId);
      expect(notif.status).toBe('rejected');

      // User's original password must still work
      const loginOriginal = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'victor.viewer@trustvault.internal',
          password: 'ViewerPassword123!',
        });
      expect(loginOriginal.status).toBe(200);

      // Re-executing reset on a rejected request is blocked
      const reReset = await request(app)
        .post(`/api/admin/notifications/${resetNotifId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(reReset.status).toBe(400);
    });
  });

  // =========================================================================
  // SECTION 5: OWNER ACCESS REQUEST NOTIFICATIONS & SYNC
  // =========================================================================
  describe('5. Owner Access Request Workflow and Notifications', () => {
    let ownerNotifId, newUserId;

    beforeEach(async () => {
      // User registers requesting Document Owner privileges
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Charlie Candidate',
          email: 'charlie.candidate@trustvault.internal',
          password: 'Password123!',
          requestedRole: 'owner',
        });

      newUserId = regRes.body.data.user._id || regRes.body.data.user.id;

      const notifsRes = await request(app)
        .get('/api/admin/notifications?filter=owner_requests')
        .set('Authorization', `Bearer ${adminToken}`);
      const notif = notifsRes.body.notifications[0];
      ownerNotifId = notif._id || notif.id;
    });

    it('5.1 User remains Viewer until owner approval', async () => {
      const user = await User.findById(newUserId);
      expect(user.role).toBe('viewer');
      expect(user.requestedRole).toBe('owner');
      expect(user.ownerApprovalStatus).toBe('pending');
    });

    it('5.2 Admin approves owner request from notification: elevates role and marks approved', async () => {
      const res = await request(app)
        .post(`/api/admin/notifications/${ownerNotifId}/approve-owner`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // User role elevated to owner
      const user = await User.findById(newUserId);
      expect(user.role).toBe('owner');
      expect(user.ownerApprovalStatus).toBe('approved');

      // Notification status approved
      const notif = await AdminNotification.findById(ownerNotifId);
      expect(notif.status).toBe('approved');
    });

    it('5.3 Admin rejects owner request from notification: preserves viewer role and marks rejected', async () => {
      const res = await request(app)
        .post(`/api/admin/notifications/${ownerNotifId}/reject-owner`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // User remains viewer
      const user = await User.findById(newUserId);
      expect(user.role).toBe('viewer');
      expect(user.ownerApprovalStatus).toBe('rejected');

      // Notification status rejected
      const notif = await AdminNotification.findById(ownerNotifId);
      expect(notif.status).toBe('rejected');
    });
  });

  // =========================================================================
  // SECTION 6: TWO-WAY SYNCHRONIZATION & USER DIRECTORY GOVERNANCE
  // =========================================================================
  describe('6. Unified Governance, Two-Way Sync, and Classification Invariants', () => {
    it('6.1 Owner approval from User Directory immediately updates Notifications and User role', async () => {
      // User registers requesting owner
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Dana Directory',
          email: 'dana.dir@trustvault.internal',
          password: 'Password123!',
          requestedRole: 'owner',
        });
      const userId = regRes.body.data.user._id || regRes.body.data.user.id;

      // Approve from User Directory / Governance endpoint
      const approveRes = await request(app)
        .post(`/api/admin/owner-requests/${userId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(approveRes.status).toBe(200);

      // User role is owner
      const user = await User.findById(userId);
      expect(user.role).toBe('owner');
      expect(user.ownerApprovalStatus).toBe('approved');

      // Matching notification is approved and marked read
      const notifs = await AdminNotification.find({ userId: String(userId) });
      expect(notifs.length).toBeGreaterThan(0);
      expect(notifs[0].status).toBe('approved');
      expect(notifs[0].isRead).toBe(true);

      // Stale or repeated approval is rejected
      const secondApprove = await request(app)
        .post(`/api/admin/owner-requests/${userId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(secondApprove.status).toBe(400);
      expect(secondApprove.body.error.code).toBe('INVALID_REQUEST_STATE');
    });

    it('6.2 Owner rejection from User Directory immediately updates Notifications and keeps Viewer role', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Edward Directory',
          email: 'edward.dir@trustvault.internal',
          password: 'Password123!',
          requestedRole: 'owner',
        });
      const userId = regRes.body.data.user._id || regRes.body.data.user.id;

      // Reject from User Directory / Governance endpoint
      const rejectRes = await request(app)
        .post(`/api/admin/owner-requests/${userId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Insufficient business justification' });
      expect(rejectRes.status).toBe(200);

      // User remains viewer
      const user = await User.findById(userId);
      expect(user.role).toBe('viewer');
      expect(user.ownerApprovalStatus).toBe('rejected');

      // Matching notification is rejected
      const notifs = await AdminNotification.find({ userId: String(userId) });
      expect(notifs[0].status).toBe('rejected');
    });

    it('6.3 Password reset from User Directory resets password to Password@123 and syncs Notifications', async () => {
      // Victor requests password reset
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'victor.viewer@trustvault.internal' });

      const victorUser = await User.findOne({ email: 'victor.viewer@trustvault.internal' });
      const victorId = String(victorUser._id || victorUser.id);

      // Verify listAllUsers returns pending reset status
      const listRes = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      const victorInList = listRes.body.users.find((u) => u.email === 'victor.viewer@trustvault.internal');
      expect(victorInList.passwordResetStatus).toBe('pending');

      // Admin executes reset from User Directory endpoint
      const resetRes = await request(app)
        .post(`/api/admin/users/${victorId}/password-reset/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resetRes.status).toBe(200);

      // User password is now Password@123 with mustChangePassword: true
      const updatedUser = await User.findById(victorId);
      expect(updatedUser.mustChangePassword).toBe(true);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'victor.viewer@trustvault.internal',
          password: 'Password@123',
        });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.user.mustChangePassword).toBe(true);

      // Notifications synced to completed
      const notifs = await AdminNotification.find({ userId: victorId, type: 'password_reset_request' });
      expect(notifs[0].status).toBe('completed');

      // Duplicate reset attempt receives 400
      const dupRes = await request(app)
        .post(`/api/admin/users/${victorId}/password-reset/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(dupRes.status).toBe(400);
      expect(dupRes.body.error.code).toBe('REQUEST_ALREADY_PROCESSED');
    });

    it('6.4 Password reset rejection from User Directory keeps password intact and syncs Notifications', async () => {
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'victor.viewer@trustvault.internal' });

      const victorUser = await User.findOne({ email: 'victor.viewer@trustvault.internal' });
      const victorId = String(victorUser._id || victorUser.id);
      const originalHash = victorUser.passwordHash;

      // Admin rejects reset from User Directory
      const rejectRes = await request(app)
        .post(`/api/admin/users/${victorId}/password-reset/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Identity could not be verified' });
      expect(rejectRes.status).toBe(200);

      // User password hash is completely unchanged
      const freshUser = await User.findById(victorId);
      expect(freshUser.passwordHash).toBe(originalHash);

      // Notifications synced to rejected
      const notifs = await AdminNotification.find({ userId: victorId, type: 'password_reset_request' });
      expect(notifs[0].status).toBe('rejected');
    });

    it('6.5 Mark Read only updates isRead and does NOT alter request lifecycle status', async () => {
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'victor.viewer@trustvault.internal' });

      const notifs = await AdminNotification.find({
        type: 'password_reset_request',
        userEmail: 'victor.viewer@trustvault.internal',
      });
      const notifId = notifs[0]._id || notifs[0].id;

      // Mark read
      const markRes = await request(app)
        .patch(`/api/admin/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(markRes.status).toBe(200);
      expect(markRes.body.notification.isRead).toBe(true);
      expect(markRes.body.notification.status).toBe('pending'); // Still pending!

      // PasswordResetRequest is still pending
      const resetReq = await PasswordResetRequest.findOne({ userEmail: 'victor.viewer@trustvault.internal' });
      expect(resetReq.status).toBe('pending');
    });

    it('6.6 Non-Admins cannot access User Directory reset or approval endpoints', async () => {
      const victorUser = await User.findOne({ email: 'victor.viewer@trustvault.internal' });
      const victorId = String(victorUser._id || victorUser.id);

      // Viewer attempt
      const vRes = await request(app)
        .post(`/api/admin/users/${victorId}/password-reset/approve`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(vRes.status).toBe(403);

      // Owner attempt
      const oRes = await request(app)
        .post(`/api/admin/users/${victorId}/password-reset/reject`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(oRes.status).toBe(403);
    });
  });
});
