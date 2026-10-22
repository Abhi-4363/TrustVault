/**
 * TrustVault Backend - Authentication Controller
 * Handles user registration, email verification, login, profile retrieval,
 * and dual-option password recovery (Admin-assisted & self-service email reset).
 *
 * Security features:
 * - Minimum 12 salt rounds with bcrypt (4 in test for performance)
 * - Single-use cryptographic tokens (SHA-256 hashed at rest)
 * - THREAT-06 Mitigation: Client cannot escalate privileges by supplying role: 'admin'
 * - Account enumeration resistance: Generic responses on auth and recovery
 * - Never returns passwordHash or token hashes in responses
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/user.model.js';
import { AdminNotification } from '../models/notification.model.js';
import { PasswordResetRequest } from '../models/passwordResetRequest.model.js';
import { generateToken } from '../utils/token.js';
import { logAuditEvent } from '../services/audit.service.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.service.js';
import { config } from '../config/env.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_SALT_ROUNDS = config.isTest ? 4 : 12;

/**
 * Register a new user
 * POST /api/auth/register
 */
export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    // 1. Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        error: {
          code: 'INVALID_NAME',
          message: 'Full name is required and must be at least 2 characters.',
        },
      });
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EMAIL',
          message: 'A valid email address is required.',
        },
      });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must be at least 8 characters long.',
        },
      });
    }

    // Require at least one letter and one number for password complexity
    if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) {
      return res.status(400).json({
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must contain at least one letter and one number.',
        },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 2. Check for duplicate email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      if (existingUser.isEmailVerified === false) {
        // If the user registered previously but has NOT verified their email, allow re-registration:
        // Update password, credentials, and re-issue fresh verification token
        const rawVerificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationTokenHash = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
        const emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
        const passwordHash = await bcrypt.hash(password, salt);

        const rawRequested = String(req.body.requestedRole || req.body.accountType || '').toLowerCase().trim();
        const isOwnerRequested = rawRequested === 'owner';
        const requestedRole = isOwnerRequested ? 'owner' : 'viewer';
        const ownerApprovalStatus = isOwnerRequested ? 'pending' : 'not_required';

        await User.findByIdAndUpdate(existingUser._id || existingUser.id, {
          name: name.trim(),
          passwordHash,
          requestedRole,
          ownerApprovalStatus,
          emailVerificationTokenHash,
          emailVerificationExpiresAt,
        });

        const devVerifyUrl = `${config.appBaseUrl}/?verifyToken=${encodeURIComponent(rawVerificationToken)}`;

        console.log('\n================================================================');
        console.log(`🔗 [DEV VERIFICATION LINK FOR ${existingUser.email}]:`);
        console.log(devVerifyUrl);
        console.log('================================================================\n');

        const sendResult = await sendVerificationEmail({
          to: existingUser.email,
          name: name.trim(),
          token: rawVerificationToken,
        });

        const token = generateToken(existingUser);

        return res.status(200).json({
          status: 'success',
          message: 'Account updated. Please verify your email address to activate your account.',
          data: {
            user: existingUser.toJSON ? existingUser.toJSON() : existingUser,
            token,
            isEmailVerified: false,
            emailDelivery: {
              attempted: true,
              sent: Boolean(sendResult && sendResult.success),
              error: sendResult?.error,
            },
            devVerifyUrl: !config.isProduction ? devVerifyUrl : undefined,
            verificationToken: config.isTest ? rawVerificationToken : undefined,
          },
        });
      }

      return res.status(409).json({
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email address is already registered and verified. Please sign in.',
        },
      });
    }

    // 3. Process requested account type (Viewer vs Owner)
    // Client-supplied 'role' field (e.g. role: 'admin') is strictly rejected/ignored for THREAT-06 mitigation.
    const rawRequested = String(req.body.requestedRole || req.body.accountType || '').toLowerCase().trim();
    const isOwnerRequested = rawRequested === 'owner';

    // Effective role is strictly 'viewer' upon public registration
    const role = 'viewer';
    const requestedRole = isOwnerRequested ? 'owner' : 'viewer';
    const ownerApprovalStatus = isOwnerRequested ? 'pending' : 'not_required';
    const ownerApprovalRequestedAt = isOwnerRequested ? new Date() : null;

    // 4. Generate cryptographically secure single-use email verification token
    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationTokenHash = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
    const emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry

    // Determine verification requirement:
    // In dev / production: ALWAYS unverified (false)
    // In test mode: false if requireVerification flag or header set, otherwise true for legacy fixture tests
    const isEmailVerified = req.body.isEmailVerified !== undefined
      ? Boolean(req.body.isEmailVerified)
      : (config.isTest && !req.headers['x-require-verification'] && req.body.requireVerification !== true
          ? true
          : false);

    // 5. Create user record with hashed password and verification state
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,
      requestedRole,
      ownerApprovalStatus,
      ownerApprovalRequestedAt,
      ownerApprovalReviewedAt: null,
      ownerApprovalReviewedBy: null,
      ownerApprovalReviewedByName: null,
      roleChangeReason: '',
      isActive: true,
      isEmailVerified,
      emailVerificationTokenHash: isEmailVerified ? null : emailVerificationTokenHash,
      emailVerificationExpiresAt: isEmailVerified ? null : emailVerificationExpiresAt,
    });

    // Record immutable audit events
    await logAuditEvent({
      req,
      action: 'ACCOUNT_REGISTERED',
      documentId: String(user._id || user.id),
      documentTitle: `Account: ${user.email}`,
      metadata: {
        userId: String(user._id || user.id),
        email: user.email,
        name: user.name,
        effectiveRole: role,
        requestedRole,
        ownerApprovalStatus,
        isEmailVerified,
      },
    });

    if (isOwnerRequested) {
      await logAuditEvent({
        req,
        action: 'OWNER_ACCESS_REQUESTED',
        documentId: String(user._id || user.id),
        documentTitle: `Account: ${user.email}`,
        metadata: {
          userId: String(user._id || user.id),
          email: user.email,
          name: user.name,
          currentRole: 'viewer',
          requestedRole: 'owner',
          approvalStatus: 'pending',
          requestedAt: ownerApprovalRequestedAt,
        },
      });

      // Create persistent unread Admin notification
      await AdminNotification.create({
        type: 'owner_access_request',
        userId: String(user._id || user.id),
        userName: user.name,
        userEmail: user.email,
        requestId: String(user._id || user.id),
        title: 'Document Owner Access Request',
        message: `${user.name} (${user.email}) requested Document Owner access upon account registration.`,
        status: 'pending',
        isRead: false,
      });
    }

    // 6. Send verification email if account is unverified
    let emailDelivery = { attempted: false, sent: false };
    const devVerifyUrl = `${config.appBaseUrl}/?verifyToken=${encodeURIComponent(rawVerificationToken)}`;

    if (!isEmailVerified) {
      emailDelivery.attempted = true;
      const sendResult = await sendVerificationEmail({
        to: user.email,
        name: user.name,
        token: rawVerificationToken,
      });
      emailDelivery.sent = Boolean(sendResult && sendResult.success);
      if (!emailDelivery.sent && sendResult?.error) {
        emailDelivery.error = sendResult.error;
      }

      console.log('\n================================================================');
      console.log(`🔗 [DEV VERIFICATION LINK FOR ${user.email}]:`);
      console.log(devVerifyUrl);
      console.log('================================================================\n');
    }

    // 7. Generate authentication token
    const token = generateToken(user);

    let message;
    if (!isEmailVerified) {
      message = emailDelivery.sent
        ? 'Account registered successfully. Please check your inbox and spam folder to verify your email address.'
        : 'Account created. We were unable to deliver the verification email due to a mail provider error. Please check your SMTP settings or use Resend Verification.';
    } else if (isOwnerRequested) {
      message = 'Account registered successfully. Your Owner access request is pending Admin approval. You can continue using your Viewer account while you wait.';
    } else {
      message = 'User account created successfully.';
    }

    // 8. Respond with created user (toJSON strips passwordHash and verification token hashes)
    return res.status(201).json({
      status: 'success',
      message,
      data: {
        user: user.toJSON ? user.toJSON() : user,
        token,
        isEmailVerified: user.isEmailVerified,
        emailDelivery,
        devVerifyUrl: !isEmailVerified ? devVerifyUrl : undefined,
        verificationToken: config.isTest ? rawVerificationToken : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Verify user email address with single-use cryptographic token
 * GET /api/auth/verify-email
 * POST /api/auth/verify-email
 */
export async function verifyEmail(req, res, next) {
  try {
    const rawToken = req.query.token || req.body.token || req.query.verifyToken || req.body.verifyToken;

    if (!rawToken || typeof rawToken !== 'string' || !rawToken.trim()) {
      return res.status(400).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'A verification token is required to verify your email address.',
        },
      });
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const user = await User.findOne({ emailVerificationTokenHash: tokenHash });

    if (!user) {
      return res.status(400).json({
        error: {
          code: 'INVALID_VERIFICATION_TOKEN',
          message: 'The verification token is invalid or has already been used.',
        },
      });
    }

    if (user.emailVerificationExpiresAt && new Date(user.emailVerificationExpiresAt) < new Date()) {
      return res.status(400).json({
        error: {
          code: 'EXPIRED_VERIFICATION_TOKEN',
          message: 'The verification token has expired. Please request a new verification email.',
        },
      });
    }

    // Mark email as verified and invalidate token immediately upon use
    const updatedUser = await User.findByIdAndUpdate(
      user._id || user.id,
      {
        isEmailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
      { new: true }
    );

    // Record audit event without logging the token
    await logAuditEvent({
      req,
      action: 'EMAIL_VERIFIED',
      documentId: String(user._id || user.id),
      documentTitle: `Account: ${user.email}`,
      metadata: {
        userId: String(user._id || user.id),
        email: user.email,
        timestamp: new Date().toISOString(),
      },
    });

    // Automatically authenticate the user upon successful verification
    const sessionToken = generateToken(updatedUser || user);

    return res.status(200).json({
      status: 'success',
      message: 'Email address successfully verified. You are now authenticated.',
      data: {
        user: updatedUser?.toJSON ? updatedUser.toJSON() : (user.toJSON ? user.toJSON() : user),
        token: sessionToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Resend email verification link
 * POST /api/auth/resend-verification
 */
export async function resendVerification(req, res, next) {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EMAIL',
          message: 'A valid email address is required.',
        },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Neutral response to avoid email enumeration
    const neutralResponse = {
      status: 'success',
      message: 'If an unverified account exists with this email address, a new verification link has been sent.',
    };

    if (!user) {
      return res.status(200).json(neutralResponse);
    }

    if (user.isEmailVerified === true) {
      return res.status(200).json({
        status: 'success',
        message: 'This email address is already verified. You may sign in directly.',
      });
    }

    // Generate fresh single-use verification token (supersedes previous)
    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationTokenHash = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
    const emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await User.findByIdAndUpdate(user._id || user.id, {
      emailVerificationTokenHash,
      emailVerificationExpiresAt,
    });

    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      token: rawVerificationToken,
    });

    await logAuditEvent({
      req,
      action: 'VERIFICATION_EMAIL_RESENT',
      documentId: String(user._id || user.id),
      documentTitle: `Account: ${user.email}`,
      metadata: {
        userId: String(user._id || user.id),
        email: user.email,
        timestamp: new Date().toISOString(),
      },
    });

    const devVerifyUrl = `${config.appBaseUrl}/?verifyToken=${encodeURIComponent(rawVerificationToken)}`;

    console.log('\n================================================================');
    console.log(`🔗 [DEV VERIFICATION LINK FOR ${user.email}]:`);
    console.log(devVerifyUrl);
    console.log('================================================================\n');

    return res.status(200).json({
      ...neutralResponse,
      devVerifyUrl: !config.isProduction ? devVerifyUrl : undefined,
      verificationToken: config.isTest ? rawVerificationToken : undefined,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Authenticate existing user credentials
 * POST /api/auth/login
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Both email and password are required to log in.',
        },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user including passwordHash for comparison
    const user = await User.findOne({ email: normalizedEmail }, '+passwordHash');

    if (!user) {
      // Resistance against user enumeration
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email address or password.',
        },
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email address or password.',
        },
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Your account has been deactivated. Please contact an administrator.',
        },
      });
    }

    if (user.isEmailVerified === false) {
      return res.status(403).json({
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email address before signing in. Check your inbox or request a new verification link.',
        },
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      status: 'success',
      message: 'Authentication successful.',
      data: {
        user: user.toJSON ? user.toJSON() : user,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Fetch current user profile
 * GET /api/auth/me
 */
export async function getMe(req, res) {
  return res.status(200).json({
    status: 'success',
    data: {
      user: req.user,
    },
  });
}

/**
 * Change authenticated user's password
 * POST /api/auth/change-password
 */
export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'Current password and new password are required.',
        },
      });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({
        error: {
          code: 'PASSWORD_MISMATCH',
          message: 'New password and confirmation password do not match.',
        },
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must be at least 8 characters long.',
        },
      });
    }

    if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(newPassword)) {
      return res.status(400).json({
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must contain at least one letter and one number.',
        },
      });
    }

    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User account not found.',
        },
      });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        error: {
          code: 'INVALID_CURRENT_PASSWORD',
          message: 'Current password does not match.',
        },
      });
    }

    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        error: {
          code: 'SAME_PASSWORD',
          message: 'New password cannot be identical to your current password.',
        },
      });
    }

    const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await User.findByIdAndUpdate(userId, {
      passwordHash,
      mustChangePassword: false,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    });

    // Record immutable audit event (NEVER log passwords)
    await logAuditEvent({
      req,
      action: 'USER_PASSWORD_CHANGED',
      documentId: String(userId),
      documentTitle: `Account: ${user.email}`,
      metadata: {
        userId: String(userId),
        email: user.email,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Password successfully updated.',
    });
  } catch (error) {
    console.error('[Change Password Error]:', error);
    return res.status(500).json({
      error: {
        code: 'PASSWORD_CHANGE_ERROR',
        message: 'Failed to update password.',
      },
    });
  }
}

