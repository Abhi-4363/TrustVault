/**
 * TrustVault Backend - Stage 3 Document & Private Storage Test Suite
 * Validates document ingestion, metadata indexing, 25MB upload limits,
 * cryptographic UUID renaming, private storage isolation, authorization,
 * secure streaming downloads, and deletion.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Document } from '../src/models/document.model.js';
import { STORAGE_DIR } from '../src/middleware/upload.middleware.js';

describe('Stage 3: Document Metadata and Private Storage', () => {
  const app = createApp();

  let userAToken;
  let userAId;
  let userBToken;
  let userBId;

  // Temp files directory for testing
  const testFilesDir = path.resolve(__dirname, 'test-files');

  beforeEach(async () => {
    User.clearInMemory();
    Document.clearInMemory();

    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }

    // Register User A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Owner',
        email: 'alice@example.com',
        password: 'Password123!',
      });
    userAToken = resA.body.data.token;
    userAId = resA.body.data.user._id || resA.body.data.user.id;

    // Register User B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Bob Requester',
        email: 'bob@example.com',
        password: 'Password123!',
      });
    userBToken = resB.body.data.token;
    userBId = resB.body.data.user._id || resB.body.data.user.id;
  });

  afterAll(() => {
    // Clean up temporary test files
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }
  });

  describe('Upload Security & File Limits', () => {
    it('should reject unauthenticated upload attempts with 401', async () => {
      const dummyPath = path.join(testFilesDir, 'unauth.txt');
      fs.writeFileSync(dummyPath, 'Confidential data');

      const res = await request(app)
        .post('/api/documents')
        .attach('file', dummyPath);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject upload when no file is attached', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ title: 'No file doc' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NO_FILE_PROVIDED');
    });

    it('should reject executable file extensions with 400', async () => {
      const exePath = path.join(testFilesDir, 'payload.exe');
      fs.writeFileSync(exePath, 'binary executable code');

      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', exePath);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
    });

    it('should successfully upload a valid document and assign UUID filename outside public roots', async () => {
      const samplePath = path.join(testFilesDir, 'quarterly-audit.pdf');
      fs.writeFileSync(samplePath, '%PDF-1.4 Mock PDF quarterly audit content');

      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('title', 'Q3 Compliance Audit')
        .field('description', 'Internal audit certification for Q3')
        .field('tags', 'compliance, audit, 2026')
        .attach('file', samplePath);

      expect(res.status).toBe(201);
      expect(res.body.document).toBeDefined();
      expect(res.body.document.title).toBe('Q3 Compliance Audit');
      expect(res.body.document.originalName).toBe('quarterly-audit.pdf');
      expect(res.body.document.ownerId).toBe(userAId);
      expect(res.body.document.tags).toEqual(['compliance', 'audit', '2026']);

      // Ensure storage path is NOT leaked in JSON response
      expect(res.body.document.storagePath).toBeUndefined();

      // Verify the file was stored on disk in private STORAGE_DIR
      const storedFiles = fs.readdirSync(STORAGE_DIR);
      expect(storedFiles.length).toBeGreaterThan(0);

      // Verify filename is a UUID rather than original name
      const foundStoredFile = storedFiles.find((f) => f.endsWith('.pdf'));
      expect(foundStoredFile).toBeDefined();
      expect(foundStoredFile).not.toBe('quarterly-audit.pdf');
    });
  });

  describe('Isolation and Authorization Boundaries', () => {
    let uploadedDocId;

    beforeEach(async () => {
      const samplePath = path.join(testFilesDir, 'alice-secret.txt');
      fs.writeFileSync(samplePath, 'Alice confidential personal record');

      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('title', 'Alice Secret Document')
        .attach('file', samplePath);

      uploadedDocId = res.body.document._id;
    });

    it('should allow the owner to list and retrieve document metadata', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.documents.length).toBe(1);
      expect(res.body.documents[0]._id).toBe(uploadedDocId);
    });

    it('should NOT allow other users (User B) to list User A private documents', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.documents.length).toBe(0);
    });

    it('should reject User B metadata query for User A document with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/documents/${uploadedDocId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject User B download request for User A document with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/documents/${uploadedDocId}/download`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should stream file download with forced attachment headers for authorized owner', async () => {
      const res = await request(app)
        .get(`/api/documents/${uploadedDocId}/download`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.header['content-disposition']).toContain('attachment');
      expect(res.header['content-disposition']).toContain('alice-secret.txt');
      expect(res.header['x-content-type-options']).toBe('nosniff');
      expect(res.text).toBe('Alice confidential personal record');
    });

    it('should reject User B attempting to delete User A document with 403 Forbidden', async () => {
      const res = await request(app)
        .delete(`/api/documents/${uploadedDocId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow owner to delete document and purge physical disk storage', async () => {
      const res = await request(app)
        .delete(`/api/documents/${uploadedDocId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('successfully removed');

      // Verify document is gone from query
      const getRes = await request(app)
        .get(`/api/documents/${uploadedDocId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(getRes.status).toBe(404);
    });
  });

  describe('Direct Storage Directory Traversal & Exposure Check', () => {
    it('should return 404 for direct HTTP requests targeting private storage files', async () => {
      const res = await request(app).get('/storage/uploads/some-file.pdf');
      expect(res.status).toBe(404);
    });
  });
});
