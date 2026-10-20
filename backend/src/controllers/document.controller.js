/**
 * TrustVault Backend - Document Controller (Stage 4 Enhanced)
 * Handles document ingestion, metadata indexing, secure streaming download,
 * lifecycle management, and fine-grained Per-Document Read and Edit Permissions.
 */

import fs from 'fs';
import path from 'path';
import { Document } from '../models/document.model.js';
import { User } from '../models/user.model.js';

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
  const userId = String(user.id || user._id);
  const ownerId = String(doc.ownerId);

  // Document owner has full access
  if (userId === ownerId) return true;

  // Platform administrator has governance access
  if (user.role === 'admin') return true;

  // Check granular ACL entry
  if (Array.isArray(doc.acl)) {
    const hasAclAccess = doc.acl.some(
      (entry) =>
        String(entry.userId) === userId &&
        (entry.permissionLevel === 'read' || entry.permissionLevel === 'edit')
    );
    if (hasAclAccess) return true;
  }

  // Legacy readers array check
  if (Array.isArray(doc.readers) && doc.readers.some((r) => String(r) === userId)) {
    return true;
  }

  return false;
}

/**
 * Checks whether the given user has edit authorization for the document
 */
export function canEditDocument(doc, user) {
  if (!doc || !user) return false;
  const userId = String(user.id || user._id);
  const ownerId = String(doc.ownerId);

  if (userId === ownerId) return true;
  if (user.role === 'admin') return true;

  if (Array.isArray(doc.acl)) {
    const hasEditAcl = doc.acl.some(
      (entry) => String(entry.userId) === userId && entry.permissionLevel === 'edit'
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
      acl: [],
      readers: [],
    };

    const createdDoc = await Document.create(documentData);

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
    let allDocs = await Document.find();
    const accessibleDocs = allDocs.filter((doc) => canReadDocument(doc, req.user));

    return res.status(200).json({
      documents: accessibleDocs.map((doc) => {
        const sanitized = sanitizeDocument(doc);
        const userId = String(req.user.id || req.user._id);
        const ownerId = String(doc.ownerId);

        let accessLevel = 'Reader';
        if (userId === ownerId) {
          accessLevel = 'Owner';
        } else if (req.user.role === 'admin') {
          accessLevel = 'Admin';
        } else if (Array.isArray(doc.acl)) {
          const entry = doc.acl.find((a) => String(a.userId) === userId);
          if (entry?.permissionLevel === 'edit') {
            accessLevel = 'Editor';
          }
        }
        return { ...sanitized, accessLevel };
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

    if (!canReadDocument(doc, req.user)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this document.',
        },
      });
    }

    const userId = String(req.user.id || req.user._id);
    const ownerId = String(doc.ownerId);

    let accessLevel = 'Reader';
    if (userId === ownerId) {
      accessLevel = 'Owner';
    } else if (req.user.role === 'admin') {
      accessLevel = 'Admin';
    } else if (Array.isArray(doc.acl)) {
      const entry = doc.acl.find((a) => String(a.userId) === userId);
      if (entry?.permissionLevel === 'edit') accessLevel = 'Editor';
    }

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

    if (!canEditDocument(doc, req.user)) {
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
    const { email, userId, permissionLevel = 'read' } = req.body;

    if (!['read', 'edit'].includes(permissionLevel)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PERMISSION_LEVEL',
          message: "Permission level must be either 'read' or 'edit'.",
        },
      });
    }

    const doc = await Document.findById(id);
    if (!doc) {
      return res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Requested document does not exist.',
        },
      });
    }

    // Only owner or admin can grant permissions
    if (!canManageDocument(doc, req.user)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only the document owner or an administrator can grant permissions.',
        },
      });
    }

    // Resolve target user
    let targetUser = null;
    if (email) {
      targetUser = await User.findOne({ email: email.toLowerCase().trim() });
    } else if (userId) {
      targetUser = await User.findById(userId);
    }

    if (!targetUser) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The target user was not found in the organization directory.',
        },
      });
    }

    const targetUserId = String(targetUser._id || targetUser.id);
    const ownerId = String(doc.ownerId);

    if (targetUserId === ownerId) {
      return res.status(400).json({
        error: {
          code: 'INVALID_GRANT',
          message: 'The document owner already retains full access rights.',
        },
      });
    }

    // Update existing ACL entry or insert new entry
    let currentAcl = Array.isArray(doc.acl) ? [...doc.acl] : [];
    const existingIndex = currentAcl.findIndex((entry) => String(entry.userId) === targetUserId);

    const callerId = String(req.user.id || req.user._id);

    if (existingIndex >= 0) {
      currentAcl[existingIndex].permissionLevel = permissionLevel;
      currentAcl[existingIndex].grantedBy = callerId;
      currentAcl[existingIndex].grantedAt = new Date();
    } else {
      currentAcl.push({
        userId: targetUserId,
        email: targetUser.email,
        name: targetUser.name,
        permissionLevel,
        grantedBy: callerId,
        grantedAt: new Date(),
      });
    }

    // Also update readers array for fallback
    let currentReaders = Array.isArray(doc.readers) ? [...doc.readers] : [];
    if (!currentReaders.some((r) => String(r) === targetUserId)) {
      currentReaders.push(targetUserId);
    }

    const updatedDoc = await Document.findByIdAndUpdate(
      id,
      { acl: currentAcl, readers: currentReaders },
      { new: true }
    );

    return res.status(200).json({
      message: `Successfully granted '${permissionLevel}' access to ${targetUser.email}.`,
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
 * Immediately revokes document access from a designated user
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

    // Filter target user out of ACL and readers
    const updatedAcl = (doc.acl || []).filter((entry) => String(entry.userId) !== String(targetUserId));
    const updatedReaders = (doc.readers || []).filter((r) => String(r) !== String(targetUserId));

    const updatedDoc = await Document.findByIdAndUpdate(
      id,
      { acl: updatedAcl, readers: updatedReaders },
      { new: true }
    );

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
 * GET /api/documents/users/directory
 * Lists organization team members for collaborator selection in sharing dialogs
 */
export async function getDirectoryUsers(req, res) {
  try {
    const currentUserId = String(req.user.id || req.user._id);
    const users = await User.find({}, 'name email role');

    // Return users excluding current requester
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
