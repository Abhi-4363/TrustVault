/**
 * TrustVault Backend - Token Utilities
 * Generates and verifies cryptographic JSON Web Tokens (JWT).
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

/**
 * Signs a JWT with user identity and role payload
 */
export function generateToken(user) {
  const payload = {
    id: user._id.toString ? user._id.toString() : user._id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

/**
 * Verifies a JWT and returns decoded payload
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const error = new Error('Authentication token has expired. Please log in again.');
      error.code = 'TOKEN_EXPIRED';
      error.statusCode = 401;
      throw error;
    }
    const error = new Error('Invalid authentication token.');
    error.code = 'INVALID_TOKEN';
    error.statusCode = 401;
    throw error;
  }
}
