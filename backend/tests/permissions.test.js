/**
 * TrustVault Backend - Stage 4 Granular ACL & Permissions Test Suite
 * Validates Per-Document Read and Edit Permissions, access delegation,
 * privilege escalation prevention, and real-time permission enforcement.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Document } from '../src/models/document.model.js';

describe('Stage 4: Per-Document Read and Edit Permissions', () => {
  const app = createApp();

  let ownerToken;
  let ownerId;
  let readerToken;
  let readerId;
  let outsiderToken;
  let outsiderId;
  let testDocId;

  const testFilesDir = path.resolve(__dirname, 'stage4-test-files');

  beforeEach(async () => {
    User.clearInMemory();
    Document.clearInMemory();

    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }

    // 1. Create Document Owner (Alice)
    const resOwner = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Owner',
        email: 'alice@trustvault.internal',
        password: 'Password123!',
      });
    ownerToken = resOwner.body.data.token;
    ownerId = resOwner.body.data.user._id || resOwner.body.data.user.id;

    // 2. Create Colleague (Bob)
    const resReader = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Bob Colleague',
        email: 'bob@trustvault.internal',
        password: 'Password123!',
      });
    readerToken = resReader.body.data.token;
    readerId = resReader.body.data.user._id || resReader.body.data.user.id;

    // 3. Create Outsider (Charlie)
    const resOutsider = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Charlie Outsider',
        email: 'charlie@trustvault.internal',
        password: 'Password123!',
      });
    outsiderToken = resOutsider.body.data.token;
    outsiderId = resOutsider.body.data.user._id || resOutsider.body.data.user.id;

    // 4. Upload a confidential document owned by Alice
    const sampleFilePath = path.join(testFilesDir, 'financial-forecast.pdf');
    fs.writeFileSync(sampleFilePath, '%PDF-1.4 Confidential corporate forecast figures');

    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('title', '2026 Strategic Plan')
      .field('description', 'Confidential executive roadmap')
      .attach('file', sampleFilePath);

    testDocId = uploadRes.body.document._id;
  });

  afterAll(() => {
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }
  });

  describe('Unshared Document Isolation', () => {
    it('should strictly exclude unshared document from Bob and Charlie document lists', async () => {
      const resBob = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${readerToken}`);

      expect(resBob.status).toBe(200);
      expect(resBob.body.documents.length).toBe(0);

      const resCharlie = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(resCharlie.status).toBe(200);
      expect(resCharlie.body.documents.length).toBe(0);
    });

    it('should deny Bob metadata access with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/documents/${testDocId}`)
        .set('Authorization', `Bearer ${readerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should deny Bob binary download with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/documents/${testDocId}/download`)
        .set('Authorization', `Bearer ${readerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Granting READ Permission', () => {
    beforeEach(async () => {
      // Owner grants READ permission to Bob
      const grantRes = await request(app)
        .post(`/api/documents/${testDocId}/permissions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'bob@trustvault.internal',
          permissionLevel: 'read',
        });

      expect(grantRes.status).toBe(200);
      expect(grantRes.body.acl.length).toBe(1);
      expect(grantRes.body.acl[0].permissionLevel).toBe('read');
    });

    it('should now allow Bob to view document in document list with Reader access level', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${readerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.documents.length).toBe(1);
      expect(res.body.documents[0]._id).toBe(testDocId);
      expect(res.body.documents[0].accessLevel).toBe('Reader');
    });

    it('should allow Bob to view document metadata and download stream', async () => {
      const metaRes = await request(app)
        .get(`/api/documents/${testDocId}`)
        .set('Authorization', `Bearer ${readerToken}`);

      expect(metaRes.status).toBe(200);
      expect(metaRes.body.document.title).toBe('2026 Strategic Plan');

      const downloadRes = await request(app)
        .get(`/api/documents/${testDocId}/download`)
        .set('Authorization', `Bearer ${readerToken}`);

      expect(downloadRes.status).toBe(200);
      const content = downloadRes.text || (downloadRes.body ? downloadRes.body.toString() : '');
      expect(content).toContain('Confidential corporate forecast figures');
    });

    it('CRITICAL: User with READ permission MUST be blocked from editing metadata (403 Forbidden)', async () => {
      const patchRes = await request(app)
        .patch(`/api/documents/${testDocId}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .send({
          title: 'Tampered Title by Reader',
        });

      expect(patchRes.status).toBe(403);
      expect(patchRes.body.error.code).toBe('FORBIDDEN');
    });

    it('CRITICAL: User with READ permission MUST be blocked from deleting the document (403 Forbidden)', async () => {
      const delRes = await request(app)
        .delete(`/api/documents/${testDocId}`)
        .set('Authorization', `Bearer ${readerToken}`);

      expect(delRes.status).toBe(403);
      expect(delRes.body.error.code).toBe('FORBIDDEN');
    });

    it('CRITICAL: User with READ permission MUST NOT be allowed to grant permissions to others (403 Forbidden)', async () => {
      const grantRes = await request(app)
        .post(`/api/documents/${testDocId}/permissions`)
        .set('Authorization', `Bearer ${readerToken}`)
        .send({
          email: 'charlie@trustvault.internal',
          permissionLevel: 'read',
        });

      expect(grantRes.status).toBe(403);
      expect(grantRes.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Granting and Exercising EDIT Permission', () => {
    it('should allow Owner to elevate Bob to EDIT permission and permit metadata updates', async () => {
      // Grant edit permission
      const grantRes = await request(app)
        .post(`/api/documents/${testDocId}/permissions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'bob@trustvault.internal',
          permissionLevel: 'edit',
        });

      expect(grantRes.status).toBe(200);
      expect(grantRes.body.acl[0].permissionLevel).toBe('edit');

      // Bob updates document metadata
      const patchRes = await request(app)
        .patch(`/api/documents/${testDocId}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .send({
          title: '2026 Strategic Plan (Reviewed by Bob)',
          description: 'Updated with Q3 revenue projections',
          tags: ['strategy', 'reviewed', '2026'],
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.document.title).toBe('2026 Strategic Plan (Reviewed by Bob)');
      expect(patchRes.body.document.description).toBe('Updated with Q3 revenue projections');
      expect(patchRes.body.document.tags).toEqual(['strategy', 'reviewed', '2026']);
    });
  });

  describe('Immediate Revocation of Permissions', () => {
    it('should immediately terminate all access when permission is revoked by Owner', async () => {
      // 1. Grant read access
      await request(app)
        .post(`/api/documents/${testDocId}/permissions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'bob@trustvault.internal',
          permissionLevel: 'read',
        });

      // Verify Bob can read
      const checkBefore = await request(app)
        .get(`/api/documents/${testDocId}`)
        .set('Authorization', `Bearer ${readerToken}`);
      expect(checkBefore.status).toBe(200);

      // 2. Owner revokes Bob's access
      const revokeRes = await request(app)
        .delete(`/api/documents/${testDocId}/permissions/${readerId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.message).toContain('revoked');

      // 3. Immediately verify Bob receives 403 Forbidden without caching lag
      const metaAfter = await request(app)
        .get(`/api/documents/${testDocId}`)
        .set('Authorization', `Bearer ${readerToken}`);
      expect(metaAfter.status).toBe(403);
      expect(metaAfter.body.error.code).toBe('FORBIDDEN');

      const downloadAfter = await request(app)
        .get(`/api/documents/${testDocId}/download`)
        .set('Authorization', `Bearer ${readerToken}`);
      expect(downloadAfter.status).toBe(403);
      expect(downloadAfter.body.error.code).toBe('FORBIDDEN');

      // Bob's document list must now be empty
      const listAfter = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${readerToken}`);
      expect(listAfter.status).toBe(200);
      expect(listAfter.body.documents.length).toBe(0);
    });
  });

  describe('User Directory for Collaborator Sharing', () => {
    it('should return known users for collaborator picker excluding self', async () => {
      const res = await request(app)
        .get('/api/documents/users/directory')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.users).toBeDefined();
      expect(res.body.users.length).toBe(2); // Bob and Charlie
      const emails = res.body.users.map((u) => u.email);
      expect(emails).toContain('bob@trustvault.internal');
      expect(emails).toContain('charlie@trustvault.internal');
      expect(emails).not.toContain('alice@trustvault.internal');
    });
  });

  describe('Cross-Account Sharing and Owner Attribution', () => {
    it('should correctly attribute document owner and Reader access level when shared with a second account', async () => {
      // 1. User 1 registers and uploads document
      const resUser1 = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Abhiram Kondagalla',
          email: 'abhiram.kondagalla604@gmail.com',
          password: 'Password123!',
        });
      expect(resUser1.status).toBe(201);
      const tokenUser1 = resUser1.body.data.token;

      const samplePdfPath = path.join(testFilesDir, 'cross-share-doc.pdf');
      fs.writeFileSync(samplePdfPath, '%PDF-1.4 confidential cross share document');

      const uploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .field('title', 'Confidential Project Brief')
        .field('description', 'Owned by abhiram.kondagalla604')
        .attach('file', samplePdfPath);
      expect(uploadRes.status).toBe(201);
      const docId = uploadRes.body.document._id;

      // 2. User 2 registers
      const resUser2 = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Kondagalla Abhiram',
          email: 'kondagalla.abhiram@gmail.com',
          password: 'Password123!',
        });
      expect(resUser2.status).toBe(201);
      const tokenUser2 = resUser2.body.data.token;

      // 3. User 1 shares document with User 2
      const shareRes = await request(app)
        .post(`/api/documents/${docId}/permissions`)
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send({
          email: 'kondagalla.abhiram@gmail.com',
          permissionLevel: 'read',
        });
      expect(shareRes.status).toBe(200);

      // 4. User 2 requests document collection
      const listResUser2 = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${tokenUser2}`);

      expect(listResUser2.status).toBe(200);
      expect(listResUser2.body.documents.length).toBe(1);

      const sharedDoc = listResUser2.body.documents[0];
      expect(sharedDoc._id).toBe(docId);
      // Access level MUST be Reader (Viewer), NOT Owner!
      expect(sharedDoc.accessLevel).toBe('Reader');
      // Owner MUST be User 1 (abhiram.kondagalla604@gmail.com), NOT User 2!
      expect(sharedDoc.owner).toBeDefined();
      expect(sharedDoc.owner.email).toBe('abhiram.kondagalla604@gmail.com');
      expect(sharedDoc.owner.name).toBe('Abhiram Kondagalla');

      // 5. User 2 downloads the shared document
      const downloadRes = await request(app)
        .get(`/api/documents/${docId}/download`)
        .set('Authorization', `Bearer ${tokenUser2}`);

      expect(downloadRes.status).toBe(200);
      expect(downloadRes.header['content-disposition']).toContain('attachment');
      expect(downloadRes.header['content-disposition']).toContain('cross-share-doc.pdf');
      expect(downloadRes.header['x-content-type-options']).toBe('nosniff');
      const text = downloadRes.text || (downloadRes.body ? downloadRes.body.toString() : '');
      expect(text).toContain('confidential cross share document');
    });
  });

  describe('Comprehensive End-to-End Shared with Me and Edit Permission Workflow', () => {
    let docId;
    let viewRecipientToken;
    let editRecipientToken;
    let editRecipientId;

    beforeEach(async () => {
      // Create View Recipient (Dan)
      const resDan = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Dan Viewer',
          email: 'dan.viewer@trustvault.internal',
          password: 'Password123!',
        });
      viewRecipientToken = resDan.body.data.token;

      // Create Edit Recipient (Eva)
      const resEva = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Eva Editor',
          email: 'eva.editor@trustvault.internal',
          password: 'Password123!',
        });
      editRecipientToken = resEva.body.data.token;
      editRecipientId = resEva.body.data.user._id || resEva.body.data.user.id;

      // Alice uploads a new test document
      const samplePath = path.join(testFilesDir, 'quarterly-budget.pdf');
      fs.writeFileSync(samplePath, '%PDF-1.4 Q1 Budget Allocations');

      const uploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('title', 'Q1 Financial Budget')
        .field('description', 'Initial budget proposal for Q1')
        .attach('file', samplePath);

      docId = uploadRes.body.document._id;
    });

    it('1-4: Owner shares with View permission (accepting "view" alias); View recipient sees doc as Reader, can download, but cannot edit', async () => {
      // 1. Owner shares with permissionLevel: 'view'
      const shareRes = await request(app)
        .post(`/api/documents/${docId}/permissions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'dan.viewer@trustvault.internal',
          permissionLevel: 'view',
        });
      expect(shareRes.status).toBe(200);

      // 2. Dan sees document under shared documents list with 'Reader' access level
      const listRes = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${viewRecipientToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.documents.length).toBe(1);
      expect(listRes.body.documents[0].accessLevel).toBe('Reader');

      // 3. Dan can read metadata and download
      const readRes = await request(app)
        .get(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${viewRecipientToken}`);
      expect(readRes.status).toBe(200);

      const downloadRes = await request(app)
        .get(`/api/documents/${docId}/download`)
        .set('Authorization', `Bearer ${viewRecipientToken}`);
      expect(downloadRes.status).toBe(200);

      // 4. Dan CANNOT edit metadata (403 Forbidden)
      const editRes = await request(app)
        .patch(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${viewRecipientToken}`)
        .send({ title: 'Tampered by Viewer' });
      expect(editRes.status).toBe(403);
      expect(editRes.body.error.code).toBe('FORBIDDEN');
    });

    it('5-7: Owner shares with Edit permission; recipient sees Editor label, can edit title/description/tags, and changes persist', async () => {
      // 5. Owner shares with Edit permission
      const shareRes = await request(app)
        .post(`/api/documents/${docId}/permissions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'eva.editor@trustvault.internal',
          permissionLevel: 'edit',
        });
      expect(shareRes.status).toBe(200);

      // 6. Eva sees document in Shared with Me with Editor access level
      const listRes = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${editRecipientToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.documents.length).toBe(1);
      expect(listRes.body.documents[0].accessLevel).toBe('Editor');

      // 7. Eva can update supported metadata
      const patchRes = await request(app)
        .patch(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${editRecipientToken}`)
        .send({
          title: 'Q1 Financial Budget (Approved by Eva)',
          description: 'Revised executive allocation for Q1 operations',
          tags: ['budget', 'q1', 'approved'],
        });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.document.title).toBe('Q1 Financial Budget (Approved by Eva)');
      expect(patchRes.body.document.description).toBe('Revised executive allocation for Q1 operations');
      expect(patchRes.body.document.tags).toEqual(['budget', 'q1', 'approved']);

      // Verify retrieval returns persisted changes
      const getRes = await request(app)
        .get(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${editRecipientToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.document.title).toBe('Q1 Financial Budget (Approved by Eva)');
    });

    it('8: Unrelated users cannot see or edit the document', async () => {
      // Share with Eva only
      await request(app)
        .post(`/api/documents/${docId}/permissions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'eva.editor@trustvault.internal', permissionLevel: 'edit' });

      // Charlie (outsider) requests document list
      const listRes = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${outsiderToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.documents.length).toBe(0);

      // Charlie attempts direct edit
      const editRes = await request(app)
        .patch(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ title: 'Hacked by Outsider' });
      expect(editRes.status).toBe(403);
    });

    it('9-10: Revoking Edit permission immediately prevents edits; re-granting View removes edit capability', async () => {
      // Grant edit permission
      await request(app)
        .post(`/api/documents/${docId}/permissions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'eva.editor@trustvault.internal', permissionLevel: 'edit' });

      // Eva verifies she can edit
      const edit1 = await request(app)
        .patch(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${editRecipientToken}`)
        .send({ title: 'Edit Pass 1' });
      expect(edit1.status).toBe(200);

      // 9. Revoke permission
      const revokeRes = await request(app)
        .delete(`/api/documents/${docId}/permissions/${editRecipientId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(revokeRes.status).toBe(200);

      // Immediately assert subsequent edit fails with 403
      const editAfterRevoke = await request(app)
        .patch(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${editRecipientToken}`)
        .send({ title: 'Edit After Revocation' });
      expect(editAfterRevoke.status).toBe(403);

      // 10. Re-grant VIEW permission (downgrading from previous Edit)
      const regrantRes = await request(app)
        .post(`/api/documents/${docId}/permissions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'eva.editor@trustvault.internal', permissionLevel: 'read' });
      expect(regrantRes.status).toBe(200);

      // Subsequent edit attempt MUST be blocked with 403
      const editAsViewer = await request(app)
        .patch(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${editRecipientToken}`)
        .send({ title: 'Attempted Edit as Viewer' });
      expect(editAsViewer.status).toBe(403);
    });

    it('11-13: Unauthenticated requests are rejected, audit trail records successful/denied attempts, and Owner/Admin retain control', async () => {
      // 11. Unauthenticated PATCH is rejected with 401
      const unauthRes = await request(app)
        .patch(`/api/documents/${docId}`)
        .send({ title: 'Unauthenticated Title' });
      expect(unauthRes.status).toBe(401);

      // 12. Denied attempt records ACCESS_DENIED audit log
      await request(app)
        .patch(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ title: 'Forbidden Attempt' });

      const auditRes = await request(app)
        .get(`/api/documents/${docId}/audit`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(auditRes.status).toBe(200);
      const deniedEvent = auditRes.body.auditLogs.find((l) => l.action === 'ACCESS_DENIED');
      expect(deniedEvent).toBeDefined();

      // 13. Owner can edit document metadata directly
      const ownerEdit = await request(app)
        .patch(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Owner Updated Title' });
      expect(ownerEdit.status).toBe(200);
      expect(ownerEdit.body.document.title).toBe('Owner Updated Title');
    });
  });
});

