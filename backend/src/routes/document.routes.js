/**
 * TrustVault Backend - Document Routes (Stage 5 & 6 Enhanced)
 * Provides authenticated routes for ingestion, listing, streaming download,
 * metadata editing, ACL permissions, and immutable audit trail inspection.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { handleFileUpload } from '../middleware/upload.middleware.js';
import { validateFileSignature } from '../middleware/fileSignature.middleware.js';
import {
  validateAndSanitizeDocumentInput,
  validateAndSanitizeSearchInput,
} from '../middleware/sanitization.middleware.js';
import {
  uploadDocument,
  listDocuments,
  searchDocuments,
  getDocumentById,
  updateDocument,
  downloadDocument,
  deleteDocument,
  getDocumentPermissions,
  grantDocumentPermission,
  revokeDocumentPermission,
  getDirectoryUsers,
  getDocumentAuditTrail,
  getRecentAuditActivity,
  updateDocumentVisibility,
} from '../controllers/document.controller.js';

const router = Router();

// Ingest new document (multipart/form-data) with signature and sanitization validation
router.post(
  '/',
  requireAuth,
  handleFileUpload,
  validateFileSignature,
  validateAndSanitizeDocumentInput,
  uploadDocument
);

// List accessible documents for authenticated user
router.get('/', requireAuth, listDocuments);

// Scoped search endpoint (placed before /:id)
router.get('/search', requireAuth, validateAndSanitizeSearchInput, searchDocuments);

// User directory lookup for collaborator selection (placed before /:id)
router.get('/users/directory', requireAuth, getDirectoryUsers);

// Recent activity audit logs across documents (placed before /:id)
router.get('/audit/activity', requireAuth, getRecentAuditActivity);

// Retrieve document metadata
router.get('/:id', requireAuth, getDocumentById);

// Update document metadata (Requires Edit Permission and Input Sanitization)
router.patch('/:id', requireAuth, validateAndSanitizeDocumentInput, updateDocument);

// Update document visibility (Requires Ownership or Admin)
router.patch('/:id/visibility', requireAuth, updateDocumentVisibility);

// Secure streaming download with forced attachment disposition
router.get('/:id/download', requireAuth, downloadDocument);

// Delete document and remove private binary
router.delete('/:id', requireAuth, deleteDocument);

// Retrieve document Access Control List (ACL)
router.get('/:id/permissions', requireAuth, getDocumentPermissions);

// Grant or elevate access permissions (Requires Ownership or Admin)
router.post('/:id/permissions', requireAuth, grantDocumentPermission);

// Revoke access permission (Requires Ownership or Admin)
router.delete('/:id/permissions/:targetUserId', requireAuth, revokeDocumentPermission);

// Retrieve immutable audit trail for a specific document (Owner or Admin only)
router.get('/:id/audit', requireAuth, getDocumentAuditTrail);

export default router;
