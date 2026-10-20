/**
 * TrustVault Backend - Stage 6 Immutable Audit Trail Test Suite
 * Validates append-only event logging, anti-tampering guards, and authorized
 * compliance inspection.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Document } from '../src/models/document.model.js';
import { AuditLog } from '../src/models/audit.model.js';

describe('Stage 6: Audit Trail and Integrity Protection', () => {
  const app = createApp();

  let ownerToken;
  let ownerId;
  let userBToken;
  let userBId;
  let testDocId;

  const testFilesDir = path.resolve(__dirname, 'stage6-test-files');

  beforeEach(async () => {
    User.clearInMemory();
    Document.clearInMemory();
    AuditLog.clearInMemory();

    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }

    // 1. Create Owner (Alice)
    const resA = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Auditor',
        email: 'alice.auditor@vault.internal',
        password: 'Password123!',
      });
    ownerToken = resA.body.data.token;
    ownerId = resA.body.data.user._id || resA.body.data.user.id;

    // 2. Create Colleague (Bob)
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Bob Operator',
        email: 'bob.operator@vault.internal',
        password: 'Password123!',
      });
    userBToken = resB.body.data.token;
    userBId = resB.body.data.user._id || resB.body.data.user.id;

    // 3. Upload Document
    const testFilePath = path.join(testFilesDir, 'compliance-doc.pdf');
    fs.writeFileSync(testFilePath, '%PDF-1.4 Compliance ledger document');

    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('title', 'Corporate Compliance Log')
      .attach('file', testFilePath);

    testDocId = uploadRes.body.document._id;
  });

  afterAll(() => {
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }
  });

  describe('Immutable Append-Only Enforcement', () => {
    it('CRITICAL: Should throw error when attempting to update or mutate audit records', async () => {
      await expect(AuditLog.update({ action: 'MUTATED' })).rejects.toThrow(
        /append-only.*Modification.*strictly prohibited/i
      );
    });

    it('CRITICAL: Should throw error when attempting to delete audit records', async () => {
      await expect(AuditLog.delete()).rejects.toThrow(
        /append-only.*Deletion.*strictly prohibited/i
      );
    });
  });

  describe('Comprehensive Lifecycle Event Capture', () => {
    it('should record every document event with actor identity, timestamp, and action type', async () => {
      // 1. DOCUMENT_UPLOAD was recorded during beforeEach
      let logs = await AuditLog.find({ targetDocumentId: testDocId });
      expect(logs.some((l) => l.action === 'DOCUMENT_UPLOAD')).toBe(true);

      // 2. Read metadata
      await request(app)
        .get(`/api/documents/${testDocId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      // 3. Grant permission
      await request(app)
        .post(`/api/documents/${testDocId}/permissions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'bob.operator@vault.internal',
          permissionLevel: 'read',
        });

      // 4. Download document
      await request(app)
        .get(`/api/documents/${testDocId}/download`)
        .set('Authorization', `Bearer ${userBToken}`);

      // 5. Revoke permission
      await request(app)
        .delete(`/api/documents/${testDocId}/permissions/${userBId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      // Inspect recorded audit history
      const allEvents = await AuditLog.find({ targetDocumentId: testDocId });
      const actionTypes = allEvents.map((e) => e.action);

      expect(actionTypes).toContain('DOCUMENT_UPLOAD');
      expect(actionTypes).toContain('DOCUMENT_READ');
      expect(actionTypes).toContain('PERMISSION_GRANTED');
      expect(actionTypes).toContain('DOCUMENT_DOWNLOAD');
      expect(actionTypes).toContain('PERMISSION_REVOKED');

      // Verify actor identities are recorded correctly
      const downloadLog = allEvents.find((e) => e.action === 'DOCUMENT_DOWNLOAD');
      expect(downloadLog.actorEmail).toBe('bob.operator@vault.internal');
      expect(downloadLog.ipAddress).toBeDefined();
      expect(downloadLog.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Audit Query Endpoint Access Control', () => {
    it('should allow document owner to inspect document audit trail', async () => {
      const res = await request(app)
        .get(`/api/documents/${testDocId}/audit`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.documentId).toBe(testDocId);
      expect(res.body.auditLogs).toBeInstanceOf(Array);
      expect(res.body.auditLogs.length).toBeGreaterThan(0);
    });

    it('should reject unauthorized user attempting to inspect audit trail with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/documents/${testDocId}/audit`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should retrieve recent audit activities across user documents', async () => {
      const res = await request(app)
        .get('/api/documents/audit/activity')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.activities).toBeInstanceOf(Array);
      expect(res.body.activities.length).toBeGreaterThan(0);
    });
  });
});
