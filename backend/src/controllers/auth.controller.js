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

    // 3. THREAT-06 Mitigation: Enforce default 'member' role regardless of client payload
    const role = 'member';

    // 4. Create user record with hashed password
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,
    });

    // 5. Generate authentication token
    const token = generateToken(user);

    // 6. Respond with created user (toJSON strips passwordHash)
    return res.status(201).json({
      status: 'success',
      message: 'User account created successfully.',
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