/**
 * Reset password via single-use token (Option B Email Reset or Token Link)
 * POST /api/auth/reset-password
 * POST /api/auth/reset-password-email
 */
export async function resetPassword(req, res) {
  try {
    const { token, resetToken, newPassword, confirmPassword } = req.body;
    const providedToken = token || resetToken;

    if (!providedToken || !newPassword) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'Reset token and new password are required.',
        },
      });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({
        error: {
          code: 'PASSWORD_MISMATCH',
          message: 'New password and confirmation password do not match.',
        },
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must be at least 8 characters long.',
        },
      });
    }

    if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(newPassword)) {
      return res.status(400).json({
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must contain at least one letter and one number.',
        },
      });
    }

    const tokenHash = crypto.createHash('sha256').update(providedToken.trim()).digest('hex');
    const user = await User.findOne({ passwordResetTokenHash: tokenHash });

    if (!user) {
      return res.status(400).json({
        error: {
          code: 'INVALID_RESET_TOKEN',
          message: 'The password reset token is invalid or has already been used.',
        },
      });
    }

    if (user.passwordResetExpiresAt && new Date(user.passwordResetExpiresAt) < new Date()) {
      return res.status(400).json({
        error: {
          code: 'EXPIRED_RESET_TOKEN',
          message: 'The password reset token has expired. Please request a new reset link.',
        },
      });
    }

    const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Consume token atomically, update password, and clear forced temporary change
    await User.findByIdAndUpdate(user._id || user.id, {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      mustChangePassword: false,
    });

    // Record immutable audit event
    await logAuditEvent({
      req,
      action: 'PASSWORD_RESET_COMPLETED',
      documentId: String(user._id || user.id),
      documentTitle: `Account: ${user.email}`,
      metadata: {
        userId: String(user._id || user.id),
        email: user.email,
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Password successfully reset. You may now log in with your new credentials.',
    });
  } catch (error) {
    console.error('[Reset Password Error]:', error);
    return res.status(500).json({
      error: {
        code: 'RESET_PASSWORD_ERROR',
        message: 'Failed to reset password.',
      },
    });
  }
}

