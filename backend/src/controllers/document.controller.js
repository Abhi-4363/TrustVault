/**
 * TrustVault Backend - Document Controller
 * Handles document ingestion, metadata indexing, secure streaming download,
 * and lifecycle management with strict tenant authorization.
 */

import fs from 'fs';
import path from 'path';
import { Document } from '../models/document.model.js';

/**
 * Sanitises document object for client responses, stripping internal server storage paths
 */
function sanitizeDocument(doc) {
  const plain = doc.toJSON ? doc.toJSON() : { ...doc };
  const { storagePath, ...safeMetadata } = plain;
  return safeMetadata;
}

/**
 * Checks whether the given user has read authorization for the document
 */
function canReadDocument(doc, user) {
  if (!doc || !user) return false;
  const userId = String(user.id || user._id);
  const ownerId = String(doc.ownerId);

  // Document owner has full access
  if (userId === ownerId) return true;

  // Platform administrator has governance access
  if (user.role === 'admin') return true;

  // Granted reader access
  if (Array.isArray(doc.readers) && doc.readers.some((r) => String(r) === userId)) {
    return true;
  }

  return false;
}

/**
 * Checks whether the given user has delete/manage authorization for the document
 */
function canManageDocument(doc, user) {
  if (!doc || !user) return false;
  const userId = String(user.id || user._id);
  const ownerId = String(doc.ownerId);

  return userId === ownerId || user.role === 'admin';
}

/**
 * POST /api/documents
 * Securely uploads file binary to private storage and indexes metadata
 */
export async function uploadDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: {
          code: 'NO_FILE_PROVIDED',
          message: 'A file attachment is required.',
        },
      });
    }

    const title = (req.body.title || req.file.originalname).trim();
    const description = (req.body.description || '').trim();

    // Parse optional tags (array or comma-delimited string)
    let tags = [];
    if (req.body.tags) {
      if (Array.isArray(req.body.tags)) {
        tags = req.body.tags;
      } else if (typeof req.body.tags === 'string') {
        try {
          const parsed = JSON.parse(req.body.tags);
          tags = Array.isArray(parsed) ? parsed : [req.body.tags];
        } catch {
          tags = req.body.tags.split(',').map((t) => t.trim()).filter(Boolean);
        }
      }
    }

    const userId = req.user.id || req.user._id;

    const documentData = {
      title,
      description,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype || 'application/octet-stream',
      storagePath: req.file.path,
      ownerId: userId,
      tags,
      readers: [],
    };

    const createdDoc = await Document.create(documentData);

    return res.status(201).json({
      message: 'Document uploaded and metadata indexed securely.',
      document: sanitizeDocument(createdDoc),
    });
  } catch (error) {
    // If database insertion fails, cleanup orphaned disk file
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        console.error('[Upload Cleanup Error] Failed to remove orphaned file:', cleanupErr);
      }
    }

    console.error('[Document Upload Error]:', error);
    return res.status(500).json({
      error: {
        code: 'UPLOAD_PROCESSING_ERROR',
        message: 'An error occurred while storing document metadata.',
      },
    });
  }
}

/**
 * GET /api/documents
 * Lists documents accessible to the requesting user
 */
export async function listDocuments(req, res) {
  try {
    const userId = String(req.user.id || req.user._id);

    // Fetch documents where user is owner
    let allDocs = await Document.find();

    // Filter documents where user is owner, reader, or admin
    const accessibleDocs = allDocs.filter((doc) => canReadDocument(doc, req.user));

    return res.status(200).json({
      documents: accessibleDocs.map(sanitizeDocument),
    });
  } catch (error) {
    console.error('[Document List Error]:', error);
    return res.status(500).json({
      error: {
        code: 'DOCUMENT_LIST_ERROR',
        message: 'Unable to retrieve document collection.',
      },
    });
  }
}

/**
 * GET /api/documents/:id
 * Retrieves metadata for a single document
 */
export async function getDocumentById(req, res) {
  try {
    const { id } = req.params;
    const doc = await Document.findById(id);

    if (!doc) {
      return res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Requested document does not exist.',
        },
      });
    }

    if (!canReadDocument(doc, req.user)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this document.',
        },
      });
    }

    return res.status(200).json({
      document: sanitizeDocument(doc),
    });
  } catch (error) {
    console.error('[Get Document Error]:', error);
    return res.status(500).json({
      error: {
        code: 'DOCUMENT_FETCH_ERROR',
        message: 'Failed to retrieve document details.',
      },
    });
  }
}

/**
 * GET /api/documents/:id/download
 * Securely streams the private document binary with forced attachment headers
 */
export async function downloadDocument(req, res) {
  try {
    const { id } = req.params;
    const doc = await Document.findById(id);

    if (!doc) {
      return res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Requested document does not exist.',
        },
      });
    }

    if (!canReadDocument(doc, req.user)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to download this document.',
        },
      });
    }

    if (!fs.existsSync(doc.storagePath)) {
      return res.status(404).json({
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Document binary file is missing from private storage.',
        },
      });
    }

    // Force download disposition with escaped/quoted filename
    const safeFilename = path.basename(doc.originalName).replace(/"/g, '');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', doc.fileSize);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const stream = fs.createReadStream(doc.storagePath);
    stream.on('error', (streamErr) => {
      console.error('[Download Stream Error]:', streamErr);
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            code: 'STREAM_ERROR',
            message: 'Failed to read document stream.',
          },
        });
      }
    });

    stream.pipe(res);
  } catch (error) {
    console.error('[Document Download Error]:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: {
          code: 'DOWNLOAD_FAILED',
          message: 'Failed to download document.',
        },
      });
    }
  }
}

/**
 * DELETE /api/documents/:id
 * Deletes document metadata and removes private file binary from disk
 */
export async function deleteDocument(req, res) {
  try {
    const { id } = req.params;
    const doc = await Document.findById(id);

    if (!doc) {
      return res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Requested document does not exist.',
        },
      });
    }

    if (!canManageDocument(doc, req.user)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only the document owner or an administrator can delete this document.',
        },
      });
    }

    // Remove from database
    await Document.findByIdAndDelete(id);

    // Remove from physical disk
    if (fs.existsSync(doc.storagePath)) {
      try {
        fs.unlinkSync(doc.storagePath);
      } catch (unlinkErr) {
        console.error('[Delete File Error] Could not unlink binary:', unlinkErr);
      }
    }

    return res.status(200).json({
      message: 'Document and private file successfully removed.',
      id,
    });
  } catch (error) {
    console.error('[Document Delete Error]:', error);
    return res.status(500).json({
      error: {
        code: 'DELETE_FAILED',
        message: 'Failed to remove document.',
      },
    });
  }
}
