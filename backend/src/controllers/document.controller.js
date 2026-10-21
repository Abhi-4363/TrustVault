/**
 * TrustVault Backend - Document Controller (Stage 5 & 6 Enhanced)
 * Handles document ingestion, metadata indexing, secure streaming download,
 * lifecycle management, fine-grained ACL permissions, immediate revocation engine,
 * and immutable append-only audit trail event tracking.
 */

import fs from 'fs';
import path from 'path';
import { Document } from '../models/document.model.js';
import { User } from '../models/user.model.js';
import { AuditLog } from '../models/audit.model.js';
import { logAuditEvent } from '../services/audit.service.js';
import {
  registerImmediateRevocation,
  isAccessImmediatelyRevoked,
} from '../services/revocation.service.js';
import { STORAGE_DIR } from '../middleware/upload.middleware.js';

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
export function canReadDocument(doc, user) {
  if (!doc || !user) return false;
  if (user.isActive === false) return false;
  const userId = String(user.id || user._id);
  const userEmail = (user.email || '').toLowerCase().trim();
  const ownerId = String(doc.ownerId);
  const ownerEmail = (doc.ownerEmail || '').toLowerCase().trim();

  // Document owner has full access
  if (userId === ownerId || (ownerEmail && userEmail && ownerEmail === userEmail)) return true;

  // Platform administrator has governance access
  if (user.role === 'admin') return true;

  // Check granular ACL entry (by userId or userEmail)
  if (Array.isArray(doc.acl)) {
    const hasAclAccess = doc.acl.some(
      (entry) => {
        const level = String(entry.permissionLevel || '').toLowerCase().trim();
        return (
          (String(entry.userId) === userId ||
            (entry.email && entry.email.toLowerCase().trim() === userEmail)) &&
          (level === 'read' || level === 'view' || level === 'edit')
        );
      }
    );
    if (hasAclAccess) return true;
  }

  // Legacy readers array check
  if (
    Array.isArray(doc.readers) &&
    doc.readers.some(
      (r) => String(r) === userId || (userEmail && String(r).toLowerCase().trim() === userEmail)
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Checks whether the given user has edit authorization for the document
 */
export function canEditDocument(doc, user) {
  if (!doc || !user) return false;
  if (user.isActive === false) return false;
  const userId = String(user.id || user._id);
  const userEmail = (user.email || '').toLowerCase().trim();
  const ownerId = String(doc.ownerId);
  const ownerEmail = (doc.ownerEmail || '').toLowerCase().trim();

  if (userId === ownerId || (ownerEmail && userEmail && ownerEmail === userEmail)) return true;
  if (user.role === 'admin') return true;

  if (Array.isArray(doc.acl)) {
    const hasEditAcl = doc.acl.some(
      (entry) => {
        const level = String(entry.permissionLevel || '').toLowerCase().trim();
        return (
          (String(entry.userId) === userId ||
            (entry.email && entry.email.toLowerCase().trim() === userEmail)) &&
          level === 'edit'
        );
      }
    );
    if (hasEditAcl) return true;
  }

  return false;
}

/**
 * Checks whether the given user has delete/manage authorization for the document
 */
export function canManageDocument(doc, user) {
  if (!doc || !user) return false;
  const userId = String(user.id || user._id);
  const userEmail = (user.email || '').toLowerCase().trim();
  const ownerId = String(doc.ownerId);
  const ownerEmail = (doc.ownerEmail || '').toLowerCase().trim();

  return (
    userId === ownerId ||
    (ownerEmail && userEmail && ownerEmail === userEmail) ||
    user.role === 'admin'
  );
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

    if (req.user && req.user.role === 'viewer') {
      if (req.file && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. Viewers are restricted to read-only access and cannot upload documents.',
        },
      });
    }

    const title = (req.body.title || req.file.originalname).trim();
    const description = (req.body.description || '').trim();

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
      ownerName: req.user.name || '',
      ownerEmail: req.user.email ? req.user.email.toLowerCase().trim() : '',
      tags,
      acl: [],
      readers: [],
    };

    const createdDoc = await Document.create(documentData);

    // Audit log recording (Stage 6)
    await logAuditEvent({
      req,
      action: 'DOCUMENT_UPLOAD',
      documentId: createdDoc._id,
      documentTitle: createdDoc.title,
      metadata: {
        fileSize: createdDoc.fileSize,
        mimeType: createdDoc.mimeType,
      },
    });

    return res.status(201).json({
      message: 'Document uploaded and metadata indexed securely.',
      document: sanitizeDocument(createdDoc),
    });
  } catch (error) {
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
 * Lists documents accessible to the requesting user (owned or granted read/edit access)
 */
export async function listDocuments(req, res) {
  try {
    const userId = String(req.user.id || req.user._id);
    const userEmail = (req.user.email || '').toLowerCase().trim();

    let allDocs = await Document.find();
    const accessibleDocs = allDocs.filter(
      (doc) =>
        !isAccessImmediatelyRevoked(doc._id, userId) &&
        (!userEmail || !isAccessImmediatelyRevoked(doc._id, userEmail)) &&
        canReadDocument(doc, req.user)
    );

    // Directory lookup to resolve owner details if needed
    let userMap = new Map();
    try {
      const allUsers = await User.find();
      (allUsers || []).forEach((u) => {
        const uid = String(u._id || u.id);
        userMap.set(uid, u);
        if (u.email) userMap.set(u.email.toLowerCase().trim(), u);
      });
    } catch {
      // Non-blocking in-memory fallback
    }

    return res.status(200).json({
      documents: accessibleDocs.map((doc) => {
        const sanitized = sanitizeDocument(doc);
        const ownerId = String(doc.ownerId);
        const ownerEmail = (doc.ownerEmail || '').toLowerCase().trim();
        const isOwner = userId === ownerId || (ownerEmail && userEmail && ownerEmail === userEmail);

        let accessLevel = 'Reader';
        if (isOwner) {
          accessLevel = 'Owner';
        } else if (Array.isArray(doc.acl)) {
          const entry = doc.acl.find(
            (a) =>
              String(a.userId) === userId ||
              (a.email && a.email.toLowerCase().trim() === userEmail)
          );
          if (entry) {
            const lvl = String(entry.permissionLevel || '').toLowerCase().trim();
            accessLevel = lvl === 'edit' ? 'Editor' : 'Reader';
          } else if (req.user.role === 'admin') {
            accessLevel = 'Admin';
          }
        } else if (req.user.role === 'admin') {
          accessLevel = 'Admin';
        }

        const ownerUser = userMap.get(ownerId) || (ownerEmail ? userMap.get(ownerEmail) : null);
        const owner = {
          id: ownerId,
          name: doc.ownerName || ownerUser?.name || 'Document Owner',
          email: doc.ownerEmail || ownerUser?.email || '',
        };

        return { ...sanitized, accessLevel, owner };
      }),
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

    const userId = String(req.user.id || req.user._id);
    const userEmail = (req.user.email || '').toLowerCase().trim();

    // Stage 5 check: immediate revocation validation
    if (isAccessImmediatelyRevoked(id, userId) || !canReadDocument(doc, req.user)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this document.',
        },
      });
    }

    const ownerId = String(doc.ownerId);
    const ownerEmail = (doc.ownerEmail || '').toLowerCase().trim();
    const isOwner = userId === ownerId || (ownerEmail && userEmail && ownerEmail === userEmail);

    let accessLevel = 'Reader';
    if (isOwner) {
      accessLevel = 'Owner';
    } else if (Array.isArray(doc.acl)) {
      const entry = doc.acl.find(
        (a) =>
          String(a.userId) === userId ||
          (a.email && a.email.toLowerCase().trim() === userEmail)
      );
      if (entry) {
        const lvl = String(entry.permissionLevel || '').toLowerCase().trim();
        accessLevel = lvl === 'edit' ? 'Editor' : 'Reader';
      } else if (req.user.role === 'admin') {
        accessLevel = 'Admin';
      }
    } else if (req.user.role === 'admin') {
      accessLevel = 'Admin';
    }

    let ownerUser = null;
    try {
      ownerUser = await User.findById(ownerId);
    } catch {
      // Non-blocking
    }

    const owner = {
      id: ownerId,
      name: doc.ownerName || ownerUser?.name || 'Document Owner',
      email: doc.ownerEmail || ownerUser?.email || '',
    };

    // Audit log recording (Stage 6)
    await logAuditEvent({
      req,
      action: 'DOCUMENT_READ',
      documentId: doc._id,
      documentTitle: doc.title,
    });

    return res.status(200).json({
      document: {
        ...sanitizeDocument(doc),
        accessLevel,
      },
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
 * PATCH /api/documents/:id
 * Updates document metadata (title, description, tags) - Requires EDIT permission
 */
export async function updateDocument(req, res) {
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

    const userId = String(req.user.id || req.user._id);
    const userEmail = (req.user.email || '').toLowerCase().trim();

    // Stage 5 check: immediate revocation and authorization validation
    if (
      isAccessImmediatelyRevoked(id, userId) ||
      (userEmail && isAccessImmediatelyRevoked(id, userEmail)) ||
      !canEditDocument(doc, req.user)
    ) {
      // Audit log denied edit attempt (Stage 6/9)
      await logAuditEvent({
        req,
        action: 'ACCESS_DENIED',
        documentId: id,
        documentTitle: doc.title,
        metadata: {
          attemptedAction: 'DOCUMENT_METADATA_UPDATE',
          reason: 'User lacks required edit permissions or access has been revoked.',
        },
      });

      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to edit this document metadata.',
        },
      });
    }

    const updates = {};
    if (req.body.title !== undefined) updates.title = String(req.body.title).trim();
    if (req.body.description !== undefined) updates.description = String(req.body.description).trim();
    if (req.body.tags !== undefined) {
      updates.tags = Array.isArray(req.body.tags)
        ? req.body.tags
        : String(req.body.tags).split(',').map((t) => t.trim()).filter(Boolean);
    }

    const updatedDoc = await Document.findByIdAndUpdate(id, updates, { new: true });

    // Audit log recording (Stage 6)
    await logAuditEvent({
      req,
      action: 'DOCUMENT_UPDATED',
      documentId: id,
      documentTitle: updatedDoc.title,
      metadata: { updatedFields: Object.keys(updates) },
    });

    return res.status(200).json({
      message: 'Document metadata successfully updated.',
      document: sanitizeDocument(updatedDoc),
    });
  } catch (error) {
    console.error('[Update Document Error]:', error);
    return res.status(500).json({
      error: {
        code: 'UPDATE_FAILED',
        message: 'Failed to update document metadata.',
      },
    });
  }
}

