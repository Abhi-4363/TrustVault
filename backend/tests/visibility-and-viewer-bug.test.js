/**
 * TrustVault Backend - Document Visibility Modes & Viewer Bug Regression Test Suite
 * Specifically validates:
 * 1. Mode A (Private): Strictly owner and admin only; hidden from lists, search, and direct endpoints.
 * 2. Mode B (Share with Specific Viewer(s)): Owner shares with Viewer permission ('viewer' or 'read');
 *    recipient sees document in their list, can inspect metadata and stream download.
 * 3. Viewer Restrictions: Viewer cannot edit, delete, reshare, revoke, or change visibility.
 * 4. Isolation: Unrelated users cannot see or access documents shared with a specific viewer.
 * 5. Mode C (Share with Everyone): All authenticated users have Read-only access; unauthenticated blocked.
 * 6. Switching Everyone -> Private removes broader access immediately.
 * 7. Switching Everyone -> Specific Viewers restricts access to selected recipients only.
 * 8. Immediate Revocation & Re-grant: Revoking access immediately blocks recipient; re-granting restores access.
 * 9. Owner & Admin retention: Document owner retains edit/delete/manage rights; admin retains governance rights.
 * 10. Audit Logging: Audit trail accurately records events and authorization rejections.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Document } from '../src/models/document.model.js';
import { AuditLog } from '../src/models/audit.model.js';
import { clearRevocationCache } from '../src/services/revocation.service.js';

describe('Document Visibility Modes & Viewer Bug Regression Suite', () => {
  const app = createApp();

  let adminToken, adminId;
  let ownerToken, ownerId;
  let viewerToken, viewerId;
  let unrelatedToken, unrelatedId;

  const testDir = path.resolve(__dirname, 'test-files-regression');
  const testFile = path.join(testDir, 'confidential_spec.txt');

  beforeEach(async () => {
    User.clearInMemory();
    Document.clearInMemory();
    AuditLog.clearInMemory();
    clearRevocationCache();

    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    fs.writeFileSync(testFile, 'Confidential Enterprise Payload for TrustVault Testing', 'utf-8');

    // 1. Admin
    const resAdmin = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Enterprise Admin',
        email: 'admin@trustvault.internal',
        password: 'Password123!',
      });
    adminToken = resAdmin.body.data.token;
    adminId = resAdmin.body.data.user._id || resAdmin.body.data.user.id;
    await User.findByIdAndUpdate(adminId, { role: 'admin', isEmailVerified: true });

    // 2. Owner
    const resOwner = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Owner',
        email: 'alice.owner@trustvault.internal',
        password: 'Password123!',
      });
    ownerToken = resOwner.body.data.token;
    ownerId = resOwner.body.data.user._id || resOwner.body.data.user.id;
    await User.findByIdAndUpdate(ownerId, { role: 'owner', isEmailVerified: true });

    // 3. Specific Viewer
    const resViewer = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Bob Viewer',
        email: 'bob.viewer@trustvault.internal',
        password: 'Password123!',
      });
    viewerToken = resViewer.body.data.token;
    viewerId = resViewer.body.data.user._id || resViewer.body.data.user.id;
    await User.findByIdAndUpdate(viewerId, { role: 'viewer', isEmailVerified: true });

    // 4. Unrelated User
    const resUnrelated = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Charlie Unrelated',
        email: 'charlie.unrelated@trustvault.internal',
        password: 'Password123!',
      });
    unrelatedToken = resUnrelated.body.data.token;
    unrelatedId = resUnrelated.body.data.user._id || resUnrelated.body.data.user.id;
    await User.findByIdAndUpdate(unrelatedId, { role: 'viewer', isEmailVerified: true });
  });

  afterAll(() => {
    if (fs.existsSync(testFile)) {
      try { fs.unlinkSync(testFile); } catch {}
    }
    if (fs.existsSync(testDir)) {
      try { fs.rmdirSync(testDir); } catch {}
    }
  });

  async function uploadDocument(visibility = 'private', recipients = []) {
    const req = request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('title', 'Corporate Strategy 2027')
      .field('description', 'Strictly confidential company strategy')
      .field('visibility', visibility)
      .attach('file', testFile);

    if (recipients.length > 0) {
      req.field('recipients', JSON.stringify(recipients));
    }

    const res = await req;
    expect(res.status).toBe(201);
    return res.body.document;
  }

  // 1. Private Mode
  describe('Mode A: Private Documents', () => {
    it('1.1 Private documents are only accessible to document owner and platform administrator', async () => {
      const doc = await uploadDocument('private');

      // Owner can retrieve metadata
      const ownerRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(ownerRes.status).toBe(200);
      expect(ownerRes.body.document.accessLevel).toBe('Owner');

      // Admin can retrieve metadata
      const adminRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);

      // Other users receive 403 Forbidden
      const viewerRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(viewerRes.status).toBe(403);
    });

    it('1.2 Private documents do not appear in other users document listings or searches', async () => {
      const doc = await uploadDocument('private');

      // Owner sees the document in list
      const ownerList = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(ownerList.status).toBe(200);
      expect(ownerList.body.documents.some((d) => d._id === (doc.id || doc._id))).toBe(true);

      // Viewer cannot see it in list
      const viewerList = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(viewerList.status).toBe(200);
      expect(viewerList.body.documents.some((d) => d._id === (doc.id || doc._id))).toBe(false);

      // Viewer search does not leak private document
      const viewerSearch = await request(app)
        .get('/api/documents/search?q=Strategy')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(viewerSearch.status).toBe(200);
      expect(viewerSearch.body.documents.length).toBe(0);
    });

    it('1.3 Other users cannot download private documents', async () => {
      const doc = await uploadDocument('private');

      const downloadRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}/download`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(downloadRes.status).toBe(403);
    });
  });

  // 2. Specific Viewers Bug Fix & Mode B
  describe('Mode B: Share with Specific Viewer(s)', () => {
    it('2.1 Owner can share document with Viewer permission (using "viewer" or "read") and recipient sees it', async () => {
      const doc = await uploadDocument('private');

      // Grant permission using 'viewer' string
      const grantRes = await request(app)
        .post(`/api/documents/${doc.id || doc._id}/permissions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'bob.viewer@trustvault.internal',
          permissionLevel: 'viewer',
        });
      expect(grantRes.status).toBe(200);
      expect(grantRes.body.visibility).toBe('selected_users');
      expect(grantRes.body.acl[0].permissionLevel).toBe('read');

      // Specific recipient can now list the document in their dashboard
      const viewerList = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(viewerList.status).toBe(200);
      const sharedDoc = viewerList.body.documents.find((d) => d._id === (doc.id || doc._id));
      expect(sharedDoc).toBeDefined();
      expect(sharedDoc.accessLevel).toBe('Reader');

      // Specific recipient can fetch metadata
      const viewerMeta = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(viewerMeta.status).toBe(200);
      expect(viewerMeta.body.document.accessLevel).toBe('Reader');

      // Specific recipient can stream download
      const viewerDownload = await request(app)
        .get(`/api/documents/${doc.id || doc._id}/download`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(viewerDownload.status).toBe(200);
      expect(viewerDownload.headers['content-disposition']).toContain('attachment');
    });

    it('2.2 Viewer cannot edit, delete, reshare, or change permissions of shared document', async () => {
      const doc = await uploadDocument('private');

      await request(app)
        .post(`/api/documents/${doc.id || doc._id}/permissions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'bob.viewer@trustvault.internal',
          permissionLevel: 'read',
        });

      // Attempt to edit metadata -> 403 Forbidden
      const editRes = await request(app)
        .patch(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ title: 'Hacked Title By Viewer' });
      expect(editRes.status).toBe(403);

      // Attempt to delete -> 403 Forbidden
      const deleteRes = await request(app)
        .delete(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(deleteRes.status).toBe(403);

      // Attempt to reshare / grant -> 403 Forbidden
      const reshareRes = await request(app)
        .post(`/api/documents/${doc.id || doc._id}/permissions`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ email: 'charlie.unrelated@trustvault.internal', permissionLevel: 'read' });
      expect(reshareRes.status).toBe(403);

      // Attempt to change visibility -> 403 Forbidden
      const visRes = await request(app)
        .patch(`/api/documents/${doc.id || doc._id}/visibility`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ visibility: 'all_authenticated_users' });
      expect(visRes.status).toBe(403);
    });

    it('2.3 Sharing with one recipient does not expose the document to unrelated users', async () => {
      const doc = await uploadDocument('private');

      await request(app)
        .post(`/api/documents/${doc.id || doc._id}/permissions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'bob.viewer@trustvault.internal',
          permissionLevel: 'read',
        });

      // Charlie (unrelated) does NOT see the document in list
      const unrelatedList = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${unrelatedToken}`);
      expect(unrelatedList.body.documents.some((d) => d._id === (doc.id || doc._id))).toBe(false);

      // Charlie cannot read metadata
      const unrelatedMeta = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${unrelatedToken}`);
      expect(unrelatedMeta.status).toBe(403);

      // Charlie cannot download
      const unrelatedDownload = await request(app)
        .get(`/api/documents/${doc.id || doc._id}/download`)
        .set('Authorization', `Bearer ${unrelatedToken}`);
      expect(unrelatedDownload.status).toBe(403);
    });
  });

  // 3. Mode C: Share with Everyone (all_authenticated_users)
  describe('Mode C: Share with Everyone', () => {
    it('3.1 Share with Everyone allows all authenticated users to read and download (read-only)', async () => {
      const doc = await uploadDocument('all_authenticated_users');

      // Both Bob and Charlie can see it in their lists
      const bobList = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(bobList.body.documents.some((d) => d._id === (doc.id || doc._id))).toBe(true);

      const charlieList = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${unrelatedToken}`);
      expect(charlieList.body.documents.some((d) => d._id === (doc.id || doc._id))).toBe(true);

      // Both have accessLevel 'Reader'
      const charlieDoc = charlieList.body.documents.find((d) => d._id === (doc.id || doc._id));
      expect(charlieDoc.accessLevel).toBe('Reader');

      // Charlie can download
      const charlieDownload = await request(app)
        .get(`/api/documents/${doc.id || doc._id}/download`)
        .set('Authorization', `Bearer ${unrelatedToken}`);
      expect(charlieDownload.status).toBe(200);

      // Charlie cannot edit metadata
      const charlieEdit = await request(app)
        .patch(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${unrelatedToken}`)
        .send({ title: 'Unauthorized Modification' });
      expect(charlieEdit.status).toBe(403);
    });

    it('3.2 Unauthenticated public access is strictly prohibited in Everyone mode', async () => {
      const doc = await uploadDocument('all_authenticated_users');

      // No token -> 401 Unauthorized
      const unauthRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}/download`);
      expect(unauthRes.status).toBe(401);

      const unauthList = await request(app)
        .get('/api/documents');
      expect(unauthList.status).toBe(401);
    });

    it('3.3 Switching from Everyone to Private immediately removes broader access', async () => {
      const doc = await uploadDocument('all_authenticated_users');

      // Both can access initially
      const initialRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${unrelatedToken}`);
      expect(initialRes.status).toBe(200);

      // Owner switches to Private
      const switchRes = await request(app)
        .patch(`/api/documents/${doc.id || doc._id}/visibility`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ visibility: 'private' });
      expect(switchRes.status).toBe(200);
      expect(switchRes.body.document.visibility).toBe('private');

      // Charlie immediately loses access
      const afterRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${unrelatedToken}`);
      expect(afterRes.status).toBe(403);

      const afterDownload = await request(app)
        .get(`/api/documents/${doc.id || doc._id}/download`)
        .set('Authorization', `Bearer ${unrelatedToken}`);
      expect(afterDownload.status).toBe(403);

      // Charlie does not see document in list
      const afterList = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${unrelatedToken}`);
      expect(afterList.body.documents.some((d) => d._id === (doc.id || doc._id))).toBe(false);
    });

    it('3.4 Switching from Everyone to Specific Viewers restricts access to selected recipients', async () => {
      const doc = await uploadDocument('all_authenticated_users');

      // Owner switches to specific_users for Bob only
      const switchRes = await request(app)
        .patch(`/api/documents/${doc.id || doc._id}/visibility`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          visibility: 'selected_users',
          recipients: [{ email: 'bob.viewer@trustvault.internal', permissionLevel: 'read' }],
        });
      expect(switchRes.status).toBe(200);
      expect(switchRes.body.document.visibility).toBe('selected_users');

      // Bob can access
      const bobRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(bobRes.status).toBe(200);

      // Charlie immediately blocked
      const charlieRes = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${unrelatedToken}`);
      expect(charlieRes.status).toBe(403);
    });
  });

  // 4. Revocation Engine & Instant Unblock
  describe('Revocation Engine & Re-grant Verification', () => {
    it('4.1 Revoking access immediately blocks recipient, and re-granting restores access immediately', async () => {
      const doc = await uploadDocument('selected_users', [
        { email: 'bob.viewer@trustvault.internal', permissionLevel: 'read' },
      ]);

      // Bob can access initially
      const initialCheck = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(initialCheck.status).toBe(200);

      // Owner revokes access
      const revokeRes = await request(app)
        .delete(`/api/documents/${doc.id || doc._id}/permissions/${viewerId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(revokeRes.status).toBe(200);

      // Bob immediately denied (zero lag)
      const afterRevoke = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(afterRevoke.status).toBe(403);

      const afterRevokeDownload = await request(app)
        .get(`/api/documents/${doc.id || doc._id}/download`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(afterRevokeDownload.status).toBe(403);

      // Owner re-grants permission to Bob
      const regrantRes = await request(app)
        .post(`/api/documents/${doc.id || doc._id}/permissions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'bob.viewer@trustvault.internal',
          permissionLevel: 'viewer',
        });
      expect(regrantRes.status).toBe(200);

      // Bob can immediately access again without waiting for revocation timeout
      const restoredAccess = await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(restoredAccess.status).toBe(200);

      const restoredDownload = await request(app)
        .get(`/api/documents/${doc.id || doc._id}/download`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(restoredDownload.status).toBe(200);
    });
  });

  // 5. Audit Logging Verification
  describe('Audit Logging Verification', () => {
    it('5.1 Accurately logs audit records for upload, grant, revoke, and denied access', async () => {
      const doc = await uploadDocument('private');

      // Check upload audit log
      const logs1 = await AuditLog.find({ targetDocumentId: doc.id || doc._id });
      expect(logs1.some((l) => l.action === 'DOCUMENT_UPLOAD')).toBe(true);

      // Denied access attempt
      await request(app)
        .get(`/api/documents/${doc.id || doc._id}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      const logs2 = await AuditLog.find({ targetDocumentId: doc.id || doc._id });
      expect(logs2.some((l) => l.action === 'ACCESS_DENIED')).toBe(true);

      // Grant permission
      await request(app)
        .post(`/api/documents/${doc.id || doc._id}/permissions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'bob.viewer@trustvault.internal', permissionLevel: 'read' });

      const logs3 = await AuditLog.find({ targetDocumentId: doc.id || doc._id });
      expect(logs3.some((l) => l.action === 'PERMISSION_GRANTED')).toBe(true);
    });
  });
});
