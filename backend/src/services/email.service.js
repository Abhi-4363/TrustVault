/**
 * TrustVault Backend - Unified Email Delivery Service
 * Manages transactional email delivery via Gmail SMTP (Nodemailer)
 * with robust error handling, link generation, and in-memory test recording.
 */

import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

// In-memory record of sent emails for automated test assertions
export const sentEmails = [];

export function clearSentEmails() {
  sentEmails.length = 0;
}

let transporterInstance = null;

/**
 * Initializes or returns the cached Nodemailer transporter
 */
export function getTransporter() {
  if (transporterInstance) {
    return transporterInstance;
  }

  // If in test mode and no SMTP user is provided, or explicitly set to mock
  if (config.isTest && !process.env.FORCE_REAL_SMTP) {
    return null;
  }

  const hasCredentials = Boolean(config.smtpUser && config.smtpPass);

  if (!hasCredentials) {
    console.warn('[Email Service]: SMTP credentials not fully configured. Outbound emails will be simulated.');
    return null;
  }

  transporterInstance = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure, // true for 465, false for 587
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
    tls: {
      // Never disable certificate verification
      rejectUnauthorized: true,
    },
  });

  return transporterInstance;
}

/**
 * Verify transporter SMTP connectivity
 */
export async function verifyEmailConnection() {
  const transporter = getTransporter();
  if (!transporter) {
    return {
      connected: false,
      message: 'SMTP transporter not configured or running in test mode.',
    };
  }

  try {
    await transporter.verify();
    return {
      connected: true,
      message: `Successfully connected to SMTP server ${config.smtpHost}:${config.smtpPort}`,
    };
  } catch (error) {
    console.error('[Email Service Verification Failed]:', error.message);
    return {
      connected: false,
      error: error.message,
    };
  }
}

/**
 * Send an email message with safe fallback and test recording
 */
export async function sendEmail({ to, subject, html, text }) {
  const fromAddress = config.emailFrom || 'konagallaabhiram@gmail.com';
  const mailOptions = {
    from: `"TrustVault Security" <${fromAddress}>`,
    to,
    subject,
    text,
    html,
  };

  // Record into test harness
  sentEmails.push({
    to,
    subject,
    text,
    html,
    timestamp: new Date(),
  });

  const transporter = getTransporter();

  // If running in test mode without live SMTP override, simulate successful delivery
  if (!transporter) {
    return {
      success: true,
      simulated: true,
      messageId: `test-simulated-${Date.now()}`,
    };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      response: info.response,
    };
  } catch (error) {
    // Log safe diagnostic without credentials
    console.error(`[Email Service Delivery Failed] Recipient: ${to}, Reason: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Sends an email verification link to a newly registered user
 */
export async function sendVerificationEmail({ to, name, token }) {
  const verifyUrl = `${config.appBaseUrl}/?verifyToken=${encodeURIComponent(token)}`;
  const subject = 'Verify your TrustVault email address';

  const text = `Hello ${name || 'User'},

Welcome to TrustVault! Please verify your email address to activate your account and access confidential workspace documents:

${verifyUrl}

This verification link will expire in 24 hours. If you did not create an account on TrustVault, please disregard this email.

— The TrustVault Security Team
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 24px; color: #f8fafc; }
    .card { max-width: 540px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
    .header { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
    .logo { font-size: 20px; font-weight: 800; color: #38bdf8; letter-spacing: -0.5px; }
    .title { font-size: 22px; font-weight: 700; color: #ffffff; margin: 0 0 12px 0; }
    .desc { font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 24px 0; }
    .btn { display: inline-block; background: #0284c7; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 8px; margin-bottom: 24px; }
    .meta-box { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 14px; font-size: 12px; color: #64748b; line-height: 1.5; word-break: break-all; }
    .footer { margin-top: 24px; font-size: 11px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🛡️ TrustVault</div>
    <h1 class="title">Verify your email address</h1>
    <p class="desc">Hello ${name || 'User'},<br><br>Thank you for registering with TrustVault. To activate your account and complete registration, please verify your email address by clicking the button below.</p>
    <div style="text-align: center;">
      <a href="${verifyUrl}" class="btn" target="_blank">Verify Email Address</a>
    </div>
    <div class="meta-box">
      <strong>Button not working?</strong> Copy and paste this URL into your browser:<br>
      <a href="${verifyUrl}" style="color: #38bdf8;">${verifyUrl}</a>
    </div>
    <p class="desc" style="margin-top: 20px; font-size: 12px;">This single-use verification link will expire in 24 hours. If you did not create a TrustVault account, no further action is required.</p>
    <div class="footer">
      TrustVault Secure Document Management Platform • Enterprise Security
    </div>
  </div>
</body>
</html>
`;

  return sendEmail({ to, subject, html, text });
}

/**
 * Sends a self-service password reset link with single-use token
 */
export async function sendPasswordResetEmail({ to, name, token }) {
  const resetUrl = `${config.appBaseUrl}/?resetToken=${encodeURIComponent(token)}`;
  const subject = 'TrustVault Password Reset Request';

  const text = `Hello ${name || 'User'},

We received a request to reset your TrustVault account password. Click the link below to choose a new password:

${resetUrl}

This single-use password reset link will expire in 15 minutes.

If you did not request a password reset, please ignore this email. Your current password will remain completely safe and unchanged.

— The TrustVault Security Team
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 24px; color: #f8fafc; }
    .card { max-width: 540px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
    .logo { font-size: 20px; font-weight: 800; color: #38bdf8; letter-spacing: -0.5px; }
    .title { font-size: 22px; font-weight: 700; color: #ffffff; margin: 0 0 12px 0; }
    .desc { font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 24px 0; }
    .btn { display: inline-block; background: #0284c7; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 8px; margin-bottom: 24px; }
    .meta-box { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 14px; font-size: 12px; color: #64748b; line-height: 1.5; word-break: break-all; }
    .footer { margin-top: 24px; font-size: 11px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🛡️ TrustVault</div>
    <h1 class="title">Reset Account Password</h1>
    <p class="desc">Hello ${name || 'User'},<br><br>We received a self-service password reset request for your account. You can securely set a new password by clicking the button below:</p>
    <div style="text-align: center;">
      <a href="${resetUrl}" class="btn" target="_blank">Reset My Password</a>
    </div>
    <div class="meta-box">
      <strong>Button not working?</strong> Copy and paste this URL into your browser:<br>
      <a href="${resetUrl}" style="color: #38bdf8;">${resetUrl}</a>
    </div>
    <p class="desc" style="margin-top: 20px; font-size: 12px;">This single-use recovery link is valid for <strong>15 minutes</strong>. If you did not make this request, you can safely ignore this email; your password remains unchanged.</p>
    <div class="footer">
      TrustVault Secure Document Management Platform • Enterprise Security
    </div>
  </div>
</body>
</html>
`;

  return sendEmail({ to, subject, html, text });
}

/**
 * Send a quick test email to verify SMTP delivery
 */
export async function sendTestEmail({ to }) {
  return sendEmail({
    to,
    subject: 'TrustVault — SMTP Delivery Verification',
    text: 'This is a test email sent from TrustVault to verify Gmail SMTP configuration.',
    html: '<p>This is a test email sent from <strong>TrustVault</strong> to verify Gmail SMTP configuration.</p>',
  });
}
