/**
 * TrustVault Backend - Stage 5 Immediate Revocation Engine Test Suite
 * Validates zero-lag access revocation, cache invalidation, and prevention
 * of unauthorized requests across multiple concurrent operations.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Document } from '../src/models/document.model.js';
import { clearRevocationCache } from '../src/services/revocation.service.js';

describe('Stage 5: Immediate Revocation Engine', () => {
  const app = createApp();

  let ownerToken;
  let ownerId;
  let bobToken;
  let bobId;
  let testDocId;

  const testFilesDir = path.resolve(__dirname, 'stage5-test-files');

  beforeEach(async () => {
    User.clearInMemory();
    Document.clearInMemory();
    clearRevocationCache();

    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }

    // 1. Register Owner (Alice)
    const resA = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Owner',
        email: 'alice.sec@company.com',
        password: 'Password123!',
      });
    ownerToken = resA.body.data.token;
    ownerId = resA.body.data.user._id || resA.body.data.user.id;

    // 2. Register Colleague (Bob)
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Bob Colleague',
        email: 'bob.sec@company.com',
        password: 'Password123!',
      });
    bobToken = resB.body.data.token;
    bobId = resB.body.data.user._id || resB.body.data.user.id;

    // 3. Upload Document
    const testFilePath = path.join(testFilesDir, 'vault-secrets.txt');
    fs.writeFileSync(testFilePath, 'Critical enterprise vault binary content');

    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('title', 'Zero-Trust Protocol Documentation')
      .attach('file', testFilePath);

    testDocId = uploadRes.body.document._id;
  });

  afterAll(() => {
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }
  });

  it('should immediately terminate streaming access when revoked during active usage', async () => {
    // 1. Grant read access to Bob
    await request(app)
      .post(`/api/documents/${testDocId}/permissions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: 'bob.sec@company.com',
        permissionLevel: 'read',
      });

    // 2. Bob downloads successfully
    const firstDownload = await request(app)
      .get(`/api/documents/${testDocId}/download`)
      .set('Authorization', `Bearer ${bobToken}`);
    expect(firstDownload.status).toBe(200);

    // 3. Owner revokes access
    const revokeRes = await request(app)
      .delete(`/api/documents/${testDocId}/permissions/${bobId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(revokeRes.status).toBe(200);

    // 4. Bob immediately tries to download again - MUST be rejected with 403 Forbidden
    const subsequentDownload = await request(app)
      .get(`/api/documents/${testDocId}/download`)
      .set('Authorization', `Bearer ${bobToken}`);
    expect(subsequentDownload.status).toBe(403);
    expect(subsequentDownload.body.error.code).toBe('FORBIDDEN');
  });

  it('should immediately reject concurrent requests upon revocation without token lag', async () => {
    // Grant access
    await request(app)
      .post(`/api/documents/${testDocId}/permissions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: 'bob.sec@company.com',
        permissionLevel: 'read',
      });

    // Revoke access
    await request(app)
      .delete(`/api/documents/${testDocId}/permissions/${bobId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    // Execute 5 rapid parallel requests from Bob
    const parallelRequests = await Promise.all([
      request(app).get(`/api/documents/${testDocId}`).set('Authorization', `Bearer ${bobToken}`),
      request(app).get(`/api/documents/${testDocId}/download`).set('Authorization', `Bearer ${bobToken}`),
      request(app).patch(`/api/documents/${testDocId}`).set('Authorization', `Bearer ${bobToken}`).send({ title: 'Hack' }),
      request(app).get(`/api/documents/${testDocId}`).set('Authorization', `Bearer ${bobToken}`),
      request(app).get(`/api/documents/${testDocId}/download`).set('Authorization', `Bearer ${bobToken}`),
    ]);

    // 100% of parallel requests must be rejected with 403 Forbidden
    for (const res of parallelRequests) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });
});