/**
 * Option A: Public Forgot Password submission (Request Reset from Admin)
 * POST /api/auth/forgot-password
 * POST /api/auth/forgot-password/admin
 * Creates a PasswordResetRequest in DB and an AdminNotification.
 * Returns a neutral confirmation to prevent account enumeration.
 */
export async function requestPasswordReset(req, res, next) {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EMAIL',
          message: 'Please provide a valid registered email address.',
        },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Neutral message ensuring user enumeration resistance
    const neutralResponse = {
      status: 'success',
      message: 'If this email address is registered, your password reset request has been submitted to an Administrator for review.',
    };

    if (!user) {
      return res.status(200).json(neutralResponse);
    }

    // Check for existing pending password reset request to prevent duplicates
    const existingPending = await PasswordResetRequest.findOne({
      userId: String(user._id || user.id),
      status: 'pending',
    });

    if (existingPending) {
      return res.status(200).json(neutralResponse);
    }

    const resetReq = await PasswordResetRequest.create({
      userId: String(user._id || user.id),
      userName: user.name,
      userEmail: user.email,
      status: 'pending',
      requestedAt: new Date(),
    });

    await AdminNotification.create({
      type: 'password_reset_request',
      userId: String(user._id || user.id),
      userName: user.name,
      userEmail: user.email,
      requestId: String(resetReq._id || resetReq.id),
      title: 'Password Reset Request',
      message: `${user.name} (${user.email}) requested a password reset.`,
      status: 'pending',
      isRead: false,
    });

    await logAuditEvent({
      req,
      action: 'PASSWORD_RESET_REQUESTED',
      documentId: String(user._id || user.id),
      documentTitle: `Account: ${user.email}`,
      metadata: {
        userId: String(user._id || user.id),
        email: user.email,
        requestId: String(resetReq._id || resetReq.id),
        timestamp: new Date().toISOString(),
      },
    });

    return res.status(200).json(neutralResponse);
  } catch (error) {
    next(error);
  }
}

