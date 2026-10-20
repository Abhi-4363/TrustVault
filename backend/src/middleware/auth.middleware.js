/**
 * TrustVault Backend - Authentication & Authorization Middleware
 * Enforces JWT token validation and Role-Based Access Control (RBAC).
 */

import { verifyToken } from '../utils/token.js';
import { User } from '../models/user.model.js';

/**
 * Protects endpoints by requiring a valid JWT Bearer token
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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

    req.user = {
      id: user._id.toString ? user._id.toString() : user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

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
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required prior to permission verification.',
        },
      });
    }

    if (!roles.includes(req.user.role)) {
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