/**
 * GET /api/documents/:id/download
 * Securely streams the private document binary with forced attachment headers
 * Direct-to-database live permission checks enforcing zero-lag immediate revocation.
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

    const userId = String(req.user.id || req.user._id);
    const userEmail = (req.user.email || '').toLowerCase().trim();

    // Stage 5: Immediate revocation engine validation (by ID and by email)
    if (
      isAccessImmediatelyRevoked(id, userId) ||
      (userEmail && isAccessImmediatelyRevoked(id, userEmail)) ||
      !canReadDocument(doc, req.user)
    ) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access to download this document has been revoked or denied.',
        },
      });
    }

    // Resolve storage file path (handle absolute paths or relative STORAGE_DIR paths)
    let targetPath = doc.storagePath;
    if (!targetPath || !fs.existsSync(targetPath)) {
      const fallbackInStorage = path.resolve(STORAGE_DIR, path.basename(doc.storagePath || ''));
      if (fs.existsSync(fallbackInStorage)) {
        targetPath = fallbackInStorage;
      } else {
        return res.status(404).json({
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'Document binary file is missing from private storage.',
          },
        });
      }
    }

    const stat = fs.statSync(targetPath);

    // Audit log recording (Stage 6)
    await logAuditEvent({
      req,
      action: 'DOCUMENT_DOWNLOAD',
      documentId: doc._id,
      documentTitle: doc.title,
      metadata: { fileSize: stat.size },
    });

    // Compute secure attachment filename ensuring valid file extension
    const rawName = doc.originalName || doc.title || 'document';
    let safeFilename = path.basename(rawName).replace(/["\r\n]/g, '').trim();

    if (!path.extname(safeFilename)) {
      const extOnDisk = path.extname(targetPath);
      if (extOnDisk) {
        safeFilename += extOnDisk;
      } else if (doc.mimeType) {
        const mimeMap = {
          'application/pdf': '.pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
          'application/zip': '.zip',
          'text/plain': '.txt',
          'text/csv': '.csv',
          'image/png': '.png',
          'image/jpeg': '.jpg',
        };
        if (mimeMap[doc.mimeType]) safeFilename += mimeMap[doc.mimeType];
      }
    }

    const asciiFallback = safeFilename.replace(/[^\x20-\x7E]/g, '_');
    const encodedFilename = encodeURIComponent(safeFilename);

    res.setHeader('Content-Disposition', `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const stream = fs.createReadStream(targetPath);
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

    // Audit log recording (Stage 6) before deletion
    await logAuditEvent({
      req,
      action: 'DOCUMENT_DELETED',
      documentId: doc._id,
      documentTitle: doc.title,
    });

    await Document.findByIdAndDelete(id);

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

/**
 * GET /api/documents/:id/permissions
 * Retrieves the Access Control List (ACL) for the specified document
 */
