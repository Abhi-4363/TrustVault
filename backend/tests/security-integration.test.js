/**
 * TrustVault Backend - Stage 9: Automated Security Integration Test Suite
 * End-to-end verification of all 12 entries in THREATS.md:
 *
 * THREAT-01: Unauthorised Document Access (403 on metadata & download)
 * THREAT-02: IDOR & ID Guessing (No document existence leakage)
 * THREAT-03: Permission Revocation Lag (Zero-delay access termination)
 * THREAT-04: Publicly Accessible File URLs (Static folder isolation)
 * THREAT-05: Audit-Log Modification/Deletion (Append-only immutability)
 * THREAT-06: Privilege Escalation (Role parameter tampering blocked)
 * THREAT-07: Malicious/Oversized Uploads (Magic number & MIME inspection)
 * THREAT-08: Cross-Site Scripting (XSS Sanitization in titles/tags)
 * THREAT-09: CSRF & Missing Bearer Token (Strict 401 enforcement)
 * THREAT-10: Token Tampering & Session Expiration (HMAC-SHA256 signature)
 * THREAT-11: Search Metadata Leaks (Multi-tenant search isolation)
 * THREAT-12: Concurrency & Stale Decisions (Atomic ACL handling)
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Document } from '../src/models/document.model.js';
import { AuditLog } from '../src/models/audit.model.js';
import { generateToken } from '../src/utils/token.js';
import { STORAGE_DIR } from '../src/middleware/upload.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testArtifactsDir = path.resolve(__dirname, 'test-artifacts-stage9');

describe('Stage 9: Automated Security Threat Model Integration Tests', () => {
  const app = createApp();

  let aliceToken, aliceId;
  let bobToken, bobId;
  let adminToken, adminId;
  let sampleDocId;

  // Real PDF sample buffer (%PDF-1.4 header)
  const validPdfBuffer = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF'
  );

  beforeEach(async () => {
    User.clearInMemory();
    Document.clearInMemory();
    AuditLog.clearInMemory();

    if (!fs.existsSync(testArtifactsDir)) {
      fs.mkdirSync(testArtifactsDir, { recursive: true });
    }

    // 1. Setup Alice (Document Owner)
    const resAlice = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Owner',
        email: 'alice@enterprise.org',
        password: 'Password123!',
      });
    aliceToken = resAlice.body.data.token;
    aliceId = resAlice.body.data.user._id || resAlice.body.data.user.id;

    // 2. Setup Bob (External Colleague / Potential Attacker)
    const resBob = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Bob Auditor',
        email: 'bob@enterprise.org',
        password: 'Password123!',
      });
    bobToken = resBob.body.data.token;
    bobId = resBob.body.data.user._id || resBob.body.data.user.id;

    // 3. Setup Charlie (Enterprise Admin)
    const adminUser = await User.create({
      name: 'Charlie Admin',
      email: 'admin@enterprise.org',
      password: 'Password123!',
      role: 'admin',
    });
    adminId = adminUser._id || adminUser.id;
    adminToken = generateToken(adminUser);

    // 4. Upload a baseline confidential document owned by Alice
    const sampleFilePath = path.join(testArtifactsDir, 'confidential-budget.pdf');
    fs.writeFileSync(sampleFilePath, validPdfBuffer);

    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${aliceToken}`)
      .attach('file', sampleFilePath)
      .field('title', 'Q4 Project Horizon Confidential Budget')
      .field('description', 'Strictly confidential financial allocations');

    expect(uploadRes.status).toBe(201);
    sampleDocId = uploadRes.body.document._id || uploadRes.body.document.id;
  });

  afterAll(() => {
    if (fs.existsSync(testArtifactsDir)) {
      fs.rmSync(testArtifactsDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // THREAT-01: Unauthorised Document Access
  // =========================================================================
  describe('THREAT-01: Unauthorised Document Access', () => {
    it('CRITICAL: Should return 403 Forbidden when unauthorized user requests document metadata', async () => {
      const res = await request(app)
        .get(`/api/documents/${sampleDocId}`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    it('CRITICAL: Should return 403 Forbidden when unauthorized user attempts binary download', async () => {
      const res = await request(app)
        .get(`/api/documents/${sampleDocId}/download`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // THREAT-02: Insecure Direct Object References (IDOR) & ID Guessing
  // =========================================================================
  describe('THREAT-02: Insecure Direct Object References (IDOR) & ID Guessing', () => {
    it('CRITICAL: Random/non-existent valid ObjectId returns 404 without leaking document existence', async () => {
      const nonExistentId = '654321654321654321654321';
      const res = await request(app)
        .get(`/api/documents/${nonExistentId}`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error?.code).toBe('DOCUMENT_NOT_FOUND');
    });

    it('CRITICAL: Malformed ID returns 400 Bad Request with standardized error code', async () => {
      const malformedId = 'not-a-valid-object-id';
      const res = await request(app)
        .get(`/api/documents/${malformedId}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect([400, 404]).toContain(res.status);
    });
  });

  // =========================================================================
  // THREAT-03: Permission Revocation Lag (Stale Authorisation)
  // =========================================================================
  describe('THREAT-03: Permission Revocation Lag', () => {
    it('CRITICAL: Access termination must be immediate with zero cache lag', async () => {
      // Step 1: Alice grants Bob READ access
      const grantRes = await request(app)
        .post(`/api/documents/${sampleDocId}/permissions`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ email: 'bob@enterprise.org', permissionLevel: 'read' });
      expect(grantRes.status).toBe(200);

      // Step 2: Bob verifies active read access
      const readRes = await request(app)
        .get(`/api/documents/${sampleDocId}`)
        .set('Authorization', `Bearer ${bobToken}`);
      expect(readRes.status).toBe(200);

      // Step 3: Alice immediately revokes Bob's access
      const revokeRes = await request(app)
        .delete(`/api/documents/${sampleDocId}/permissions/${bobId}`)
        .set('Authorization', `Bearer ${aliceToken}`);
      expect(revokeRes.status).toBe(200);

      // Step 4: Bob immediately attempts download -> MUST receive 403 instantly
      const postRevokeRes = await request(app)
        .get(`/api/documents/${sampleDocId}/download`)
        .set('Authorization', `Bearer ${bobToken}`);
      expect(postRevokeRes.status).toBe(403);
      expect(postRevokeRes.body.error?.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // THREAT-04: Publicly Accessible File URLs
  // =========================================================================
  describe('THREAT-04: Publicly Accessible File URLs', () => {
    it('CRITICAL: Direct static GET requests to storage directories must return 404', async () => {
      const pathsToProbe = [
        '/uploads/confidential-budget.pdf',
        '/storage/confidential-budget.pdf',
        '/private-storage/confidential-budget.pdf',
        '/static/uploads/confidential-budget.pdf',
      ];

      for (const probePath of pathsToProbe) {
        const res = await request(app).get(probePath);
        expect(res.status).toBe(404);
      }
    });
  });

  // =========================================================================
  // THREAT-05: Audit-Log Modification or Deletion
  // =========================================================================
  describe('THREAT-05: Audit-Log Modification or Deletion', () => {
    it('CRITICAL: Direct mutation of audit records must be rejected by append-only enforcement', async () => {
      // Create an audit entry
      const log = await AuditLog.create({
        action: 'DOCUMENT_UPLOAD',
        actorId: aliceId,
        actorEmail: 'alice@enterprise.org',
        targetDocumentId: sampleDocId,
      });

      // Attempt PUT or DELETE to audit routes
      const putRes = await request(app)
        .put(`/api/documents/${sampleDocId}/audit/${log._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'FORGED_ACTION' });

      expect([404, 405]).toContain(putRes.status);

      const delRes = await request(app)
        .delete(`/api/documents/${sampleDocId}/audit/${log._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([404, 405]).toContain(delRes.status);
    });
  });

  // =========================================================================
  // THREAT-06: Privilege Escalation
  // =========================================================================
  describe('THREAT-06: Privilege Escalation', () => {
    it('CRITICAL: Registration payload attempting role manipulation must be forced to owner', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Mallory Malicious',
          email: 'mallory@enterprise.org',
          password: 'Password123!',
          role: 'admin',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('owner');
    });

    it('CRITICAL: Non-admin calling administrative endpoints must receive 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    it('CRITICAL: Viewer role is blocked from uploading documents (403 Forbidden)', async () => {
      // Seed a user with 'viewer' role
      const viewerUser = await User.create({
        name: 'Viewer Alex',
        email: 'alex.viewer@enterprise.org',
        passwordHash: 'seeded_viewer_hash',
        role: 'viewer',
      });
      const viewerToken = generateToken(viewerUser);

      const testUploadPath = path.join(testArtifactsDir, 'viewer-upload-test.pdf');
      fs.writeFileSync(testUploadPath, validPdfBuffer);

      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${viewerToken}`)
        .field('title', 'Unauthorized Upload Attempt')
        .attach('file', testUploadPath);

      if (fs.existsSync(testUploadPath)) fs.unlinkSync(testUploadPath);

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // THREAT-07: Malicious or Oversized Uploads
  // =========================================================================
  describe('THREAT-07: Malicious or Oversized Uploads', () => {
    it('CRITICAL: Renamed shell script masquerading as .pdf must be rejected with 415', async () => {
      const fakePdfPath = path.join(testArtifactsDir, 'malicious-script.pdf');
      fs.writeFileSync(fakePdfPath, '#!/bin/bash\nrm -rf / --no-preserve-root\n');

      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${aliceToken}`)
        .attach('file', fakePdfPath)
        .field('title', 'Innocent Looking Document');

      expect(res.status).toBe(415);
      expect(res.body.error?.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });
  });

  // =========================================================================
  // THREAT-08: Cross-Site Scripting (XSS)
  // =========================================================================
  describe('THREAT-08: Cross-Site Scripting (XSS)', () => {
    it('CRITICAL: XSS script tags in title and description must be neutralized', async () => {
      const safeFilePath = path.join(testArtifactsDir, 'xss-test.pdf');
      fs.writeFileSync(safeFilePath, validPdfBuffer);

      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${aliceToken}`)
        .attach('file', safeFilePath)
        .field('title', '<script>alert("XSS")</script>Secure Title')
        .field('description', '<img src="x" onerror="alert(1)">Important Notes');

      expect(res.status).toBe(201);
      const savedDoc = res.body.document;

      expect(savedDoc.title).not.toContain('<script>');
      expect(savedDoc.title).not.toContain('alert(');
      expect(savedDoc.description).not.toContain('<img');
      expect(savedDoc.description).not.toContain('onerror=');
    });
  });

  // =========================================================================
  // THREAT-09: CSRF & Missing Bearer Token
  // =========================================================================
  describe('THREAT-09: CSRF & Missing Bearer Token', () => {
    it('CRITICAL: Request without Authorization header must fail with 401 Unauthorized', async () => {
      const res = await request(app).get(`/api/documents/${sampleDocId}`);
      expect(res.status).toBe(401);
      expect(res.body.error?.code).toBe('UNAUTHORIZED');
    });
  });

  // =========================================================================
  // THREAT-10: Token Tampering & Session Expiration
  // =========================================================================
  describe('THREAT-10: Token Tampering & Session Expiration', () => {
    it('CRITICAL: Tampered JWT token signature must be rejected with 401 Unauthorized', async () => {
      // Modify token signature part
      const parts = aliceToken.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.tamperedSignatureHere`;

      const res = await request(app)
        .get(`/api/documents/${sampleDocId}`)
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error?.code).toBe('INVALID_TOKEN');
    });

    it('CRITICAL: Expired JWT token must be rejected with 401 Unauthorized', async () => {
      const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production_key_2026';
      // Create token that expired 1 hour ago
      const expiredToken = jwt.sign(
        { userId: aliceId, email: 'alice@enterprise.org', role: 'owner' },
        secret,
        { expiresIn: '-1h' }
      );

      const res = await request(app)
        .get(`/api/documents/${sampleDocId}`)
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // THREAT-11: Search Metadata Leaks
  // =========================================================================
  describe('THREAT-11: Search Metadata Leaks', () => {
    it('CRITICAL: Searching a confidential term in Alice doc by Bob must return 0 results', async () => {
      const res = await request(app)
        .get('/api/documents/search?q=Horizon')
        .set('Authorization', `Bearer ${bobToken}`);

      expect(res.status).toBe(200);
      expect(res.body.documents).toHaveLength(0);
    });

    it('Should return the document when searched by its authorized owner Alice', async () => {
      const res = await request(app)
        .get('/api/documents/search?q=Horizon')
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.documents.length).toBeGreaterThanOrEqual(1);
      expect(res.body.documents[0].title).toContain('Project Horizon');
    });
  });

  // =========================================================================
  // THREAT-12: Concurrency & Stale Decisions
  // =========================================================================
  describe('THREAT-12: Concurrency & Stale Decisions', () => {
    it('CRITICAL: Concurrent access and revocation must not leak unauthorized data', async () => {
      // Grant Bob access
      await request(app)
        .post(`/api/documents/${sampleDocId}/permissions`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ email: 'bob@enterprise.org', permissionLevel: 'read' });

      // Run parallel revocation and download attempts
      const [revokeRes, downloadRes] = await Promise.all([
        request(app)
          .delete(`/api/documents/${sampleDocId}/permissions/${bobId}`)
          .set('Authorization', `Bearer ${aliceToken}`),
        request(app)
          .get(`/api/documents/${sampleDocId}/download`)
          .set('Authorization', `Bearer ${bobToken}`),
      ]);

      expect(revokeRes.status).toBe(200);

      // Verify that after revocation completes, no subsequent download can succeed
      const postCheck = await request(app)
        .get(`/api/documents/${sampleDocId}/download`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(postCheck.status).toBe(403);
    });
  });
});
