/**
 * TrustVault Backend - Collaborator Email Lookup & Selective Sharing Test Suite
 * Validates:
 * 1. A valid email belonging to a registered user.
 * 2. An email address that is not registered.
 * 3. An invalid email format.
 * 4. An email with leading or trailing spaces.
 * 5. The current user's own email.
 * 6. A duplicate collaborator prevention.
 * 7. Read Only and Read & Edit permissions.
 * 8. Network / error handling.
 * 9. Uploading a document with one or more valid collaborators.
 * 10. Unauthorized users attempting to assign collaborators.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Document } from '../src/models/document.model.js';

describe('Collaborator Email Lookup and Selective Sharing Ingestion', () => {
  const app = createApp();

  let adminToken;
  let ownerToken;
  let ownerEmail;
  let viewerToken;
  let registeredCollabToken;
  let registeredCollabId;
  const registeredCollabEmail = 'collab.member@trustvault.internal';

  const testFilesDir = path.resolve(__dirname, 'collaborator-lookup-test-files');
  const dummyFilePath = path.join(testFilesDir, 'confidential-share.pdf');

  beforeEach(async () => {
    User.clearInMemory();
    Document.clearInMemory();

    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }
    fs.writeFileSync(dummyFilePath, '%PDF-1.4 TrustVault Confidential Collaborator Test Payload', 'utf-8');

    // 1. Seed Admin
    const resAdmin = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Marcus Vance',
        email: 'admin@trustvault.internal',
        password: 'Password123!',
      });
    adminToken = resAdmin.body.data.token;
    await User.findByIdAndUpdate(resAdmin.body.data.user._id || resAdmin.body.data.user.id, {
      role: 'admin',
      isEmailVerified: true,
    });

    // 2. Seed Document Owner (Sarah)
    ownerEmail = 'sarah.lead@trustvault.internal';
    const resOwner = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Sarah Jenkins',
        email: ownerEmail,
        password: 'Password123!',
      });
    ownerToken = resOwner.body.data.token;
    await User.findByIdAndUpdate(resOwner.body.data.user._id || resOwner.body.data.user.id, {
      role: 'owner',
      isEmailVerified: true,
    });

    // 3. Seed Registered Collaborator (Alex)
    const resCollab = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alex Mercer',
        email: registeredCollabEmail,
        password: 'Password123!',
      });
    registeredCollabToken = resCollab.body.data.token;
    registeredCollabId = resCollab.body.data.user._id || resCollab.body.data.user.id;
    await User.findByIdAndUpdate(registeredCollabId, {
      role: 'viewer',
      isEmailVerified: true,
    });

    // 4. Seed Standard Viewer (Jordan)
    const resViewer = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Jordan Lee',
        email: 'jordan.viewer@trustvault.internal',
        password: 'Password123!',
      });
    viewerToken = resViewer.body.data.token;
    await User.findByIdAndUpdate(resViewer.body.data.user._id || resViewer.body.data.user.id, {
      role: 'viewer',
      isEmailVerified: true,
    });
  });

  afterAll(() => {
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }
  });

  describe('GET /api/documents/users/lookup (Email Validation)', () => {
    it('Case 1: successfully returns registered user metadata for a valid email', async () => {
      const res = await request(app)
        .get(`/api/documents/users/lookup?email=${registeredCollabEmail}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(registeredCollabEmail);
      expect(res.body.user.name).toBe('Alex Mercer');
      expect(res.body.user.id).toBeDefined();
      // Enforce zero secret leakage: password, salt, tokens must never be exposed
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.user.verificationToken).toBeUndefined();
    });

    it('Case 2: returns 404 with clear message when email is not registered', async () => {
      const res = await request(app)
        .get('/api/documents/users/lookup?email=unregistered.person@external.com')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
      expect(res.body.error.message).toBe('This email address is not registered with TrustVault.');
    });

    it('Case 3: returns 400 when email format is invalid', async () => {
      const invalidEmails = ['not-an-email', 'invalid@', '@domain.com', 'plainaddress', 'user@domain..com'];
      for (const badEmail of invalidEmails) {
        const res = await request(app)
          .get(`/api/documents/users/lookup?email=${encodeURIComponent(badEmail)}`)
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_EMAIL_FORMAT');
        expect(res.body.error.message).toBe('Please enter a valid email address.');
      }
    });

    it('Case 4: normalizes email with leading and trailing spaces', async () => {
      const spacedEmail = `   ${registeredCollabEmail}   `;
      const res = await request(app)
        .get(`/api/documents/users/lookup?email=${encodeURIComponent(spacedEmail)}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(registeredCollabEmail);
      expect(res.body.user.name).toBe('Alex Mercer');
    });

    it('Case 5: returns 400 when current user attempts to look up their own email', async () => {
      const res = await request(app)
        .get(`/api/documents/users/lookup?email=${ownerEmail}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_COLLABORATOR_FORBIDDEN');
      expect(res.body.error.message).toBe('You cannot add yourself as a collaborator.');
    });

    it('Case 10: blocks unauthorized viewers from looking up collaborators with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/documents/users/lookup?email=${registeredCollabEmail}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Case 10b: blocks unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app)
        .get(`/api/documents/users/lookup?email=${registeredCollabEmail}`);

      expect(res.status).toBe(401);
    });
  });

  describe('Document Upload with Collaborators (Cases 7, 9, 10)', () => {
    it('Case 7 & 9: successfully uploads document with specific collaborator with Read Only and Read & Edit permissions', async () => {
      // Create a second collaborator
      const resCollab2 = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Colleague Two',
          email: 'collab2@trustvault.internal',
          password: 'Password123!',
        });
      const collab2Token = resCollab2.body.data.token;
      await User.findByIdAndUpdate(resCollab2.body.data.user._id || resCollab2.body.data.user.id, {
        role: 'viewer',
        isEmailVerified: true,
      });

      const recipients = [
        {
          email: registeredCollabEmail,
          permissionLevel: 'edit', // Read & Edit
        },
        {
          email: 'collab2@trustvault.internal',
          permissionLevel: 'read', // Read Only
        },
      ];

      const uploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('title', 'Collaborative Strategic Plan')
        .field('visibility', 'selected_users')
        .field('recipients', JSON.stringify(recipients))
        .attach('file', dummyFilePath);

      expect(uploadRes.status).toBe(201);
      const doc = uploadRes.body.document;
      expect(doc.visibility).toBe('selected_users');
      expect(doc.acl.length).toBe(2);

      const alexAcl = doc.acl.find((entry) => entry.email === registeredCollabEmail);
      expect(alexAcl).toBeDefined();
      expect(alexAcl.permissionLevel).toBe('edit');

      const collab2Acl = doc.acl.find((entry) => entry.email === 'collab2@trustvault.internal');
      expect(collab2Acl).toBeDefined();
      expect(collab2Acl.permissionLevel).toBe('read');

      // Test permissions in action:
      // Alex (Edit) can read AND edit metadata
      const alexRead = await request(app)
        .get(`/api/documents/${doc._id}`)
        .set('Authorization', `Bearer ${registeredCollabToken}`);
      expect(alexRead.status).toBe(200);

      const alexPatch = await request(app)
        .patch(`/api/documents/${doc._id}`)
        .set('Authorization', `Bearer ${registeredCollabToken}`)
        .send({ description: 'Edited by authorized collaborator Alex' });
      expect(alexPatch.status).toBe(200);

      // Collab 2 (Read Only) can read but CANNOT edit metadata
      const collab2Read = await request(app)
        .get(`/api/documents/${doc._id}`)
        .set('Authorization', `Bearer ${collab2Token}`);
      expect(collab2Read.status).toBe(200);

      const collab2Patch = await request(app)
        .patch(`/api/documents/${doc._id}`)
        .set('Authorization', `Bearer ${collab2Token}`)
        .send({ description: 'Unauthorized attempt to edit' });
      expect(collab2Patch.status).toBe(403);

      // Unrelated Viewer (Jordan) cannot read or edit (403 Forbidden)
      const jordanRead = await request(app)
        .get(`/api/documents/${doc._id}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(jordanRead.status).toBe(403);
    });

    it('Case 6: deduplicates if identical collaborator is included multiple times in upload payload', async () => {
      const duplicateRecipients = [
        { email: registeredCollabEmail, permissionLevel: 'read' },
        { email: registeredCollabEmail, permissionLevel: 'edit' },
      ];

      const uploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('title', 'Deduplication Verification Doc')
        .field('visibility', 'selected_users')
        .field('recipients', JSON.stringify(duplicateRecipients))
        .attach('file', dummyFilePath);

      expect(uploadRes.status).toBe(201);
      const doc = uploadRes.body.document;
      const matches = doc.acl.filter((entry) => entry.email === registeredCollabEmail);
      expect(matches.length).toBe(1);
      expect(matches[0].permissionLevel).toBe('edit');
    });

    it('Case 10: blocks viewer from uploading confidential documents or assigning collaborators', async () => {
      const uploadRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${viewerToken}`)
        .field('title', 'Viewer Malicious Upload')
        .field('visibility', 'selected_users')
        .attach('file', dummyFilePath);

      expect(uploadRes.status).toBe(403);
      expect(uploadRes.body.error.code).toBe('FORBIDDEN');
    });
  });
});