export async function getDocumentPermissions(req, res) {
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
          message: 'You do not have permission to view access rules for this document.',
        },
      });
    }

    return res.status(200).json({
      documentId: id,
      ownerId: doc.ownerId,
      acl: doc.acl || [],
    });
  } catch (error) {
    console.error('[Get Permissions Error]:', error);
    return res.status(500).json({
      error: {
        code: 'PERMISSIONS_FETCH_ERROR',
        message: 'Failed to retrieve document permissions.',
      },
    });
  }
}

/**
 * POST /api/documents/:id/permissions
 * Grants or elevates read/edit permissions to a named user
 */
export async function grantDocumentPermission(req, res) {
  try {
    const { id } = req.params;
    let { email, userId, permissionLevel = 'read' } = req.body;
    let normLevel = String(permissionLevel || '').toLowerCase().trim();
    if (normLevel === 'view') normLevel = 'read';

    if (!['read', 'edit'].includes(normLevel)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PERMISSION_LEVEL',
          message: "Permission level must be either 'read' (or 'view') or 'edit'.",
        },
      });
    }
    permissionLevel = normLevel;

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
          message: 'Only the document owner or an administrator can grant permissions.',
        },
      });
    }

    let targetUser = null;
    if (email) {
      targetUser = await User.findOne({ email: email.toLowerCase().trim() });
    } else if (userId) {
      targetUser = await User.findById(userId);
    }

    const callerId = String(req.user.id || req.user._id);
    const ownerId = String(doc.ownerId);
    const ownerEmail = (doc.ownerEmail || '').toLowerCase().trim();

    const targetUserId = targetUser ? String(targetUser._id || targetUser.id) : (email ? email.toLowerCase().trim() : null);
    const targetEmail = targetUser ? targetUser.email.toLowerCase().trim() : (email ? email.toLowerCase().trim() : '');
    const targetName = targetUser ? targetUser.name : (targetEmail ? targetEmail.split('@')[0] : 'Collaborator');

    if (!targetUserId && !targetEmail) {
      return res.status(400).json({
        error: {
          code: 'USER_REQUIRED',
          message: 'Target collaborator email or user ID is required.',
        },
      });
    }

    if (
      (targetUserId && targetUserId === ownerId) ||
      (targetEmail && ownerEmail && targetEmail === ownerEmail)
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_GRANT',
          message: 'The document owner already retains full access rights.',
        },
      });
    }

    let currentAcl = Array.isArray(doc.acl) ? [...doc.acl] : [];
    const existingIndex = currentAcl.findIndex(
      (entry) =>
        (targetUserId && String(entry.userId) === targetUserId) ||
        (targetEmail && entry.email && entry.email.toLowerCase().trim() === targetEmail)
    );

    if (existingIndex >= 0) {
      currentAcl[existingIndex].permissionLevel = permissionLevel;
      currentAcl[existingIndex].grantedBy = callerId;
      currentAcl[existingIndex].grantedAt = new Date();
      if (targetUserId) currentAcl[existingIndex].userId = targetUserId;
      if (targetName) currentAcl[existingIndex].name = targetName;
      if (targetEmail) currentAcl[existingIndex].email = targetEmail;
    } else {
      currentAcl.push({
        userId: targetUserId,
        email: targetEmail,
        name: targetName,
        permissionLevel,
        grantedBy: callerId,
        grantedAt: new Date(),
      });
    }

    let currentReaders = Array.isArray(doc.readers) ? [...doc.readers] : [];
    if (targetUserId && !currentReaders.some((r) => String(r) === targetUserId)) {
      currentReaders.push(targetUserId);
    }
    if (targetEmail && !currentReaders.some((r) => String(r).toLowerCase().trim() === targetEmail)) {
      currentReaders.push(targetEmail);
    }

    const updatedDoc = await Document.findByIdAndUpdate(
      id,
      { acl: currentAcl, readers: currentReaders },
      { new: true }
    );

    // Audit log recording (Stage 6)
    await logAuditEvent({
      req,
      action: 'PERMISSION_GRANTED',
      documentId: doc._id,
      documentTitle: doc.title,
      metadata: {
        targetUserId,
        targetEmail,
        permissionLevel,
      },
    });

    return res.status(200).json({
      message: `Successfully granted '${permissionLevel}' access to ${targetEmail}.`,
      acl: updatedDoc.acl,
    });
  } catch (error) {
    console.error('[Grant Permission Error]:', error);
    return res.status(500).json({
      error: {
        code: 'GRANT_PERMISSION_ERROR',
        message: 'An error occurred while granting document permissions.',
      },
    });
  }
}

