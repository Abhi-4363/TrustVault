/**
 * TrustVault Backend - Brevo HTTPS API & Multi-Provider Email Suite
 * Validates:
 * 1. Brevo REST API (POST https://api.brevo.com/v3/smtp/email) with api-key header
 * 2. Explicit EMAIL_PROVIDER selection (brevo, resend, smtp) and automatic fallback precedence
 * 3. Prevention of duplicate email transmissions (single provider dispatch)
 * 4. Verification of delivery acceptance (only claims success if provider returns messageId)
 * 5. Safe error handling without credential/token leakage
 * 6. Verification and Password-Reset email templates and token generation integrity
 * 7. Connectivity health-check diagnostics for Brevo
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  sendViaBrevo,
  sendViaResend,
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  getActiveProvider,
  verifyEmailConnection,
  sentEmails,
  clearSentEmails,
} from '../src/services/email.service.js';

describe('Brevo HTTPS API & Multi-Provider Delivery Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearSentEmails();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('1. Brevo HTTPS API Specification (POST https://api.brevo.com/v3/smtp/email)', () => {
    it('1.1 Should correctly send email via Brevo REST API with api-key header and valid payload', async () => {
      process.env.BREVO_API_KEY = 'xkeysib-mock-test-key-12345';
      process.env.EMAIL_FROM = 'security@trustvault.internal';

      let capturedUrl = null;
      let capturedOptions = null;

      vi.spyOn(global, 'fetch').mockImplementation(async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return {
          ok: true,
          status: 201,
          json: async () => ({ messageId: '<mock-brevo-msg-id-001@smtp-relay.mailin.fr>' }),
        };
      });

      const result = await sendViaBrevo({
        to: 'recipient@domain.com',
        name: 'Sarah Connor',
        subject: 'Verify your TrustVault email address',
        html: '<p>Click here to verify</p>',
        text: 'Click here to verify',
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('brevo');
      expect(result.messageId).toBe('<mock-brevo-msg-id-001@smtp-relay.mailin.fr>');

      // Verify HTTP specification
      expect(capturedUrl).toBe('https://api.brevo.com/v3/smtp/email');
      expect(capturedOptions.method).toBe('POST');
      expect(capturedOptions.headers['api-key']).toBe('xkeysib-mock-test-key-12345');
      expect(capturedOptions.headers['Content-Type']).toBe('application/json');
      expect(capturedOptions.headers['Accept']).toBe('application/json');

      const body = JSON.parse(capturedOptions.body);
      expect(body.sender).toEqual({
        name: 'TrustVault Security',
        email: 'security@trustvault.internal',
      });
      expect(body.to).toEqual([
        { email: 'recipient@domain.com', name: 'Sarah Connor' },
      ]);
      expect(body.subject).toBe('Verify your TrustVault email address');
      expect(body.htmlContent).toBe('<p>Click here to verify</p>');
      expect(body.textContent).toBe('Click here to verify');
    });

    it('1.2 Should throw an error if BREVO_API_KEY is not configured', async () => {
      delete process.env.BREVO_API_KEY;

      await expect(
        sendViaBrevo({
          to: 'user@domain.com',
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test',
        })
      ).rejects.toThrow(/BREVO_API_KEY is not configured/i);
    });

    it('1.3 Should throw a safe error when Brevo returns an HTTP error (e.g. unverified sender 400)', async () => {
      process.env.BREVO_API_KEY = 'xkeysib-valid-key';
      process.env.EMAIL_FROM = 'unverified@external.com';

      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            code: 'unauthorized',
            message: 'Sender email unverified@external.com is not verified in Brevo account.',
          }),
        };
      });

      await expect(
        sendViaBrevo({
          to: 'user@domain.com',
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test',
        })
      ).rejects.toThrow(/not verified in Brevo/i);
    });

    it('1.4 Should reject delivery if Brevo returns HTTP 200/201 but no messageId is received', async () => {
      process.env.BREVO_API_KEY = 'xkeysib-valid-key';

      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'queued' }), // Missing messageId confirmation
        };
      });

      await expect(
        sendViaBrevo({
          to: 'user@domain.com',
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test',
        })
      ).rejects.toThrow(/Brevo API returned status 200/i);
    });
  });

  describe('2. Multi-Provider Selection & Fallback Precedence (getActiveProvider)', () => {
    it('2.1 Should honor explicit EMAIL_PROVIDER=brevo', () => {
      process.env.EMAIL_PROVIDER = 'brevo';
      process.env.BREVO_API_KEY = 'key-brevo';
      process.env.RESEND_API_KEY = 'key-resend';
      expect(getActiveProvider()).toBe('brevo');
    });

    it('2.2 Should honor explicit EMAIL_PROVIDER=resend', () => {
      process.env.EMAIL_PROVIDER = 'resend';
      process.env.BREVO_API_KEY = 'key-brevo';
      expect(getActiveProvider()).toBe('resend');
    });

    it('2.3 Should honor explicit EMAIL_PROVIDER=smtp', () => {
      process.env.EMAIL_PROVIDER = 'smtp';
      process.env.BREVO_API_KEY = 'key-brevo';
      expect(getActiveProvider()).toBe('smtp');
    });

    it('2.4 Should handle case-insensitive provider values (e.g. BREVO or Resend)', () => {
      process.env.EMAIL_PROVIDER = '  BREVO  ';
      expect(getActiveProvider()).toBe('brevo');

      process.env.EMAIL_PROVIDER = 'Resend';
      expect(getActiveProvider()).toBe('resend');
    });

    it('2.5 Should automatically fall back to Brevo if EMAIL_PROVIDER is not set and BREVO_API_KEY is present', () => {
      delete process.env.EMAIL_PROVIDER;
      process.env.BREVO_API_KEY = 'key-brevo';
      process.env.RESEND_API_KEY = 'key-resend';
      expect(getActiveProvider()).toBe('brevo');
    });

    it('2.6 Should fall back to Resend if BREVO_API_KEY is absent and RESEND_API_KEY is present', () => {
      delete process.env.EMAIL_PROVIDER;
      delete process.env.BREVO_API_KEY;
      process.env.RESEND_API_KEY = 'key-resend';
      expect(getActiveProvider()).toBe('resend');
    });

    it('2.7 Should fall back to SMTP if no API keys are present but SMTP credentials exist', () => {
      delete process.env.EMAIL_PROVIDER;
      delete process.env.BREVO_API_KEY;
      delete process.env.RESEND_API_KEY;
      process.env.SMTP_USER = 'smtpuser@domain.com';
      process.env.SMTP_PASS = 'smtppassword';
      expect(getActiveProvider()).toBe('smtp');
    });

    it('2.8 Should return simulated if no provider credentials exist', () => {
      process.env.EMAIL_PROVIDER = '';
      process.env.BREVO_API_KEY = '';
      process.env.RESEND_API_KEY = '';
      process.env.SMTP_USER = '';
      process.env.SMTP_PASS = '';
      expect(getActiveProvider()).toBe('simulated');
    });
  });

  describe('3. Single-Provider Dispatch & Duplicate Transmission Prevention', () => {
    it('3.1 Should only dispatch through Brevo and avoid calling other providers when EMAIL_PROVIDER=brevo', async () => {
      process.env.EMAIL_PROVIDER = 'brevo';
      process.env.BREVO_API_KEY = 'xkeysib-test';
      process.env.RESEND_API_KEY = 're_test_key';
      process.env.FORCE_LIVE_EMAIL = 'true';

      let fetchCount = 0;
      let requestedUrl = null;

      vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
        fetchCount++;
        requestedUrl = url;
        return {
          ok: true,
          status: 201,
          json: async () => ({ messageId: '<brevo-unique-id-999>' }),
        };
      });

      const result = await sendEmail({
        to: 'user@domain.com',
        name: 'Alex Developer',
        subject: 'Single Dispatch Verification',
        html: '<p>Testing single dispatch</p>',
        text: 'Testing single dispatch',
      });

      expect(fetchCount).toBe(1);
      expect(requestedUrl).toBe('https://api.brevo.com/v3/smtp/email');
      expect(result.success).toBe(true);
      expect(result.provider).toBe('brevo');
      expect(result.messageId).toBe('<brevo-unique-id-999>');
    });

    it('3.2 Should not fall back or send duplicate emails when Brevo returns an error', async () => {
      process.env.EMAIL_PROVIDER = 'brevo';
      process.env.BREVO_API_KEY = 'xkeysib-test';
      process.env.RESEND_API_KEY = 're_test_key';
      process.env.FORCE_LIVE_EMAIL = 'true';

      let fetchCount = 0;

      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        fetchCount++;
        return {
          ok: false,
          status: 401,
          json: async () => ({ message: 'Invalid Brevo API key provided' }),
        };
      });

      const result = await sendEmail({
        to: 'user@domain.com',
        subject: 'Failover Prevention Test',
        html: '<p>No duplicates</p>',
        text: 'No duplicates',
      });

      // Crucial: Must only attempt Brevo once and NOT fall back to Resend or SMTP
      expect(fetchCount).toBe(1);
      expect(result.success).toBe(false);
      expect(result.provider).toBe('brevo');
      expect(result.error).toMatch(/Invalid Brevo API key/i);
    });
  });

  describe('4. Verification & Password-Reset Email Flows with Brevo', () => {
    it('4.1 sendVerificationEmail passes correct subject, secure token link, and HTML/text templates to Brevo', async () => {
      process.env.EMAIL_PROVIDER = 'brevo';
      process.env.BREVO_API_KEY = 'xkeysib-test-verification';
      process.env.FORCE_LIVE_EMAIL = 'true';

      let sentPayload = null;

      vi.spyOn(global, 'fetch').mockImplementation(async (url, options) => {
        sentPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 201,
          json: async () => ({ messageId: '<brevo-verification-token-sent>' }),
        };
      });

      const verificationToken = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
      const result = await sendVerificationEmail({
        to: 'evelyn@trustvault.internal',
        name: 'Evelyn Reed',
        token: verificationToken,
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('brevo');

      // Verify payload integrity
      expect(sentPayload.subject).toBe('Verify your TrustVault email address');
      expect(sentPayload.to[0].email).toBe('evelyn@trustvault.internal');
      expect(sentPayload.to[0].name).toBe('Evelyn Reed');
      expect(sentPayload.textContent).toContain(`verifyToken=${verificationToken}`);
      expect(sentPayload.textContent).toContain('This verification link will expire in 24 hours');
      expect(sentPayload.htmlContent).toContain(`verifyToken=${verificationToken}`);
      expect(sentPayload.htmlContent).toContain('Verify Email Address');
    });

    it('4.2 sendPasswordResetEmail passes correct subject, 15m expiry link, and HTML/text templates to Brevo', async () => {
      process.env.EMAIL_PROVIDER = 'brevo';
      process.env.BREVO_API_KEY = 'xkeysib-test-reset';
      process.env.FORCE_LIVE_EMAIL = 'true';

      let sentPayload = null;

      vi.spyOn(global, 'fetch').mockImplementation(async (url, options) => {
        sentPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 201,
          json: async () => ({ messageId: '<brevo-password-reset-sent>' }),
        };
      });

      const resetToken = 'fe09dcba87654321fedcba0987654321';
      const result = await sendPasswordResetEmail({
        to: 'michael.scott@trustvault.internal',
        name: 'Michael Scott',
        token: resetToken,
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('brevo');

      // Verify payload integrity
      expect(sentPayload.subject).toBe('TrustVault Password Reset Request');
      expect(sentPayload.to[0].email).toBe('michael.scott@trustvault.internal');
      expect(sentPayload.to[0].name).toBe('Michael Scott');
      expect(sentPayload.textContent).toContain(`resetToken=${resetToken}`);
      expect(sentPayload.textContent).toContain('will expire in 15 minutes');
      expect(sentPayload.htmlContent).toContain(`resetToken=${resetToken}`);
      expect(sentPayload.htmlContent).toContain('Reset My Password');
      expect(sentPayload.htmlContent).toContain('valid for <strong>15 minutes</strong>');
    });
  });

  describe('5. Email Connection Health Check Diagnostics (verifyEmailConnection)', () => {
    it('5.1 Returns connected=true with provider diagnostics when Brevo is active and API key exists', async () => {
      process.env.EMAIL_PROVIDER = 'brevo';
      process.env.BREVO_API_KEY = 'xkeysib-diagnostic-key';
      process.env.EMAIL_FROM = 'admin@trustvault.internal';

      const status = await verifyEmailConnection();
      expect(status.connected).toBe(true);
      expect(status.provider).toBe('brevo');
      expect(status.sender).toBe('admin@trustvault.internal');
      expect(status.message).toMatch(/Port 443, Render compatible/i);
    });

    it('5.2 Returns connected=false when EMAIL_PROVIDER=brevo but BREVO_API_KEY is missing', async () => {
      process.env.EMAIL_PROVIDER = 'brevo';
      delete process.env.BREVO_API_KEY;

      const status = await verifyEmailConnection();
      expect(status.connected).toBe(false);
      expect(status.provider).toBe('brevo');
      expect(status.error).toMatch(/BREVO_API_KEY is not configured/i);
    });
  });
});
