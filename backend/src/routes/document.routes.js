/**
 * TrustVault Backend - Document Routes
 * Provides authenticated routes for ingestion, listing, streaming download, and deletion.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { handleFileUpload } from '../middleware/upload.middleware.js';
import {
  uploadDocument,
  listDocuments,
  getDocumentById,
  downloadDocument,
  deleteDocument,
} from '../controllers/document.controller.js';

const router = Router();

// Ingest new document (multipart/form-data)
router.post('/', requireAuth, handleFileUpload, uploadDocument);

// List accessible documents for authenticated user
router.get('/', requireAuth, listDocuments);

// Retrieve document metadata
router.get('/:id', requireAuth, getDocumentById);

// Secure streaming download with forced attachment disposition
router.get('/:id/download', requireAuth, downloadDocument);

// Delete document and remove private binary
router.delete('/:id', requireAuth, deleteDocument);

export default router;
