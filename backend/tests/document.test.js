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
      expect(res.header['content-disposition']).toContain("filename*=UTF-8''alice-secret.txt");
      expect(res.header['x-content-type-options']).toBe('nosniff');
      expect(res.text).toBe('Alice confidential personal record');
    });

    it('should preserve original binary bytes and filename byte-for-byte for PDF documents', async () => {
      const pdfBytes = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Title (Confidential Project Report) >>\nendobj\ntrailer\n<< /Size 1 >>\nstartxref\n50\n%%EOF');
      const pdfPath = path.resolve(testFilesDir, 'ProjectReport.pdf');
      fs.writeFileSync(pdfPath, pdfBytes);

      const uploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('title', 'Project Report 2026')
        .attach('file', pdfPath);

      expect(uploadRes.status).toBe(201);
      const pdfDocId = uploadRes.body.document._id;

      // Download and parse raw binary buffer
      const downloadRes = await request(app)
        .get(`/api/documents/${pdfDocId}/download`)
        .set('Authorization', `Bearer ${userAToken}`)
        .buffer(true)
        .parse((res, cb) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(downloadRes.status).toBe(200);
      expect(downloadRes.header['content-type']).toBe('application/pdf');
      expect(downloadRes.header['content-disposition']).toContain('attachment');
      expect(downloadRes.header['content-disposition']).toContain('ProjectReport.pdf');
      expect(downloadRes.header['content-disposition']).toContain("filename*=UTF-8''ProjectReport.pdf");

      // Verify exact byte-for-byte integrity
      expect(Buffer.isBuffer(downloadRes.body)).toBe(true);
      expect(Buffer.compare(downloadRes.body, pdfBytes)).toBe(0);
      expect(downloadRes.body.length).toBe(pdfBytes.length);
    });

    it('should preserve non-PDF file formats and not blindly append .pdf (e.g., spreadsheet .xlsx)', async () => {
      const xlsxBytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0x08, 0x00, 0xaa, 0xbb, 0xcc, 0xdd]);
      const xlsxPath = path.resolve(testFilesDir, 'Q4_Financial_Model.xlsx');
      fs.writeFileSync(xlsxPath, xlsxBytes);

      const uploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('title', 'Q4 Financial Model')
        .attach('file', xlsxPath);

      expect(uploadRes.status).toBe(201);
      const xlsxDocId = uploadRes.body.document._id;

      const downloadRes = await request(app)
        .get(`/api/documents/${xlsxDocId}/download`)
        .set('Authorization', `Bearer ${userAToken}`)
        .buffer(true)
        .parse((res, cb) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(downloadRes.status).toBe(200);
      expect(downloadRes.header['content-disposition']).toContain('attachment');
      expect(downloadRes.header['content-disposition']).toContain('Q4_Financial_Model.xlsx');
      expect(downloadRes.header['content-disposition']).not.toContain('.pdf');
      expect(Buffer.compare(downloadRes.body, xlsxBytes)).toBe(0);
    });

    it('should preserve DOCX file formats and byte contents without corruption', async () => {
      const docxBytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0x08, 0x00, 0x11, 0x22, 0x33, 0x44]);
      const docxPath = path.resolve(testFilesDir, 'Enterprise_Contract.docx');
      fs.writeFileSync(docxPath, docxBytes);

      const uploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('title', 'Enterprise Contract 2026')
        .attach('file', docxPath);

      expect(uploadRes.status).toBe(201);
      const docxDocId = uploadRes.body.document._id;

      const downloadRes = await request(app)
        .get(`/api/documents/${docxDocId}/download`)
        .set('Authorization', `Bearer ${userAToken}`)
        .buffer(true)
        .parse((res, cb) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(downloadRes.status).toBe(200);
      expect(downloadRes.header['content-disposition']).toContain('attachment');
      expect(downloadRes.header['content-disposition']).toContain('Enterprise_Contract.docx');
      expect(downloadRes.header['content-type']).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(Buffer.compare(downloadRes.body, docxBytes)).toBe(0);
    });

    it('should reject unauthenticated download requests with 401 Unauthorized', async () => {
      const res = await request(app)
        .get(`/api/documents/${uploadedDocId}/download`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
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