/**
 * DELETE /api/documents/:id/permissions/:targetUserId
 * Immediately revokes document access from a designated user (Stage 5 Revocation Engine)
 */
export async function revokeDocumentPermission(req, res) {
  try {
    const { id, targetUserId } = req.params;
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
          message: 'Only the document owner or an administrator can revoke permissions.',
        },
      });
    }

    // Look up target user to resolve both ID and email
    let targetUser = null;
    try {
      targetUser = await User.findById(targetUserId);
      if (!targetUser && String(targetUserId).includes('@')) {
        targetUser = await User.findOne({ email: String(targetUserId).toLowerCase().trim() });
      }
    } catch {
      // Non-blocking
    }

    const targetUserStr = String(targetUserId).toLowerCase().trim();
    const targetEmail = targetUser ? targetUser.email.toLowerCase().trim() : (targetUserStr.includes('@') ? targetUserStr : '');
    const targetId = targetUser ? String(targetUser._id || targetUser.id) : targetUserStr;

    // Stage 5: Register immediate revocation markers
    registerImmediateRevocation(id, targetId);
    if (targetEmail) {
      registerImmediateRevocation(id, targetEmail);
    }

    const updatedAcl = (doc.acl || []).filter((entry) => {
      const entryUid = String(entry.userId || '').toLowerCase().trim();
      const entryEmail = String(entry.email || '').toLowerCase().trim();
      if (entryUid === targetUserStr || entryUid === targetId.toLowerCase()) return false;
      if (targetEmail && (entryUid === targetEmail || entryEmail === targetEmail)) return false;
      return true;
    });

    const updatedReaders = (doc.readers || []).filter((r) => {
      const rStr = String(r).toLowerCase().trim();
      if (rStr === targetUserStr || rStr === targetId.toLowerCase()) return false;
      if (targetEmail && rStr === targetEmail) return false;
      return true;
    });

    const updatedDoc = await Document.findByIdAndUpdate(
      id,
      { acl: updatedAcl, readers: updatedReaders },
      { new: true }
    );

    // Audit log recording (Stage 6)
    await logAuditEvent({
      req,
      action: 'PERMISSION_REVOKED',
      documentId: doc._id,
      documentTitle: doc.title,
      metadata: { targetUserId },
    });

    return res.status(200).json({
      message: 'Document access permission immediately revoked.',
      acl: updatedDoc.acl,
    });
  } catch (error) {
    console.error('[Revoke Permission Error]:', error);
    return res.status(500).json({
      error: {
        code: 'REVOKE_PERMISSION_ERROR',
        message: 'Failed to revoke document access permission.',
      },
    });
  }
}

