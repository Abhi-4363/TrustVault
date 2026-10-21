/**
 * TrustVault Backend - Immutable Audit Trail Model (Stage 6)
 * Implements append-only event logging for all critical document interactions.
 * Mutation (UPDATE) and Deletion (DELETE) operations are strictly forbidden by design.
 */

import mongoose from 'mongoose';

const VALID_ACTIONS = [
  'DOCUMENT_UPLOAD',
  'DOCUMENT_READ',
  'DOCUMENT_DOWNLOAD',
  'DOCUMENT_UPDATED',
  'DOCUMENT_DELETED',
  'PERMISSION_GRANTED',
  'PERMISSION_REVOKED',
  'ACCESS_DENIED',
  'USER_ROLE_UPDATED',
  'USER_DEACTIVATED',
  'USER_REACTIVATED',
];

const auditLogSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      immutable: true,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Actor ID is required'],
      immutable: true,
      index: true,
    },
    actorEmail: {
      type: String,
      required: [true, 'Actor email is required'],
      immutable: true,
    },
    actorName: {
      type: String,
      default: 'Unknown User',
      immutable: true,
    },
    action: {
      type: String,
      enum: {
        values: VALID_ACTIONS,
        message: 'Invalid audit action type',
      },
      required: [true, 'Audit action type is required'],
      immutable: true,
      index: true,
    },
    targetDocumentId: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
      default: 'SYSTEM',
      immutable: true,
      index: true,
    },
    targetDocumentTitle: {
      type: String,
      default: '',
      immutable: true,
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1',
      immutable: true,
    },
    userAgent: {
      type: String,
      default: 'Unknown Client',
      immutable: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      immutable: true,
    },
  },
  {
    // Prohibit Mongoose version key and disallow updating timestamps
    versionKey: false,
    timestamps: false,
  }
);

// -----------------------------------------------------------------------------
// Pre-Hook Append-Only Enforcements (Reject all updates and deletions)
// -----------------------------------------------------------------------------
const forbidModification = function () {
  throw new Error('Audit trail is append-only. Modification of existing audit records is strictly prohibited.');
};

const forbidDeletion = function () {
  throw new Error('Audit trail is append-only. Deletion of audit log records is strictly prohibited.');
};

auditLogSchema.pre('updateOne', forbidModification);
auditLogSchema.pre('updateMany', forbidModification);
auditLogSchema.pre('findOneAndUpdate', forbidModification);
auditLogSchema.pre('deleteOne', forbidDeletion);
auditLogSchema.pre('deleteMany', forbidDeletion);
auditLogSchema.pre('findOneAndDelete', forbidDeletion);

const MongooseAuditModel = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

// -----------------------------------------------------------------------------
// Resilient In-Memory Fallback Repository
// -----------------------------------------------------------------------------
class InMemoryAuditRepository {
  constructor() {
    this.logs = [];
  }

  clear() {
    // Only permitted for unit test harness resets
    this.logs = [];
  }

  async create(data) {
    const entry = {
      _id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      actorId: String(data.actorId),
      actorEmail: data.actorEmail,
      actorName: data.actorName || 'User',
      action: data.action,
      targetDocumentId: String(data.targetDocumentId || 'SYSTEM'),
      targetDocumentTitle: data.targetDocumentTitle || '',
      ipAddress: data.ipAddress || '127.0.0.1',
      userAgent: data.userAgent || 'TrustVault Client',
      metadata: data.metadata || {},
    };

    // Object freeze to enforce immutability in memory
    Object.freeze(entry);
    this.logs.unshift(entry); // newest first
    return entry;
  }

  async find(query = {}) {
    let results = [...this.logs];
    if (query.targetDocumentId) {
      results = results.filter((l) => String(l.targetDocumentId) === String(query.targetDocumentId));
    }
    if (query.actorId) {
      results = results.filter((l) => String(l.actorId) === String(query.actorId));
    }
    if (query.action) {
      results = results.filter((l) => l.action === query.action);
    }
    return results;
  }

  // Explicitly disallow mutation or deletion on in-memory store
  async update() {
    forbidModification();
  }

  async delete() {
    forbidDeletion();
  }
}

export const inMemoryAuditStore = new InMemoryAuditRepository();

/**
 * Universal AuditLog Model Adapter
 */
export const AuditLog = {
  isMongooseActive() {
    return mongoose.connection && mongoose.connection.readyState === 1;
  },

  async create(data) {
    if (!this.isMongooseActive()) {
      return inMemoryAuditStore.create(data);
    }
    const log = new MongooseAuditModel(data);
    await log.save();
    return log;
  },

  async find(query = {}) {
    if (!this.isMongooseActive()) {
      return inMemoryAuditStore.find(query);
    }
    return MongooseAuditModel.find(query).sort({ timestamp: -1 }).exec();
  },

  async update() {
    forbidModification();
  },

  async delete() {
    forbidDeletion();
  },

  clearInMemory() {
    inMemoryAuditStore.clear();
  },
};
