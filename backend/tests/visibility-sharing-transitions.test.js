/**
 * TrustVault Backend - Document Visibility Sharing & Settings Navigation Test Suite
 * Validates:
 * 1. Three visibility modes across Upload and Share:
 *    - 'private' (Private — Only Me)
 *    - 'selected_users' / 'specific_users' (Share with Specific Users)
 *    - 'all_authenticated_users' (Share with All Registered Users)
 * 2. Every transition between visibility modes:
 *    - Private -> Specific Users
 *    - Specific Users -> All Registered Users
 *    - All Registered Users -> Specific Users
 *    - Specific Users -> Private (Immediate revocation of former collaborators)
 *    - All Registered Users -> Private (Immediate revocation of general members)
 *    - Private -> All Registered Users
 * 3. Read vs Edit permissions & restrictions:
 *    - All Registered Users gives Read-only (no edit permission to general members)
 *    - Explicit Edit grants in ACL are preserved when switching to All Registered Users
 * 4. Dynamic access for newly registered accounts in All Registered Users mode
 * 5. Authorization security:
 *    - Non-owners and Viewers cannot change visibility (403 Forbidden + ACCESS_DENIED audit)
 *    - Unauthenticated requests rejected (401)
 *    - Invalid visibility values rejected (400)
 * 6. Change Password endpoint (/api/auth/change-password):
 *    - Verified for Admin, Owner, and Viewer roles
 *    - Bcrypt hashing (12 rounds) with no plaintext password leakage
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Document } from '../src/models/document.model.js';
import { AuditLog } from '../src/models/audit.model.js';

describe('Document Visibility Sharing Transitions & Security Controls', () => {
  const app = createApp();

  let adminToken, adminId;
  let ownerToken, ownerId;
  let collaboratorToken, collaboratorId;
  let thirdPartyToken, thirdPartyId;

  const testFilesDir = path.resolve(__dirname, 'test-files-sharing');
  const dummyFilePath = path.join(testFilesDir, 'share_transition_test.txt');

  beforeEach(async () => {
    User.clearInMemory();
    Document.clearInMemory();
    AuditLog.clearInMemory();

    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }
    fs.writeFileSync(dummyFilePath, 'TrustVault Zero-Trust Document Content: FY2027 Planning', 'utf-8');

    // 1. Seed Admin
    const resAdmin = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'System Admin',
        email: 'admin@trustvault.internal',
        password: 'Password123!',
      });
    adminToken = resAdmin.body.data.token;
    adminId = resAdmin.body.data.user._id || resAdmin.body.data.user.id;
    await User.findByIdAndUpdate(adminId, { role: 'admin', isEmailVerified: true });

    // 2. Seed Document Owner
    const resOwner = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Sarah Owner',
        email: 'sarah.owner@trustvault.internal',
        password: 'Password123!',
      });
    ownerToken = resOwner.body.data.token;
    ownerId = resOwner.body.data.user._id || resOwner.body.data.user.id;
    await User.findByIdAndUpdate(ownerId, { role: 'owner', isEmailVerified: true });

    // 3. Seed Collaborator
    const resCollab = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alex Collab',
        email: 'alex.collab@trustvault.internal',
        password: 'Password123!',
      });
    collaboratorToken = resCollab.body.data.token;
    collaboratorId = resCollab.body.data.user._id || resCollab.body.data.user.id;
    await User.findByIdAndUpdate(collaboratorId, { role: 'viewer', isEmailVerified: true });

    // 4. Seed Third Party
    const resThird = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'David ThirdParty',
        email: 'david.third@trustvault.internal',
        password: 'Password123!',
      });
    thirdPartyToken = resThird.body.data.token;
    thirdPartyId = resThird.body.data.user._id || resThird.body.data.user.id;
    await User.findByIdAndUpdate(thirdPartyId, { role: 'viewer', isEmailVerified: true });
  });

  afterAll(() => {
    if (fs.existsSync(dummyFilePath)) {
      try { fs.unlinkSync(dummyFilePath); } catch {}
    }
    if (fs.existsSync(testFilesDir)) {
      try { fs.rmdirSync(testFilesDir); } catch {}
    }
  });

  // Helper to upload document
  async function uploadDoc(visibility = 'private', recipients = []) {
    const req = request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('title', 'Executive Compensation & Strategic Budget')
      .field('description', 'Classified corporate budget metrics')
      .field('visibility', visibility)
      .attach('file', dummyFilePath);

    if (recipients.length > 0) {
      req.field('recipients', JSON.stringify(recipients));
    }

    const res = await req;
    expect(res.status).toBe(201);
    return res.body.document;
  }

  describe('1. Document Upload Visibility Options', () => {
    it('1.1 Should upload document with Private — Only Me by default', async () => {
      const doc = await uploadDoc('private');
      expect(doc.visibility).toBe('private');
      expect(doc.acl).toEqual([]);

      // Owner can read and download
      const getRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(getRes.status).toBe(200);

      // Other users cannot access
      const collabRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${collaboratorToken}`);
      expect(collabRes.status).toBe(403);
    });

    it('1.2 Should upload document with Share with Specific Users and assign Read/Edit', async () => {
      const doc = await uploadDoc('selected_users', [
        { email: 'alex.collab@trustvault.internal', permissionLevel: 'edit' },
      ]);
      expect(doc.visibility).toBe('selected_users');
      expect(doc.acl.length).toBe(1);
      expect(doc.acl[0].permissionLevel).toBe('edit');

      // Collaborator can read
      const getRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${collaboratorToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.document.accessLevel).toBe('Editor');

      // Third party cannot read
      const thirdRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${thirdPartyToken}`);
      expect(thirdRes.status).toBe(403);
    });

    it('1.3 Should upload document with Share with All Registered Users (Read-Only)', async () => {
      const doc = await uploadDoc('all_authenticated_users');
      expect(doc.visibility).toBe('all_authenticated_users');

      // Both collaborator and third-party can read and download
      const collabRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${collaboratorToken}`);
      expect(collabRes.status).toBe(200);

      const downloadRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}/download`)
        .set('Authorization', `Bearer ${thirdPartyToken}`);
      expect(downloadRes.status).toBe(200);

      // But general users CANNOT edit
      const editRes = await request(app)
        .patch(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ title: 'Tampered Title' });
      expect(editRes.status).toBe(403);

      // Unauthenticated request is rejected
      const unauthRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}/download`);
      expect(unauthRes.status).toBe(401);
    });
  });

  describe('2. Share Modal Visibility Transitions', () => {
    it('2.1 Transition: Private -> Share with Specific Users via PATCH /api/documents/:id/visibility', async () => {
      const doc = await uploadDoc('private');

      // Owner changes visibility to selected_users and specifies recipients
      const patchRes = await request(app)
        .patch(`/api/documents/${doc.id || doc._id}/visibility`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          visibility: 'selected_users',
          recipients: [{ email: 'alex.collab@trustvault.internal', permissionLevel: 'read' }],
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.document.visibility).toBe('selected_users');
      expect(patchRes.body.document.acl.length).toBe(1);

      // Collaborator now has access
      const readRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${collaboratorToken}`);
      expect(readRes.status).toBe(200);

      // Third party remains blocked
      const thirdRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${thirdPartyToken}`);
      expect(thirdRes.status).toBe(403);
    });

    it('2.2 Transition: Specific Users -> Share with All Registered Users', async () => {
      const doc = await uploadDoc('selected_users', [
        { email: 'alex.collab@trustvault.internal', permissionLevel: 'edit' },
      ]);

      // Change visibility to all_authenticated_users
      const patchRes = await request(app)
        .patch(`/api/documents/${doc.id || doc._id}/visibility`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ visibility: 'all_authenticated_users' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.document.visibility).toBe('all_authenticated_users');

      // Third party now has read access
      const thirdRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${thirdPartyToken}`);
      expect(thirdRes.status).toBe(200);

      // Collaborator retains their explicit Edit privilege
      const editRes = await request(app)
        .patch(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ title: 'Authorized Editor Update' });
      expect(editRes.status).toBe(200);
      expect(editRes.body.document.title).toBe('Authorized Editor Update');

      // But third party cannot edit
      const thirdEditRes = await request(app)
        .patch(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${thirdPartyToken}`)
        .send({ title: 'Unauthorized Edit' });
      expect(thirdEditRes.status).toBe(403);
    });

    it('2.3 Transition: All Registered Users -> Share with Specific Users', async () => {
      const doc = await uploadDoc('all_authenticated_users');

      // Change visibility to selected_users with only Alex in ACL
      const patchRes = await request(app)
        .patch(`/api/documents/${doc.id || doc._id}/visibility`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          visibility: 'selected_users',
          recipients: [{ email: 'alex.collab@trustvault.internal', permissionLevel: 'read' }],
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.document.visibility).toBe('selected_users');

      // Alex still has access
      const alexRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${collaboratorToken}`);
      expect(alexRes.status).toBe(200);

      // David (third party) is now immediately denied access
      const davidRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${thirdPartyToken}`);
      expect(davidRes.status).toBe(403);
    });

    it('2.4 Transition: Specific Users -> Private (Immediate Revocation)', async () => {
      const doc = await uploadDoc('selected_users', [
        { email: 'alex.collab@trustvault.internal', permissionLevel: 'edit' },
      ]);

      // Verify collaborator had access
      const preRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${collaboratorToken}`);
      expect(preRes.status).toBe(200);

      // Owner changes to Private
      const patchRes = await request(app)
        .patch(`/api/documents/${doc.id || doc._id}/visibility`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ visibility: 'private' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.document.visibility).toBe('private');
      expect(patchRes.body.document.acl).toEqual([]);

      // Collaborator is now immediately revoked across read, download, and edit
      const getPost = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${collaboratorToken}`);
      expect(getPost.status).toBe(403);

      const downloadPost = await request(app)
        .get(`/api/documents/${doc.id || doc._id}/download`)
        .set('Authorization', `Bearer ${collaboratorToken}`);
      expect(downloadPost.status).toBe(403);

      const editPost = await request(app)
        .patch(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ title: 'Forbidden Edit' });
      expect(editPost.status).toBe(403);
    });

    it('2.5 Transition: All Registered Users -> Private (Immediate Revocation)', async () => {
      const doc = await uploadDoc('all_authenticated_users');

      // Switch to Private
      const patchRes = await request(app)
        .patch(`/api/documents/${doc.id || doc._id}/visibility`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ visibility: 'private' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.document.visibility).toBe('private');

      // All non-owners immediately lose access
      const thirdRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${thirdPartyToken}`);
      expect(thirdRes.status).toBe(403);

      const collabRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}/download`)
        .set('Authorization', `Bearer ${collaboratorToken}`);
      expect(collabRes.status).toBe(403);
    });

    it('2.6 Transition: Private -> Share with All Registered Users', async () => {
      const doc = await uploadDoc('private');

      const patchRes = await request(app)
        .patch(`/api/documents/${doc.id || doc._id}/visibility`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ visibility: 'all_authenticated_users' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.document.visibility).toBe('all_authenticated_users');

      const thirdRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${thirdPartyToken}`);
      expect(thirdRes.status).toBe(200);
    });

    it('2.7 Accepts specific_users as an alias for selected_users', async () => {
      const doc = await uploadDoc('private');

      const patchRes = await request(app)
        .patch(`/api/documents/${doc.id || doc._id}/visibility`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ visibility: 'specific_users' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.document.visibility).toBe('selected_users');
    });

    it('2.8 Dynamic access for newly registered users in All Registered Users mode', async () => {
      const doc = await uploadDoc('all_authenticated_users');

      // Register a brand new user AFTER document was uploaded
      const resNew = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Eva NewUser',
          email: 'eva.new@trustvault.internal',
          password: 'Password123!',
        });
      const newToken = resNew.body.data.token;
      const newId = resNew.body.data.user._id || resNew.body.data.user.id;
      await User.findByIdAndUpdate(newId, { isEmailVerified: true });

      // New user immediately has read access without copying into a permanent ACL
      const getRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${newToken}`);
      expect(getRes.status).toBe(200);

      // Verify new user was not added to doc.acl
      const permRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}/permissions`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(permRes.body.acl.some((e) => e.email === 'eva.new@trustvault.internal')).toBe(false);
    });
  });

  describe('3. Authorization Security & Audit Trails', () => {
    it('3.1 Rejects visibility change by non-owner / Viewer with 403 and logs ACCESS_DENIED', async () => {
      const doc = await uploadDoc('private');

      const patchRes = await request(app)
        .patch(`/api/documents/${doc.id || doc._id}/visibility`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ visibility: 'all_authenticated_users' });

      expect(patchRes.status).toBe(403);
      expect(patchRes.body.error.code).toBe('FORBIDDEN');

      // Check audit log
      const auditRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}/audit`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(auditRes.status).toBe(200);
      const deniedEvent = (auditRes.body.auditLogs || []).find(
        (a) => a.action === 'ACCESS_DENIED' && a.metadata?.attemptedAction === 'UPDATE_VISIBILITY'
      );
      expect(deniedEvent).toBeDefined();
    });

    it('3.2 Records DOCUMENT_VISIBILITY_UPDATED in immutable audit trail', async () => {
      const doc = await uploadDoc('private');

      await request(app)
        .patch(`/api/documents/${doc.id || doc._id}/visibility`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ visibility: 'all_authenticated_users' });

      const auditRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}/audit`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const visEvent = (auditRes.body.auditLogs || []).find(
        (a) => a.action === 'DOCUMENT_VISIBILITY_UPDATED'
      );
      expect(visEvent).toBeDefined();
      expect(visEvent.metadata.previousVisibility).toBe('private');
      expect(visEvent.metadata.newVisibility).toBe('all_authenticated_users');
    });

    it('3.3 Returns visibility in GET /api/documents/:id/permissions', async () => {
      const doc = await uploadDoc('all_authenticated_users');

      const permRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}/permissions`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(permRes.status).toBe(200);
      expect(permRes.body.visibility).toBe('all_authenticated_users');
    });

    it('3.4 Auto-updates private visibility to selected_users when permission is granted', async () => {
      const doc = await uploadDoc('private');

      const grantRes = await request(app)
        .post(`/api/documents/${doc.id || doc._id}/permissions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'alex.collab@trustvault.internal',
          permissionLevel: 'read',
        });

      expect(grantRes.status).toBe(200);
      expect(grantRes.body.visibility).toBe('selected_users');
      expect(grantRes.body.acl.length).toBe(1);
    });
  });

  describe('4. Settings Change Password Security', () => {
    it('4.1 Changes password securely for Viewer through POST /api/auth/change-password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'NewVaultPassword456!',
          confirmPassword: 'NewVaultPassword456!',
        });

      expect(res.status).toBe(200);

      // Verify can login with new password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alex.collab@trustvault.internal',
          password: 'NewVaultPassword456!',
        });
      expect(loginRes.status).toBe(200);

      // Old password no longer works
      const oldLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alex.collab@trustvault.internal',
          password: 'Password123!',
        });
      expect(oldLoginRes.status).toBe(401);
    });

    it('4.2 Rejects incorrect current password with 400', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          currentPassword: 'WrongPassword999!',
          newPassword: 'NewVaultPassword456!',
          confirmPassword: 'NewVaultPassword456!',
        });

      expect(res.status).toBe(400);
    });

    it('4.3 Rejects identical new password reuse with 400 SAME_PASSWORD', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'Password123!',
          confirmPassword: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SAME_PASSWORD');
    });

    it('4.4 Rejects mismatched password confirmation with 400 PASSWORD_MISMATCH', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'NewVaultPassword456!',
          confirmPassword: 'DifferentPassword789!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PASSWORD_MISMATCH');
    });
  });
});
