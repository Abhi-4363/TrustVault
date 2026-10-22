/**
 * TrustVault Backend - Document Model (Stage 4 Enhanced)
 * Defines Document metadata schema and resilient in-memory fallback.
 * Incorporates fine-grained Access Control Lists (ACLs) per document.
 */

import mongoose from 'mongoose';
import crypto from 'crypto';

// Granular ACL subdocument schema
const aclEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      default: '',
      trim: true,
    },
    permissionLevel: {
      type: String,
      enum: {
        values: ['read', 'view', 'edit'],
        message: 'Permission level must be read, view, or edit',
      },
      required: true,
      default: 'read',
      set: (val) => (String(val).toLowerCase().trim() === 'view' ? 'read' : String(val).toLowerCase().trim()),
    },
    grantedBy: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    grantedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// Standard Mongoose Schema
const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    originalName: {
      type: String,
      required: [true, 'Original file name is required'],
    },
    fileSize: {
      type: Number,
      required: [true, 'File size in bytes is required'],
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
    },
    storagePath: {
      type: String,
      required: [true, 'Storage path is required'],
    },
    ownerId: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Owner user ID is required'],
      ref: 'User',
      index: true,
    },
    ownerName: {
      type: String,
      default: '',
      trim: true,
    },
    ownerEmail: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    visibility: {
      type: String,
      enum: {
        values: ['private', 'selected_users', 'all_authenticated_users'],
        message: 'Visibility must be private, selected_users, or all_authenticated_users',
      },
      default: 'private',
      set: (v) => (String(v || '').toLowerCase().trim() === 'specific_users' ? 'selected_users' : String(v || '').toLowerCase().trim()),
    },
    acl: {
      type: [aclEntrySchema],
      default: [],
    },
    readers: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

documentSchema.methods.toJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.__v;
  return obj;
};

const MongooseDocumentModel = mongoose.models.Document || mongoose.model('Document', documentSchema);

// -----------------------------------------------------------------------------
// Resilient In-Memory Fallback Repository
// -----------------------------------------------------------------------------
class InMemoryDocumentRepository {
  constructor() {
    this.documents = new Map();
  }

  clear() {
    this.documents.clear();
  }