/**
 * GET /api/documents/:id/audit
 * Retrieves immutable audit history for a single document (Owner or Admin only)
 */
export async function getDocumentAuditTrail(req, res) {
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
          message: 'Only the document owner or an administrator can inspect the document audit trail.',
        },
      });
    }

    const logs = await AuditLog.find({ targetDocumentId: id });

    return res.status(200).json({
      documentId: id,
      documentTitle: doc.title,
      auditLogs: logs,
    });
  } catch (error) {
    console.error('[Document Audit Error]:', error);
    return res.status(500).json({
      error: {
        code: 'AUDIT_FETCH_ERROR',
        message: 'Failed to retrieve document audit trail.',
      },
    });
  }
}

/**
 * GET /api/documents/audit/activity
 * Lists recent activity logs across the vault
 */
export async function getRecentAuditActivity(req, res) {
  try {
    let logs = [];
    if (req.user.role === 'admin') {
      logs = await AuditLog.find();
    } else {
      // Return logs involving the user as actor or documents owned by the user
      const userDocs = await Document.find({ ownerId: req.user.id || req.user._id });
      const docIds = new Set(userDocs.map((d) => String(d._id)));
      const allLogs = await AuditLog.find();
      logs = allLogs.filter(
        (l) =>
          String(l.actorId) === String(req.user.id || req.user._id) ||
          docIds.has(String(l.targetDocumentId))
      );
    }

    return res.status(200).json({
      activities: logs.slice(0, 50),
    });
  } catch (error) {
    console.error('[Audit Activity Error]:', error);
    return res.status(500).json({
      error: {
        code: 'AUDIT_ACTIVITY_ERROR',
        message: 'Failed to retrieve audit activity.',
      },
    });
  }
}