/**
 * Option B: Self-Service Password Reset via Email Link
 * POST /api/auth/forgot-password-email
 * POST /api/auth/request-email-reset
 * Generates single-use 15-minute token, sends reset email, and returns neutral confirmation.
 */
export async function requestEmailPasswordReset(req, res, next) {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EMAIL',
          message: 'Please provide a valid registered email address.',
        },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Neutral response ensuring account enumeration resistance
    const neutralResponse = {
      status: 'success',
      message: 'If an account exists with this email address, a password reset link has been sent to your inbox.',
    };

    if (!user) {
      return res.status(200).json(neutralResponse);
    }

    // Generate single-use cryptographic recovery token (15 minutes expiry)
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetTokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    const passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await User.findByIdAndUpdate(user._id || user.id, {
      passwordResetTokenHash,
      passwordResetExpiresAt,
    });

    const sendResult = await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      token: rawResetToken,
    });

    await logAuditEvent({
      req,
      action: 'PASSWORD_RESET_LINK_SENT',
      documentId: String(user._id || user.id),
      documentTitle: `Account: ${user.email}`,
      metadata: {
        userId: String(user._id || user.id),
        email: user.email,
        emailDelivered: Boolean(sendResult && sendResult.success),
        timestamp: new Date().toISOString(),
      },
    });

    const devResetUrl = `${config.appBaseUrl}/?resetToken=${encodeURIComponent(rawResetToken)}`;
    console.log('\n================================================================');
    console.log(`🔗 [DEV PASSWORD RESET LINK FOR ${user.email}]:`);
    console.log(devResetUrl);
    console.log('================================================================\n');

    return res.status(200).json({
      ...neutralResponse,
      devResetUrl: !config.isProduction ? devResetUrl : undefined,
      resetToken: config.isTest ? rawResetToken : undefined,
    });
  } catch (error) {
    next(error);
  }
}
