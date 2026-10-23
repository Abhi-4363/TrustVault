/**
 * TrustVault Backend - Environment Configuration
 * Centralises environment variable reading, defaults, and type casting.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env relative to the backend directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const cleanStr = (val, fallback = '') => {
  if (!val) return fallback;
  return String(val)
    .replace(/[\[\]"'`]/g, '')
    .replace(/^mailto:/i, '')
    .trim();
};

export const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: cleanStr(process.env.CLIENT_URL, 'http://localhost:5173'),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/trustvault_dev',
  jwtSecret: process.env.JWT_SECRET || 'trustvault_dev_fallback_secret_min32chars',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  // Email Service Configuration
  emailFrom: cleanStr(process.env.EMAIL_FROM, 'konagallaabhiram@gmail.com'),
  smtpHost: cleanStr(process.env.SMTP_HOST, 'smtp.gmail.com'),
  smtpPort: parseInt(process.env.SMTP_PORT, 10) || 587,
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: cleanStr(process.env.SMTP_USER, ''),
  smtpPass: cleanStr(process.env.SMTP_PASS, '').replace(/\s+/g, ''),
  appBaseUrl: cleanStr(process.env.APP_BASE_URL || process.env.CLIENT_URL, 'http://localhost:5173'),
  // Transactional Email HTTPS APIs (Compatible with Render where direct SMTP ports are restricted)
  emailProvider: cleanStr(process.env.EMAIL_PROVIDER, '').toLowerCase(),
  resendApiKey: cleanStr(process.env.RESEND_API_KEY, ''),
  brevoApiKey: cleanStr(process.env.BREVO_API_KEY, ''),
};