/**
 * GET /api/documents/users/directory
 * Lists organization team members for collaborator selection in sharing dialogs
 */
export async function getDirectoryUsers(req, res) {
  try {
    const currentUserId = String(req.user.id || req.user._id);
    const users = await User.find({}, 'name email role');

    const directory = users
      .filter((u) => String(u._id || u.id) !== currentUserId)
      .map((u) => ({
        id: u._id || u.id,
        name: u.name,
        email: u.email,
        role: u.role,
      }));

    return res.status(200).json({ users: directory });
  } catch (error) {
    console.error('[User Directory Error]:', error);
    return res.status(500).json({
      error: {
        code: 'DIRECTORY_ERROR',
        message: 'Failed to retrieve user directory.',
      },
    });
  }
}

/**
 * GET /api/documents/search
 * Full-text and metadata search strictly restricted to documents the requesting user
 * has authorization to read. Enforces zero metadata leakage across isolation boundaries.
 */
export async function searchDocuments(req, res) {
  try {
    const rawQuery = (req.query.q || '').trim().toLowerCase();
    const filterTags = Array.isArray(req.query.tags)
      ? req.query.tags
      : req.query.tags
      ? req.query.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
      : [];
    const formatFilter = (req.query.format || '').trim().toLowerCase();

    // 1. Fetch documents
    const allDocs = await Document.find();

    // 2. Strict Zero-Trust Authorization Filter: Only documents accessible to requesting user
    const accessibleDocs = allDocs.filter((doc) => canReadDocument(doc, req.user));

    // 3. Search matching across title, description, originalName, and tags
    const matchedDocs = accessibleDocs.filter((doc) => {
      // If query provided, check text fields and tags
      if (rawQuery) {
        const titleMatch = (doc.title || '').toLowerCase().includes(rawQuery);
        const descMatch = (doc.description || '').toLowerCase().includes(rawQuery);
        const nameMatch = (doc.originalName || '').toLowerCase().includes(rawQuery);
        const tagMatch =
          Array.isArray(doc.tags) &&
          doc.tags.some((t) => (t || '').toLowerCase().includes(rawQuery));

        if (!titleMatch && !descMatch && !nameMatch && !tagMatch) {
          return false;
        }
      }

      // If format filter provided (e.g. 'pdf', 'png', etc.)
      if (formatFilter && formatFilter !== 'all') {
        const ext = path.extname(doc.originalName || '').replace('.', '').toLowerCase();
        if (ext !== formatFilter) {
          return false;
        }
      }

      // If tags filter provided, doc must include all requested filter tags
      if (filterTags.length > 0) {
        const docTagsLower = (doc.tags || []).map((t) => (t || '').toLowerCase());
        const hasAllTags = filterTags.every((reqTag) => docTagsLower.includes(reqTag));
        if (!hasAllTags) {
          return false;
        }
      }

      return true;
    });

    const userId = String(req.user.id || req.user._id);
    const userEmail = (req.user.email || '').toLowerCase().trim();

    return res.status(200).json({
      query: req.query.q || '',
      total: matchedDocs.length,
      documents: matchedDocs.map((doc) => {
        const sanitized = sanitizeDocument(doc);
        const ownerId = String(doc.ownerId);
        const ownerEmail = (doc.ownerEmail || '').toLowerCase().trim();
        const isOwner = userId === ownerId || (ownerEmail && userEmail && ownerEmail === userEmail);

        let accessLevel = 'Reader';
        if (isOwner) {
          accessLevel = 'Owner';
        } else if (Array.isArray(doc.acl)) {
          const entry = doc.acl.find(
            (a) =>
              String(a.userId) === userId ||
              (a.email && a.email.toLowerCase().trim() === userEmail)
          );
          if (entry) {
            const lvl = String(entry.permissionLevel || '').toLowerCase().trim();
            accessLevel = lvl === 'edit' ? 'Editor' : 'Reader';
          } else if (req.user.role === 'admin') {
            accessLevel = 'Admin';
          }
        } else if (req.user.role === 'admin') {
          accessLevel = 'Admin';
        }

        const owner = {
          id: ownerId,
          name: doc.ownerName || 'Document Owner',
          email: doc.ownerEmail || '',
        };

        return { ...sanitized, accessLevel, owner };
      }),
    });
  } catch (error) {
    console.error('[Document Search Error]:', error);
    return res.status(500).json({
      error: {
        code: 'SEARCH_ERROR',
        message: 'An error occurred while executing vault search.',
      },
    });
  }
}

