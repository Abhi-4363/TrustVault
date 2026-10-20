/**
 * TrustVault Backend - Secure File Upload Middleware
 * Utilises Multer with private disk storage isolated outside web roots.
 * Enforces 25MB file size limit and assigns cryptographic UUIDs to prevent traversal.
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Private storage directory outside public roots
export const STORAGE_DIR = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.resolve(__dirname, '../../storage/uploads');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, STORAGE_DIR);
  },
  filename: (req, file, cb) => {
    // Sanitize extension and assign unique crypto UUID
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

// File filter: reject executable scripts and binaries
const blockedExtensions = new Set(['.exe', '.bat', '.cmd', '.sh', '.bin', '.msi', '.vbs', '.ps1']);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (blockedExtensions.has(ext)) {
    const error = new Error('Executable and potentially hazardous file types are strictly prohibited.');
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }
  cb(null, true);
};

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter,
});

/**
 * Express wrapper middleware to format Multer errors into standard API JSON error format
 */
export function handleFileUpload(req, res, next) {
  const singleUpload = upload.single('file');

  singleUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: {
            code: 'FILE_TOO_LARGE',
            message: `File exceeds maximum allowed size limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
          },
        });
      }
      return res.status(400).json({
        error: {
          code: 'UPLOAD_ERROR',
          message: err.message,
        },
      });
    } else if (err) {
      return res.status(400).json({
        error: {
          code: err.code || 'UPLOAD_FAILED',
          message: err.message,
        },
      });
    }
    next();
  });
}
