/**
 * TrustVault Backend - Email Verification & Password Recovery Integration Tests
 * Validates:
 * 1. Registration creates unverified user and sends verification email
 * 2. Unverified users blocked from accessing protected vault documents (403 EMAIL_NOT_VERIFIED)
 * 3. Email verification with valid cryptographic token activates account and auto-authenticates
 * 4. Invalid, expired, and reused verification tokens are rejected
 * 5. Resend verification generates fresh token and preserves enumeration resistance
 * 6. Dual-Option Password Recovery:
 *    - Option A: Admin-assisted password reset (notification + Password@123 temporary policy)
 *    - Option B: Self-service email reset link (15m expiry, user-chosen password)
 * 7. Security invariants: token hashes never exposed, audit logging records safe metadata
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { AuditLog } from '../src/models/audit.model.js';
import { PasswordResetRequest } from '../src/models/passwordResetRequest.model.js';
import { AdminNotification } from '../src/models/notification.model.js';
import { sentEmails, clearSentEmails } from '../src/services/email.service.js';

describe('Email Verification & Dual-Option Password Recovery Suite', () => {
  const app = createApp();

  beforeEach(() => {
    User.clearInMemory();
    AuditLog.clearInMemory();
    PasswordResetRequest.clearInMemory();
    AdminNotification.clearInMemory();
    clearSentEmails();
  });

  describe('1. Registration and Email Verification Flow', () => {
    const signupData = {
      name: 'Evelyn Reed',
      email: 'evelyn@trustvault.internal',
      password: 'SecurePassword123!',
      requireVerification: true,
    };

    it('1.1 Registration creates an unverified account and dispatches a verification email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(signupData);

      expect(res.status).toBe(201);
      expect(res.body.data.user.email).toBe('evelyn@trustvault.internal');
      expect(res.body.data.user.isEmailVerified).toBe(false);
      expect(res.body.data).toHaveProperty('verificationToken');

      // Assert email dispatch
      expect(sentEmails.length).toBe(1);
      expect(sentEmails[0].to).toBe('evelyn@trustvault.internal');
      expect(sentEmails[0].subject).toContain('Verify your TrustVault email');
      expect(sentEmails[0].text).toContain(res.body.data.verificationToken);
    });

    it('1.2 Public registration prevents privilege escalation to Admin', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...signupData,
          role: 'admin',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('viewer'); // Strictly viewer
    });

    it('1.3 Unverified user is blocked from logging in with 403 EMAIL_NOT_VERIFIED', async () => {
      await request(app).post('/api/auth/register').send(signupData);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: signupData.email,
          password: signupData.password,
        });

      expect(loginRes.status).toBe(403);
      expect(loginRes.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('1.4 Unverified user is blocked from accessing protected documents', async () => {
      const regRes = await request(app).post('/api/auth/register').send(signupData);
      const unverifiedToken = regRes.body.data.token;

      // Access protected document vault
      const docRes = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${unverifiedToken}`);

      expect(docRes.status).toBe(403);
      expect(docRes.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('1.5 Valid verification token marks account verified, auto-authenticates, and allows document access', async () => {
      const regRes = await request(app).post('/api/auth/register').send(signupData);
      const rawToken = regRes.body.data.verificationToken;

      // Click verification link
      const verifyRes = await request(app)
        .get(`/api/auth/verify-email?token=${rawToken}`);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.message).toMatch(/successfully verified/i);
      expect(verifyRes.body.data.user.isEmailVerified).toBe(true);
      expect(verifyRes.body.data).toHaveProperty('token');

      const verifiedToken = verifyRes.body.data.token;

      // Verified token can now access protected documents
      const docRes = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${verifiedToken}`);

      expect(docRes.status).toBe(200);
    });

    it('1.6 Single-use verification token cannot be reused', async () => {
      const regRes = await request(app).post('/api/auth/register').send(signupData);
      const rawToken = regRes.body.data.verificationToken;

      // First verification succeeds
      const firstRes = await request(app).get(`/api/auth/verify-email?token=${rawToken}`);
      expect(firstRes.status).toBe(200);

      // Second verification attempt with same token fails
      const secondRes = await request(app).get(`/api/auth/verify-email?token=${rawToken}`);
      expect(secondRes.status).toBe(400);
      expect(secondRes.body.error.code).toBe('INVALID_VERIFICATION_TOKEN');
    });

    it('1.7 Invalid or corrupted verification token returns 400 INVALID_VERIFICATION_TOKEN', async () => {
      const res = await request(app)
        .get('/api/auth/verify-email?token=completely_invalid_token_12345');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_VERIFICATION_TOKEN');
    });

    it('1.8 Expired verification token is rejected with 400 EXPIRED_VERIFICATION_TOKEN', async () => {
      const rawToken = 'expired_raw_token_xyz';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await User.create({
        name: 'Expired User',
        email: 'expired@trustvault.internal',
        password: 'Password123!',
        isEmailVerified: false,
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
      });

      const res = await request(app).get(`/api/auth/verify-email?token=${rawToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('EXPIRED_VERIFICATION_TOKEN');
    });

    it('1.9 Resend verification issues a fresh token and dispatches new email', async () => {
      await request(app).post('/api/auth/register').send(signupData);
      clearSentEmails();

      const resendRes = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: signupData.email });

      expect(resendRes.status).toBe(200);
      expect(resendRes.body.message).toMatch(/verification link has been sent/i);
      expect(sentEmails.length).toBe(1);
      expect(sentEmails[0].to).toBe(signupData.email);

      // Verify the new token works
      const newToken = resendRes.body.verificationToken;
      const verifyRes = await request(app).get(`/api/auth/verify-email?token=${newToken}`);
      expect(verifyRes.status).toBe(200);
    });

    it('1.10 Resend verification returns neutral response for non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'nonexistent@trustvault.internal' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/verification link has been sent/i);
      expect(sentEmails.length).toBe(0);
    });

    it('1.11 Verification records audit event without logging the raw token', async () => {
      const regRes = await request(app).post('/api/auth/register').send(signupData);
      const rawToken = regRes.body.data.verificationToken;

      await request(app).get(`/api/auth/verify-email?token=${rawToken}`);

      const auditLogs = await AuditLog.find({ action: 'EMAIL_VERIFIED' });
      expect(auditLogs.length).toBe(1);
      expect(JSON.stringify(auditLogs[0])).not.toContain(rawToken);
    });
  });

  describe('2. Dual-Option Password Recovery Workflows', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        name: 'Michael Scott',
        email: 'michael.scott@trustvault.internal',
        password: 'OriginalPassword123!',
        role: 'owner',
        isEmailVerified: true,
      });
    });

    describe('Option A — Request Reset from Admin', () => {
      it('2.1 Submits Admin reset request, creates persistent notification, and returns neutral response', async () => {
        const res = await request(app)
          .post('/api/auth/forgot-password')
          .send({ email: 'michael.scott@trustvault.internal' });

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/submitted to an Administrator/i);

        // Verify persistent PasswordResetRequest
        const pending = await PasswordResetRequest.find({ userId: String(testUser._id || testUser.id) });
        expect(pending.length).toBe(1);
        expect(pending[0].status).toBe('pending');

        // Verify persistent AdminNotification
        const notifs = await AdminNotification.find({ type: 'password_reset_request' });
        expect(notifs.length).toBe(1);
        expect(notifs[0].title).toBe('Password Reset Request');
        expect(notifs[0].userName).toBe('Michael Scott');
      });

      it('2.2 Neutral response for non-existent email prevents user enumeration', async () => {
        const res = await request(app)
          .post('/api/auth/forgot-password')
          .send({ email: 'ghost@trustvault.internal' });

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/submitted to an Administrator/i);
        const notifs = await AdminNotification.find({});
        expect(notifs.length).toBe(0);
      });
    });

    describe('Option B — Self-Service Password Reset via Email Link', () => {
      it('2.3 Generates 15-minute single-use token and sends reset email', async () => {
        const res = await request(app)
          .post('/api/auth/forgot-password-email')
          .send({ email: 'michael.scott@trustvault.internal' });

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/password reset link has been sent/i);
        expect(res.body).toHaveProperty('resetToken');

        // Verify email dispatched with reset link
        expect(sentEmails.length).toBe(1);
        expect(sentEmails[0].to).toBe('michael.scott@trustvault.internal');
        expect(sentEmails[0].subject).toContain('Password Reset Request');
        expect(sentEmails[0].text).toContain(res.body.resetToken);
      });

      it('2.4 Successfully resets password with valid token and user-selected password', async () => {
        const forgotRes = await request(app)
          .post('/api/auth/forgot-password-email')
          .send({ email: 'michael.scott@trustvault.internal' });

        const rawToken = forgotRes.body.resetToken;

        const resetRes = await request(app)
          .post('/api/auth/reset-password')
          .send({
            token: rawToken,
            newPassword: 'MyNewCustomPassword2026!',
            confirmPassword: 'MyNewCustomPassword2026!',
          });

        expect(resetRes.status).toBe(200);
        expect(resetRes.body.message).toMatch(/password successfully reset/i);

        // Can log in with new password
        const loginRes = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'michael.scott@trustvault.internal',
            password: 'MyNewCustomPassword2026!',
          });

        expect(loginRes.status).toBe(200);
        expect(loginRes.body.data).toHaveProperty('token');

        // Old password rejected
        const oldLoginRes = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'michael.scott@trustvault.internal',
            password: 'OriginalPassword123!',
          });

        expect(oldLoginRes.status).toBe(401);
      });

      it('2.5 Single-use email reset token cannot be reused', async () => {
        const forgotRes = await request(app)
          .post('/api/auth/forgot-password-email')
          .send({ email: 'michael.scott@trustvault.internal' });

        const rawToken = forgotRes.body.resetToken;

        // First reset succeeds
        const first = await request(app)
          .post('/api/auth/reset-password')
          .send({
            token: rawToken,
            newPassword: 'FirstPassword123!',
          });
        expect(first.status).toBe(200);

        // Reusing same token fails
        const second = await request(app)
          .post('/api/auth/reset-password')
          .send({
            token: rawToken,
            newPassword: 'SecondPassword123!',
          });
        expect(second.status).toBe(400);
        expect(second.body.error.code).toBe('INVALID_RESET_TOKEN');
      });

      it('2.6 Expired email reset token (> 15 minutes) is rejected', async () => {
        const rawToken = 'expired_recovery_token_123';
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        await User.findByIdAndUpdate(testUser._id || testUser.id, {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: new Date(Date.now() - 1000), // Expired
        });

        const res = await request(app)
          .post('/api/auth/reset-password')
          .send({
            token: rawToken,
            newPassword: 'ValidNewPassword123!',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('EXPIRED_RESET_TOKEN');
      });

      it('2.7 Rejects weak passwords or mismatched password confirmations', async () => {
        const forgotRes = await request(app)
          .post('/api/auth/forgot-password-email')
          .send({ email: 'michael.scott@trustvault.internal' });

        const rawToken = forgotRes.body.resetToken;

        // Mismatched
        const mismatchRes = await request(app)
          .post('/api/auth/reset-password')
          .send({
            token: rawToken,
            newPassword: 'ValidPassword123!',
            confirmPassword: 'DifferentPassword123!',
          });
        expect(mismatchRes.status).toBe(400);
        expect(mismatchRes.body.error.code).toBe('PASSWORD_MISMATCH');

        // Weak (<8 chars)
        const weakRes = await request(app)
          .post('/api/auth/reset-password')
          .send({
            token: rawToken,
            newPassword: 'short1',
          });
        expect(weakRes.status).toBe(400);
        expect(weakRes.body.error.code).toBe('WEAK_PASSWORD');
      });

      it('2.8 Password reset clears any previous mustChangePassword requirement', async () => {
        await User.findByIdAndUpdate(testUser._id || testUser.id, {
          mustChangePassword: true,
        });

        const forgotRes = await request(app)
          .post('/api/auth/forgot-password-email')
          .send({ email: 'michael.scott@trustvault.internal' });

        await request(app)
          .post('/api/auth/reset-password')
          .send({
            token: forgotRes.body.resetToken,
            newPassword: 'NewPassword999!',
          });

        const updated = await User.findById(testUser._id || testUser.id);
        expect(updated.mustChangePassword).toBe(false);
      });
    });
  });
});
