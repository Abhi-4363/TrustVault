/**
 * TrustVault Backend - Registration & Profile Enhancement Test Suite
 * Tests end-to-end:
 * 1. Sign-Up enhancements (Name, Email, Password, Confirm Password, DOB, Terms acceptance)
 * 2. Date of Birth validation, future date checks, leap year handling, and minimum-age policy (age >= 13)
 * 3. Terms & Conditions acceptance validation, versioning, and server-generated timestamps
 * 4. Profile retrieval and update endpoints (GET, PUT, PATCH /api/auth/profile)
 * 5. Mass assignment protections (role/admin escalation attempts blocked)
 * 6. Cross-collection propagation of name changes (Documents, ACLs, AdminNotifications, PasswordResets)
 * 7. Privacy-safe audit logging (full DOB omitted from audit logs)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User, inMemoryUserStore } from '../src/models/user.model.js';
import { Document, inMemoryDocumentStore } from '../src/models/document.model.js';
import { AdminNotification } from '../src/models/notification.model.js';
import { PasswordResetRequest } from '../src/models/passwordResetRequest.model.js';
import { inMemoryAuditStore } from '../src/models/audit.model.js';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION, TERMS_EFFECTIVE_DATE } from '../src/controllers/auth.controller.js';

describe('Registration & Profile Enhancement Suite', () => {
  const app = createApp();
  beforeEach(() => {
    inMemoryUserStore.clear();
    inMemoryDocumentStore.clear();
    AdminNotification.clearInMemory();
    PasswordResetRequest.clearInMemory();
    inMemoryAuditStore.clear();
  });

  describe('1. Registration Form Validation & Terms Acceptance', () => {
    it('1.1 Successfully registers user with valid details, DOB (>= 13), and accepted terms', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('x-enforce-terms', 'true')
        .send({
          name: 'Jane Doe',
          email: 'jane.doe@trustvault.internal',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          dateOfBirth: '2000-05-15',
          termsAccepted: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.name).toBe('Jane Doe');
      expect(res.body.data.user.email).toBe('jane.doe@trustvault.internal');
      expect(res.body.data.user.dateOfBirth).toBe('2000-05-15');
      expect(res.body.data.user.termsVersionAccepted).toBe(CURRENT_TERMS_VERSION);
      expect(res.body.data.user.privacyVersionAcknowledged).toBe(CURRENT_PRIVACY_VERSION);
      expect(res.body.data.user.termsAcceptedAt).toBeDefined();
      expect(res.body.data.user.termsPolicyEffectiveDate).toBe(TERMS_EFFECTIVE_DATE);
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('1.2 Rejects registration when terms checkbox is unchecked (termsAccepted: false)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'jane.no.terms@trustvault.internal',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          dateOfBirth: '2000-05-15',
          termsAccepted: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TERMS_REQUIRED');
      expect(res.body.error.message).toMatch(/agree to the Terms & Conditions/i);
    });

    it('1.3 Rejects registration when terms acceptance is missing under enforced terms', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('x-enforce-terms', 'true')
        .send({
          name: 'Jane Doe',
          email: 'jane.missing.terms@trustvault.internal',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          dateOfBirth: '2000-05-15',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TERMS_REQUIRED');
    });

    it('1.4 Server generates timestamp and never trusts client-supplied terms acceptance timestamp', async () => {
      const fakeClientDate = '1999-01-01T00:00:00.000Z';
      const beforeCall = Date.now();

      const res = await request(app)
        .post('/api/auth/register')
        .set('x-enforce-terms', 'true')
        .send({
          name: 'Jane Doe',
          email: 'jane.timestamp@trustvault.internal',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          dateOfBirth: '2000-05-15',
          termsAccepted: true,
          termsAcceptedAt: fakeClientDate, // Malicious spoof attempt
        });

      expect(res.status).toBe(201);
      const serverTimestamp = new Date(res.body.data.user.termsAcceptedAt).getTime();
      expect(serverTimestamp).toBeGreaterThanOrEqual(beforeCall - 1000);
      expect(serverTimestamp).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('1.5 Rejects mismatched password and confirmPassword', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'jane.mismatch@trustvault.internal',
          password: 'Password123!',
          confirmPassword: 'DifferentPassword123!',
          dateOfBirth: '2000-05-15',
          termsAccepted: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PASSWORD_MISMATCH');
    });

    it('1.6 Rejects invalid full name (whitespace only, too short, or with angle brackets)', async () => {
      const res1 = await request(app)
        .post('/api/auth/register')
        .send({
          name: '   ',
          email: 'bad.name1@trustvault.internal',
          password: 'Password123!',
          dateOfBirth: '2000-05-15',
          termsAccepted: true,
        });
      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe('INVALID_NAME');

      const res2 = await request(app)
        .post('/api/auth/register')
        .send({
          name: '<script>alert(1)</script>',
          email: 'bad.name2@trustvault.internal',
          password: 'Password123!',
          dateOfBirth: '2000-05-15',
          termsAccepted: true,
        });
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('INVALID_NAME');
    });
  });

  describe('2. Date of Birth & Minimum Age Policy Enforcement', () => {
    it('2.1 Rejects future date of birth', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0];
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Future Kid',
          email: 'future@trustvault.internal',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          dateOfBirth: futureDate,
          termsAccepted: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FUTURE_DATE_OF_BIRTH');
      expect(res.body.error.message).toMatch(/cannot be in the future/i);
    });

    it('2.2 Rejects under-minimum-age user (< 13 years old)', async () => {
      // 10 years old
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      const dob = tenYearsAgo.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Young User',
          email: 'young@trustvault.internal',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          dateOfBirth: dob,
          termsAccepted: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNDERAGE_USER');
      expect(res.body.error.message).toMatch(/at least 13 years old/i);
    });

    it('2.3 Boundary: User exactly 13 years old today is accepted', async () => {
      const exact13 = new Date();
      exact13.setFullYear(exact13.getFullYear() - 13);
      const yyyy = exact13.getFullYear();
      const mm = String(exact13.getMonth() + 1).padStart(2, '0');
      const dd = String(exact13.getDate()).padStart(2, '0');
      const dob = `${yyyy}-${mm}-${dd}`;

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Exact 13',
          email: 'exact13@trustvault.internal',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          dateOfBirth: dob,
          termsAccepted: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.dateOfBirth).toBe(dob);
    });

    it('2.4 Boundary: User 12 years and 364 days old is rejected', async () => {
      const almost13 = new Date();
      almost13.setFullYear(almost13.getFullYear() - 13);
      almost13.setDate(almost13.getDate() + 1); // Tomorrow would be 13th birthday
      const yyyy = almost13.getFullYear();
      const mm = String(almost13.getMonth() + 1).padStart(2, '0');
      const dd = String(almost13.getDate()).padStart(2, '0');
      const dob = `${yyyy}-${mm}-${dd}`;

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Almost 13',
          email: 'almost13@trustvault.internal',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          dateOfBirth: dob,
          termsAccepted: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNDERAGE_USER');
    });

    it('2.5 Leap year date 2004-02-29 is accepted, but non-leap year 2023-02-29 is rejected', async () => {
      const resLeap = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Leap Baby',
          email: 'leap@trustvault.internal',
          password: 'Password123!',
          dateOfBirth: '2004-02-29',
          termsAccepted: true,
        });
      expect(resLeap.status).toBe(201);
      expect(resLeap.body.data.user.dateOfBirth).toBe('2004-02-29');

      const resInvalidCalendar = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Bad Calendar',
          email: 'badcal@trustvault.internal',
          password: 'Password123!',
          dateOfBirth: '2023-02-29',
          termsAccepted: true,
        });
      expect(resInvalidCalendar.status).toBe(400);
      expect(resInvalidCalendar.body.error.code).toBe('INVALID_DATE_OF_BIRTH');
    });
  });

  describe('3. Profile Retrieval & Updates', () => {
    let authHeader;
    let userId;

    beforeEach(async () => {
      inMemoryUserStore.clear();
      inMemoryAuditStore.clear();

      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Original Name',
          email: 'profile.user@trustvault.internal',
          password: 'Password123!',
          dateOfBirth: '1995-04-12',
          termsAccepted: true,
        });

      authHeader = `Bearer ${regRes.body.data.token}`;
      userId = regRes.body.data.user.id || regRes.body.data.user._id;
    });

    it('3.1 Authenticated user can view profile via GET /api/auth/profile and GET /api/auth/me', async () => {
      const resProfile = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', authHeader);

      expect(resProfile.status).toBe(200);
      expect(resProfile.body.data.user.name).toBe('Original Name');
      expect(resProfile.body.data.user.email).toBe('profile.user@trustvault.internal');
      expect(resProfile.body.data.user.dateOfBirth).toBe('1995-04-12');
      expect(resProfile.body.data.user.termsVersionAccepted).toBe(CURRENT_TERMS_VERSION);

      const resMe = await request(app)
        .get('/api/auth/me')
        .set('Authorization', authHeader);

      expect(resMe.status).toBe(200);
      expect(resMe.body.data.user.name).toBe('Original Name');
      expect(resMe.body.data.user.dateOfBirth).toBe('1995-04-12');
    });

    it('3.2 Unauthenticated profile updates are rejected with 401', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .send({ name: 'Sneaky Update' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('3.3 User can update their own name via PUT or PATCH /api/auth/profile', async () => {
      const resPut = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', authHeader)
        .send({ name: 'Updated Full Name' });

      expect(resPut.status).toBe(200);
      expect(resPut.body.data.user.name).toBe('Updated Full Name');

      // Verify read-back confirms persistence
      const readRes = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', authHeader);

      expect(readRes.body.data.user.name).toBe('Updated Full Name');
    });

    it('3.4 User can update their own date of birth subject to minimum age policy', async () => {
      const resDob = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', authHeader)
        .send({ dateOfBirth: '1998-11-20' });

      expect(resDob.status).toBe(200);
      expect(resDob.body.data.user.dateOfBirth).toBe('1998-11-20');

      // Attempting underage DOB update is rejected
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      const resBad = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', authHeader)
        .send({ dateOfBirth: tenYearsAgo.toISOString().split('T')[0] });

      expect(resBad.status).toBe(400);
      expect(resBad.body.error.code).toBe('UNDERAGE_USER');
    });

    it('3.5 Mass assignment protection: attempts to modify role or administrator status are ignored/blocked', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', authHeader)
        .send({
          name: 'Hacker Attempt',
          role: 'admin',
          requestedRole: 'admin',
          ownerApprovalStatus: 'approved',
          isAdmin: true,
          email: 'newemail@trustvault.internal',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.name).toBe('Hacker Attempt');
      expect(res.body.data.user.role).toBe('viewer'); // Privileges not elevated
      expect(res.body.data.user.email).toBe('profile.user@trustvault.internal'); // Email unchanged
    });

    it('3.6 Audit log records PROFILE_UPDATED without exposing user date of birth', async () => {
      await request(app)
        .put('/api/auth/profile')
        .set('Authorization', authHeader)
        .send({
          name: 'Audited Name',
          dateOfBirth: '1992-08-14',
        });

      const auditLogs = inMemoryAuditStore.logs;
      const profileLog = auditLogs.find((l) => l.action === 'PROFILE_UPDATED');

      expect(profileLog).toBeDefined();
      expect(profileLog.metadata.newName).toBe('Audited Name');
      expect(profileLog.metadata.previousName).toBe('Original Name');
      expect(profileLog.metadata.changedFields).toContain('name');
      expect(profileLog.metadata.changedFields).toContain('dateOfBirth');
      // Crucial privacy requirement: DOB must NOT be present in audit metadata
      expect(profileLog.metadata.dateOfBirth).toBeUndefined();
      expect(JSON.stringify(profileLog.metadata)).not.toContain('1992-08-14');
    });
  });

  describe('4. Cross-Collection Name Propagation Consistency', () => {
    it('4.1 Changing user name propagates to Document.ownerName, Document.acl, AdminNotification, and PasswordResetRequest', async () => {
      // 1. Create a user
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Abhi Original',
          email: 'abhi@trustvault.internal',
          password: 'Password123!',
          dateOfBirth: '1995-01-01',
          termsAccepted: true,
        });

      const token = regRes.body.data.token;
      const userId = regRes.body.data.user.id || regRes.body.data.user._id;

      // 2. Seed a document owned by this user
      const ownedDoc = await Document.create({
        title: 'Abhi Confidential',
        description: 'Owned doc',
        originalName: 'confidential.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        storagePath: 'vault/confidential.pdf',
        ownerId: userId,
        ownerName: 'Abhi Original',
        ownerEmail: 'abhi@trustvault.internal',
        visibility: 'private',
      });

      // 3. Seed another document where this user is in the ACL
      const sharedDoc = await Document.create({
        title: 'Team Roadmap',
        description: 'Shared doc',
        originalName: 'roadmap.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        storagePath: 'vault/roadmap.pdf',
        ownerId: 'other_owner_id',
        ownerName: 'Other Owner',
        ownerEmail: 'other@trustvault.internal',
        visibility: 'selected_users',
        acl: [
          {
            userId,
            email: 'abhi@trustvault.internal',
            name: 'Abhi Original',
            permissionLevel: 'read',
            grantedBy: 'other_owner_id',
          },
        ],
      });

      // 4. Seed an AdminNotification for this user
      await AdminNotification.create({
        type: 'owner_access_request',
        userId: String(userId),
        userName: 'Abhi Original',
        userEmail: 'abhi@trustvault.internal',
        requestId: String(userId),
        title: 'Owner Access Request',
        message: 'Abhi requested owner privileges',
      });

      // 5. Seed a PasswordResetRequest for this user
      await PasswordResetRequest.create({
        userId: String(userId),
        userName: 'Abhi Original',
        userEmail: 'abhi@trustvault.internal',
        reason: 'Lost device',
      });

      // 6. User updates profile name via PUT /api/auth/profile
      const updateRes = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Abhi Kumar Updated' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.user.name).toBe('Abhi Kumar Updated');

      // 7. Verify Document.ownerName is updated
      const freshOwnedDoc = await Document.findById(ownedDoc._id || ownedDoc.id);
      expect(freshOwnedDoc.ownerName).toBe('Abhi Kumar Updated');

      // 8. Verify Document ACL entry name is updated
      const freshSharedDoc = await Document.findById(sharedDoc._id || sharedDoc.id);
      const aclEntry = freshSharedDoc.acl.find((a) => String(a.userId) === String(userId));
      expect(aclEntry).toBeDefined();
      expect(aclEntry.name).toBe('Abhi Kumar Updated');

      // 9. Verify AdminNotification.userName is updated
      const notifs = await AdminNotification.find({ userId: String(userId) });
      expect(notifs[0].userName).toBe('Abhi Kumar Updated');

      // 10. Verify PasswordResetRequest.userName is updated
      const resetReqs = await PasswordResetRequest.find({ userId: String(userId) });
      expect(resetReqs[0].userName).toBe('Abhi Kumar Updated');
    });
  });
});
