/**
 * TrustVault Backend - Authentication & Authorization Middleware
 * Enforces JWT token validation and Role-Based Access Control (RBAC).
 */

import { verifyToken } from '../utils/token.js';
import { User } from '../models/user.model.js';
import { logAuditEvent } from '../services/audit.service.js';

/**
 * Protects endpoints by requiring a valid JWT Bearer token
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('multipart/form-data')) {
        req.on('data', () => {});
        req.on('end', () => {
          if (!res.headersSent) {
            res.status(401).json({
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication token is required. Please include Authorization: Bearer <token>',
              },
            });
          }
        });
        req.resume();
        return;
      }

      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token is required. Please include Authorization: Bearer <token>',
        },
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Verify user still exists in database
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The user account associated with this token no longer exists.',
        },
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'This user account has been deactivated by an administrator.',
        },
      });
    }

    req.user = {
      id: user._id.toString ? user._id.toString() : user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      requestedRole: user.requestedRole || null,
      ownerApprovalStatus: user.ownerApprovalStatus || 'not_required',
      ownerApprovalRequestedAt: user.ownerApprovalRequestedAt || null,
      ownerApprovalReviewedAt: user.ownerApprovalReviewedAt || null,
      ownerApprovalReviewedByName: user.ownerApprovalReviewedByName || null,
      roleChangeReason: user.roleChangeReason || '',
      mustChangePassword: Boolean(user.mustChangePassword),
      isActive: user.isActive !== false,
      isEmailVerified: user.isEmailVerified !== false,
      createdAt: user.createdAt,
    };

    // Email verification boundary:
    // Unverified accounts cannot access documents, upload, download, or manage permissions
    if (user.isEmailVerified === false) {
      const allowedUnverifiedPaths = ['/api/auth/me', '/api/auth/resend-verification'];
      const currentUrl = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;
      const isAllowed = allowedUnverifiedPaths.some((p) => currentUrl.endsWith(p) || currentUrl === p);
      if (!isAllowed) {
        return res.status(403).json({
          error: {
            code: 'EMAIL_NOT_VERIFIED',
            message: 'Your email address is not verified. Please check your inbox or request a new verification link.',
          },
        });
      }
    }

    // Mandatory temporary password policy:
    // When mustChangePassword is true, user can ONLY call /api/auth/change-password and /api/auth/me
    if (user.mustChangePassword === true) {
      const allowedPaths = ['/api/auth/change-password', '/api/auth/me'];
      const currentUrl = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;
      const isAllowed = allowedPaths.some((p) => currentUrl.endsWith(p) || currentUrl === p);
      if (!isAllowed) {
        return res.status(403).json({
          error: {
            code: 'PASSWORD_CHANGE_REQUIRED',
            message: 'Temporary password detected. You must choose a new password before accessing any other protected TrustVault functionality.',
          },
        });
      }
    }

    next();
  } catch (error) {
    return res.status(error.statusCode || 401).json({
      error: {
        code: error.code || 'UNAUTHORIZED',
        message: error.message || 'Invalid authentication token',
      },
    });
  }
}

/**
 * Enforces Role-Based Access Control (RBAC)
 * @param  {...string} roles - Permitted roles (e.g. 'admin', 'manager')
 */
export function requireRole(...roles) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required prior to permission verification.',
        },
      });
    }

    if (!roles.includes(req.user.role)) {
      try {
        await logAuditEvent({
          req,
          action: 'ACCESS_DENIED',
          documentId: 'ADMIN_GOVERNANCE',
          documentTitle: 'Administrative Operation Refused',
          metadata: {
            attemptedEndpoint: req.originalUrl || req.url,
            attemptedMethod: req.method,
            callerRole: req.user.role,
            requiredRoles: roles,
            reason: 'User lacks required privileges for administrative management.',
          },
        });
      } catch (err) {
        // Non-blocking fallback
      }

      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires one of the following roles: ${roles.join(', ')}.`,
        },
      });
    }

    next();
  };
}
