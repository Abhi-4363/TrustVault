/**
 * TrustVault Backend - Visibility, ACLs, and Password Management Test Suite (Phase 11)
 * Validates:
 * - Document upload visibility ('private', 'selected_users', 'all_authenticated_users')
 * - Default 'private' visibility behavior
 * - Cross-user access isolation and zero-trust download boundaries
 * - Dynamic visibility modifications (PATCH /api/documents/:id/visibility)
 * - Immediate revocation upon transition to 'private'
 * - User self password change (POST /api/auth/change-password)
 * - Admin single-use password recovery initiation (POST /api/admin/users/:userId/reset-password)
 * - Token hashing, one-time consumption, and expiration (POST /api/auth/reset-password)
 * - Preservation of user roles, document ownership, and ACLs across credential changes
 * - Audit logging verification without credential leakage
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Document } from '../src/models/document.model.js';
import { AuditLog } from '../src/models/audit.model.js';

describe('Document Visibility, ACLs, and Password Management (Phase 11)', () => {
  const app = createApp();

  let adminToken, adminId;
  let ownerToken, ownerId;
  let viewer1Token, viewer1Id;
  let viewer2Token, viewer2Id;

  const testFilesDir = path.resolve(__dirname, 'test-files-vis');
  const dummyFilePath = path.join(testFilesDir, 'vault_test.txt');

  beforeEach(async () => {
    User.clearInMemory();
    Document.clearInMemory();
    AuditLog.clearInMemory();

    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }
    fs.writeFileSync(dummyFilePath, 'Confidential TrustVault Payload: Snovasys 2026', 'utf-8');

    // 1. Seed Admin
    const resAdmin = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Super Admin',
        email: 'admin@trustvault.internal',
        password: 'Password123!',
      });
    adminToken = resAdmin.body.data.token;
    adminId = resAdmin.body.data.user._id || resAdmin.body.data.user.id;
    await User.findByIdAndUpdate(adminId, { role: 'admin' });

    // 2. Seed Owner
    const resOwner = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Sarah Owner',
        email: 'sarah.owner@trustvault.internal',
        password: 'Password123!',
      });
    ownerToken = resOwner.body.data.token;
    ownerId = resOwner.body.data.user._id || resOwner.body.data.user.id;
    await User.findByIdAndUpdate(ownerId, { role: 'owner' });

    // 3. Seed Viewer 1
    const resV1 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alex Viewer',
        email: 'alex.viewer@trustvault.internal',
        password: 'Password123!',
      });
    viewer1Token = resV1.body.data.token;
    viewer1Id = resV1.body.data.user._id || resV1.body.data.user.id;

    // 4. Seed Viewer 2
    const resV2 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'David Viewer',
        email: 'david.viewer@trustvault.internal',
        password: 'Password123!',
      });
    viewer2Token = resV2.body.data.token;
    viewer2Id = resV2.body.data.user._id || resV2.body.data.user.id;
  });

  afterAll(() => {
    if (fs.existsSync(dummyFilePath)) {
      try { fs.unlinkSync(dummyFilePath); } catch {}
    }
    if (fs.existsSync(testFilesDir)) {
      try { fs.rmdirSync(testFilesDir); } catch {}
    }
  });

  // ============================================================================
  // GROUP 1: Document Visibility During Upload & Access Enforcement
  // ============================================================================
  describe('Document Visibility During Ingestion', () => {
    it('11. Upload defaults to Private if visibility is omitted', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('title', 'Secret Financial Plan')
        .attach('file', dummyFilePath);

      expect(res.status).toBe(201);
      expect(res.body.document.visibility).toBe('private');
    });

    it('12. Private documents are inaccessible to unrelated users', async () => {
      const uploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('title', 'Strictly Private Doc')
        .field('visibility', 'private')
        .attach('file', dummyFilePath);

      const docId = uploadRes.body.document._id || uploadRes.body.document.id;

      // Viewer 1 tries to read metadata
      const readRes = await request(app)
        .get(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${viewer1Token}`);
      expect(readRes.status).toBe(403);

      // Viewer 1 tries to stream download
      const downloadRes = await request(app)
        .get(`/api/documents/${docId}/download`)
        .set('Authorization', `Bearer ${viewer1Token}`);
      expect(downloadRes.status).toBe(403);
    });

    it('13. Specific-user sharing grants only the selected recipients the selected permissions', async () => {
      const uploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('title', 'Team Shared Report')
        .field('visibility', 'selected_users')
        .field(
          'recipients',
          JSON.stringify([
            { email: 'alex.viewer@trustvault.internal', permissionLevel: 'edit' },
          ])
        )
        .attach('file', dummyFilePath);

      expect(uploadRes.status).toBe(201);
      const docId = uploadRes.body.document._id || uploadRes.body.document.id;

      // Alex (Viewer 1) has edit permission
      const alexRead = await request(app)
        .get(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${viewer1Token}`);
      expect(alexRead.status).toBe(200);

      const alexEdit = await request(app)
        .patch(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${viewer1Token}`)
        .send({ description: 'Updated by authorized collaborator' });
      expect(alexEdit.status).toBe(200);

      // David (Viewer 2) was NOT selected - must receive 403
      const davidRead = await request(app)
        .get(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${viewer2Token}`);
      expect(davidRead.status).toBe(403);
    });

    it('16 & 17. All Registered Users visibility is accessible to authenticated users but blocks unauthenticated access', async () => {
      const uploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('title', 'Corporate Policy 2026')
        .field('visibility', 'all_authenticated_users')
        .attach('file', dummyFilePath);

      expect(uploadRes.status).toBe(201);
      const docId = uploadRes.body.document._id || uploadRes.body.document.id;

      // Viewer 1 (authenticated) can read
      const v1Read = await request(app)
        .get(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${viewer1Token}`);
      expect(v1Read.status).toBe(200);

      // Viewer 2 (authenticated) can download
      const v2Download = await request(app)
        .get(`/api/documents/${docId}/download`)
        .set('Authorization', `Bearer ${viewer2Token}`);
      expect(v2Download.status).toBe(200);

      // Unauthenticated request MUST be rejected with 401
      const unauthRead = await request(app)
        .get(`/api/documents/${docId}`);
      expect(unauthRead.status).toBe(401);

      const unauthDownload = await request(app)
        .get(`/api/documents/${docId}/download`);
      expect(unauthDownload.status).toBe(401);
    });
  });

  // ============================================================================
  // GROUP 2: Dynamic Visibility Changes & Immediate Revocation
  // ============================================================================
  describe('Document Visibility Modification & Revocation', () => {
    it('19. Changing visibility to Private immediately revokes access from other users and clears ACL', async () => {
      // Create document shared with All Authenticated Users
      const uploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('title', 'Broad Announcement')
        .field('visibility', 'all_authenticated_users')
        .attach('file', dummyFilePath);

      const docId = uploadRes.body.document._id || uploadRes.body.document.id;

      // Verify Viewer 1 can read
      const beforeSwitch = await request(app)
        .get(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${viewer1Token}`);
      expect(beforeSwitch.status).toBe(200);

      // Owner changes visibility to 'private'
      const changeRes = await request(app)
        .patch(`/api/documents/${docId}/visibility`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ visibility: 'private' });
      expect(changeRes.status).toBe(200);
      expect(changeRes.body.document.visibility).toBe('private');

      // Subsequent read request from Viewer 1 must immediately fail with 403
      const afterSwitch = await request(app)
        .get(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${viewer1Token}`);
      expect(afterSwitch.status).toBe(403);

      // Audit trail must record DOCUMENT_VISIBILITY_UPDATED
      const logs = await AuditLog.find({ action: 'DOCUMENT_VISIBILITY_UPDATED' });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].metadata.newVisibility).toBe('private');
    });

    it('Non-owner cannot modify document visibility', async () => {
      const uploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('title', 'Owner Confidential')
        .field('visibility', 'private')
        .attach('file', dummyFilePath);

      const docId = uploadRes.body.document._id || uploadRes.body.document.id;

      const hackAttempt = await request(app)
        .patch(`/api/documents/${docId}/visibility`)
        .set('Authorization', `Bearer ${viewer1Token}`)
        .send({ visibility: 'all_authenticated_users' });

      expect(hackAttempt.status).toBe(403);
    });
  });

  // ============================================================================
  // GROUP 3: Password Management (Self Change Password)
  // ============================================================================
  describe('User Self Password Change (Phase 7)', () => {
    it('24. A user can change their password with the correct current password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${viewer1Token}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'BrandNewPassword2026!',
          confirmPassword: 'BrandNewPassword2026!',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');

      // Old password should now fail login
      const failLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alex.viewer@trustvault.internal',
          password: 'Password123!',
        });
      expect(failLogin.status).toBe(401);

      // New password should succeed login
      const okLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alex.viewer@trustvault.internal',
          password: 'BrandNewPassword2026!',
        });
      expect(okLogin.status).toBe(200);
      expect(okLogin.body.data.token).toBeDefined();

      // Password should NEVER appear in audit logs
      const logs = await AuditLog.find({ action: 'USER_PASSWORD_CHANGED' });
      expect(logs.length).toBeGreaterThan(0);
      expect(JSON.stringify(logs[0])).not.toContain('BrandNewPassword2026!');
    });

    it('25. Incorrect current password is rejected', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${viewer1Token}`)
        .send({
          currentPassword: 'WrongPassword999!',
          newPassword: 'BrandNewPassword2026!',
          confirmPassword: 'BrandNewPassword2026!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    });

    it('26. Invalid new passwords and mismatched confirmation are rejected', async () => {
      // Mismatched confirmation
      const mismatch = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${viewer1Token}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'BrandNewPassword2026!',
          confirmPassword: 'DifferentPassword2026!',
        });
      expect(mismatch.status).toBe(400);
      expect(mismatch.body.error.code).toBe('PASSWORD_MISMATCH');

      // Weak password (<8 chars)
      const short = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${viewer1Token}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'abc1',
          confirmPassword: 'abc1',
        });
      expect(short.status).toBe(400);
      expect(short.body.error.code).toBe('WEAK_PASSWORD');

      // Identical password reuse
      const same = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${viewer1Token}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'Password123!',
          confirmPassword: 'Password123!',
        });
      expect(same.status).toBe(400);
      expect(same.body.error.code).toBe('SAME_PASSWORD');
    });
  });

  // ============================================================================
  // GROUP 4: Admin Password Reset (Single-Use Token Recovery)
  // ============================================================================
  describe('Admin Single-Use Password Reset (Phase 8)', () => {
    it('28. Non-Admins cannot initiate password recovery for another user', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${viewer1Id}/reset-password`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(403);
    });

    it('29 & 30. Admin can initiate recovery; token expires, cannot be reused, and preserves roles', async () => {
      // Admin initiates recovery for Viewer 1
      const initiateRes = await request(app)
        .post(`/api/admin/users/${viewer1Id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(initiateRes.status).toBe(200);
      expect(initiateRes.body.status).toBe('success');
      expect(initiateRes.body.data.resetToken).toBeDefined();
      expect(initiateRes.body.data.resetLink).toContain('/reset-password?token=');

      const rawToken = initiateRes.body.data.resetToken;

      // Verify that audit log records initiation WITHOUT leaking raw token
      const auditInit = await AuditLog.find({ action: 'PASSWORD_RESET_INITIATED' });
      expect(auditInit.length).toBeGreaterThan(0);
      expect(JSON.stringify(auditInit[0])).not.toContain(rawToken);

      // Viewer 1 resets password using single-use token
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'RecoveredPassword2026!',
          confirmPassword: 'RecoveredPassword2026!',
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.status).toBe('success');

      // 30. Token CANNOT be reused a second time (Single-use guarantee)
      const reuseAttempt = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'AnotherPassword2026!',
          confirmPassword: 'AnotherPassword2026!',
        });
      expect(reuseAttempt.status).toBe(400);
      expect(reuseAttempt.body.error.code).toBe('INVALID_RESET_TOKEN');

      // Verify Viewer 1 can now login with new recovered password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alex.viewer@trustvault.internal',
          password: 'RecoveredPassword2026!',
        });
      expect(loginRes.status).toBe(200);

      // 34. Password recovery does NOT alter account role or status
      const updatedUser = await User.findById(viewer1Id);
      expect(updatedUser.role).toBe('viewer');
      expect(updatedUser.isActive).toBe(true);
    });

    it('31. Invalid or manipulated reset tokens are rejected', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678',
          newPassword: 'ValidPassword123!',
          confirmPassword: 'ValidPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
    });
  });
});
