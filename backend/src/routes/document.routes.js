/**
 * TrustVault Backend - Document Routes (Stage 4 Enhanced)
 * Provides authenticated routes for ingestion, listing, streaming download,
 * metadata editing, and granular ACL permission sharing/revocation.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { handleFileUpload } from '../middleware/upload.middleware.js';
import {
  uploadDocument,
  listDocuments,
  getDocumentById,
  updateDocument,
  downloadDocument,
  deleteDocument,
  getDocumentPermissions,
  grantDocumentPermission,
  revokeDocumentPermission,
  getDirectoryUsers,
} from '../controllers/document.controller.js';

const router = Router();

// Ingest new document (multipart/form-data)
router.post('/', requireAuth, handleFileUpload, uploadDocument);

// List accessible documents for authenticated user
router.get('/', requireAuth, listDocuments);

// User directory lookup for collaborator selection (placed before /:id)
router.get('/users/directory', requireAuth, getDirectoryUsers);

// Retrieve document metadata
router.get('/:id', requireAuth, getDocumentById);

// Update document metadata (Requires Edit Permission)
router.patch('/:id', requireAuth, updateDocument);

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

export default router;
