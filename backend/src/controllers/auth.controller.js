/**
 * TrustVault Backend - Authentication Controller
 * Handles user registration, login, and profile retrieval.
 * Security features:
 * - Minimum 12 salt rounds with bcrypt
 * - THREAT-06 Mitigation: Client cannot escalate privileges by supplying role: 'admin'
 * - Account enumeration resistance: Generic invalid credential messages
 * - Never returns passwordHash in responses
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/user.model.js';
import { AdminNotification } from '../models/notification.model.js';
import { PasswordResetRequest } from '../models/passwordResetRequest.model.js';
import { generateToken } from '../utils/token.js';
import { logAuditEvent } from '../services/audit.service.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      return res.status(409).json({
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email address is already registered.',
        },
      });
    }

    // 3. Process requested account type (Viewer vs Owner)
    // The selection represents the user's requested role, not an automatically granted privilege.
    // Client can supply requestedRole or accountType ('viewer' | 'owner')
    // Client-supplied 'role' field (e.g. role: 'admin' or role: 'owner') is strictly rejected/ignored for THREAT-06 mitigation.
    const rawRequested = String(req.body.requestedRole || req.body.accountType || '').toLowerCase().trim();
    const isOwnerRequested = rawRequested === 'owner';

    // Effective role is strictly 'viewer' upon public registration!
    const role = 'viewer';
    const requestedRole = isOwnerRequested ? 'owner' : 'viewer';
    const ownerApprovalStatus = isOwnerRequested ? 'pending' : 'not_required';
    const ownerApprovalRequestedAt = isOwnerRequested ? new Date() : null;

    // 4. Create user record with hashed password
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

    // 5. Generate authentication token
    const token = generateToken(user);

    const message = isOwnerRequested
      ? 'Account registered successfully. Your Owner access request is pending Admin approval. You can continue using your Viewer account while you wait.'
      : 'User account created successfully.';

    // 6. Respond with created user (toJSON strips passwordHash)
    return res.status(201).json({
      status: 'success',
      message,
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

    const salt = await bcrypt.genSalt(12);
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
 * Reset password via single-use token
 * POST /api/auth/reset-password
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
          message: 'The password reset token has expired. Please request a new reset from your administrator.',
        },
      });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

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
 * Public Forgot Password submission
 * POST /api/auth/forgot-password
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

    // Neutral message ensuring user enumeration resistance (Requirement 2.9)
    const neutralResponse = {
      status: 'success',
      message: 'If this email address is registered, your password reset request has been submitted to an Administrator for review.',
    };

    if (!user) {
      return res.status(200).json(neutralResponse);
    }

    // Check for existing pending password reset request to prevent duplicates (Requirement 2.8)
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

