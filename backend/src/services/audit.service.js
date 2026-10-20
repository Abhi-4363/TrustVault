/**
 * TrustVault Backend - Central Audit Service (Stage 6)
 * Automatically captures request context, actor identity, action type,
 * and immutable metadata for full organizational compliance.
 */

import { AuditLog } from '../models/audit.model.js';

/**
 * Records an immutable audit log entry
 * @param {Object} options
 * @param {Object} options.req - Express HTTP request object
 * @param {string} options.action - Audit action constant
 * @param {string|number} options.documentId - Target document identifier
 * @param {string} [options.documentTitle] - Display title of document
 * @param {Object} [options.metadata] - Supplemental event context
 */
export async function logAuditEvent({
  req,
  action,
  documentId,
  documentTitle = '',
  metadata = {},
}) {
  try {
    const actor = req?.user || {};
    const ipAddress =
      req?.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req?.socket?.remoteAddress ||
      req?.ip ||
      '127.0.0.1';

    const userAgent = req?.headers['user-agent'] || 'TrustVault API Client';

    await AuditLog.create({
      actorId: actor.id || actor._id || 'system_anonymous',
      actorEmail: actor.email || 'anonymous@vault.internal',
      actorName: actor.name || 'Anonymous User',
      action,
      targetDocumentId: documentId,
      targetDocumentTitle: documentTitle,
      ipAddress,
      userAgent,
      metadata,
    });
  } catch (error) {
    // Audit failure should be logged to stderr without crashing the primary request flow
    console.error('[Audit Trail Error] Failed to write immutable log:', error);
  }
}