  async create(data) {
    const id = `doc_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const docObj = {
      _id: id,
      title: data.title.trim(),
      description: data.description ? data.description.trim() : '',
      originalName: data.originalName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      storagePath: data.storagePath,
      ownerId: data.ownerId,
      ownerName: data.ownerName || '',
      ownerEmail: data.ownerEmail || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      category: data.category ? String(data.category).trim() : (Array.isArray(data.tags) && data.tags[0] ? String(data.tags[0]).trim() : 'General'),
      visibility: data.visibility || 'private',
      acl: Array.isArray(data.acl) ? data.acl : [],
      readers: Array.isArray(data.readers) ? data.readers : [],
      createdAt: new Date(),
      updatedAt: new Date(),
      toJSON() {
        const copy = { ...this };
        delete copy.__v;
        delete copy.toJSON;
        return copy;
      },
    };

    this.documents.set(id, docObj);
    return docObj;
  }

  async find(query = {}) {
    let results = Array.from(this.documents.values());
    if (query.ownerId) {
      results = results.filter((d) => String(d.ownerId) === String(query.ownerId));
    }
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async findById(id) {
    return this.documents.get(id) || null;
  }

  async findOne(query = {}) {
    for (const doc of this.documents.values()) {
      let matches = true;
      for (const [key, val] of Object.entries(query)) {
        if (doc[key] !== val) {
          matches = false;
          break;
        }
      }
      if (matches) return doc;
    }
    return null;
  }

  async findByIdAndUpdate(id, update, options = {}) {
    const doc = this.documents.get(id);
    if (!doc) return null;

    // Handle Mongoose-style atomic operations or plain object updates
    if (update.$set) {
      Object.assign(doc, update.$set);
    }
    if (update.$push) {
      for (const [key, val] of Object.entries(update.$push)) {
        if (!Array.isArray(doc[key])) doc[key] = [];
        doc[key].push(val);
      }
    }
    if (update.$pull) {
      for (const [key, filter] of Object.entries(update.$pull)) {
        if (Array.isArray(doc[key])) {
          doc[key] = doc[key].filter((item) => {
            for (const [filterKey, filterVal] of Object.entries(filter)) {
              if (String(item[filterKey]) === String(filterVal)) return false;
            }
            return true;
          });
        }
      }
    }

    // Direct object updates
    for (const [key, val] of Object.entries(update)) {
      if (!key.startsWith('$')) {
        doc[key] = val;
      }
    }

    if (doc.visibility === 'specific_users') {
      doc.visibility = 'selected_users';
    }

    doc.updatedAt = new Date();
    return doc;
  }

  async findByIdAndDelete(id) {
    const doc = this.documents.get(id);
    if (doc) {
      this.documents.delete(id);
      return doc;
    }
    return null;
  }

  async updateMany(query = {}, update = {}) {
    let count = 0;
    const queryEntries = Object.entries(query);
    for (const doc of this.documents.values()) {
      let matches = true;
      for (const [key, val] of queryEntries) {
        if (String(doc[key]) !== String(val)) {
          matches = false;
          break;
        }
      }
      if (matches) {
        if (update.$set) {
          Object.assign(doc, update.$set);
        } else {
          for (const [key, val] of Object.entries(update)) {
            if (!key.startsWith('$')) {
              doc[key] = val;
            }
          }
        }
        doc.updatedAt = new Date();
        count++;
      }
    }
    return { modifiedCount: count, matchedCount: count };
  }

  async updateAclUserName(userId, newName) {
    const userIdStr = String(userId);
    let count = 0;
    for (const doc of this.documents.values()) {
      let modified = false;
      if (Array.isArray(doc.acl)) {
        doc.acl.forEach((entry) => {
          if (String(entry.userId) === userIdStr) {
            entry.name = newName;
            modified = true;
          }
        });
      }
      if (modified) {
        doc.updatedAt = new Date();
        count++;
      }
    }
    return count;
  }
}

export const inMemoryDocumentStore = new InMemoryDocumentRepository();

/**
 * Universal Document Model Adapter
 */
export const Document = {
  isMongooseActive() {
    return mongoose.connection && mongoose.connection.readyState === 1;
  },

  async create(data) {
    if (!this.isMongooseActive()) {
      return inMemoryDocumentStore.create(data);
    }
    const doc = new MongooseDocumentModel(data);
    await doc.save();
    return doc;
  },

  async find(query = {}) {
    if (!this.isMongooseActive()) {
      return inMemoryDocumentStore.find(query);
    }
    return MongooseDocumentModel.find(query).sort({ createdAt: -1 }).exec();
  },

  async findById(id) {
    if (!this.isMongooseActive()) {
      return inMemoryDocumentStore.findById(id);
    }
    return MongooseDocumentModel.findById(id).exec();
  },

  async findOne(query = {}) {
    if (!this.isMongooseActive()) {
      return inMemoryDocumentStore.findOne(query);
    }
    return MongooseDocumentModel.findOne(query).exec();
  },

  async findByIdAndUpdate(id, update, options = { new: true }) {
    if (!this.isMongooseActive()) {
      return inMemoryDocumentStore.findByIdAndUpdate(id, update, options);
    }
    return MongooseDocumentModel.findByIdAndUpdate(id, update, options).exec();
  },

  async findByIdAndDelete(id) {
    if (!this.isMongooseActive()) {
      return inMemoryDocumentStore.findByIdAndDelete(id);
    }
    return MongooseDocumentModel.findByIdAndDelete(id).exec();
  },

  async updateMany(query = {}, update = {}) {
    if (!this.isMongooseActive()) {
      return inMemoryDocumentStore.updateMany(query, update);
    }
    return MongooseDocumentModel.updateMany(query, update).exec();
  },

  async updateAclUserName(userId, newName) {
    if (!this.isMongooseActive()) {
      return inMemoryDocumentStore.updateAclUserName(userId, newName);
    }
    return MongooseDocumentModel.updateMany(
      { 'acl.userId': userId },
      { $set: { 'acl.$[elem].name': newName } },
      { arrayFilters: [{ 'elem.userId': userId }] }
    ).exec();
  },

  clearInMemory() {
    inMemoryDocumentStore.clear();
  },
};
