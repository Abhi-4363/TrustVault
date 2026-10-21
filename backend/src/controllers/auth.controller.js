/**
 * TrustVault Backend - Authentication Controller
 * Handles user registration, login, and profile retrieval.
 * Security features:
 * - Minimum 12 salt rounds with bcrypt
 * - THREAT-06 Mitigation: Client cannot escalate privileges by supplying role: 'admin'
 * - Account enumeration resistance: Generic invalid credential messages
 * - Never returns passwordHash in responses
 */

import { User } from '../models/user.model.js';
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
