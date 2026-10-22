/**
 * TrustVault Backend - Password Reset Request Model
 * Persists user password reset requests submitted via the public forgot-password portal.
 * Admin reviews and approves resetting password to temporary password Password@123.
 * Supports Mongoose with MongoDB and in-memory store for local testing.
 */

import mongoose from 'mongoose';
import { isUsingInMemoryStore } from '../config/database.js';

const passwordResetRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    userEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed'],
      default: 'pending',
      index: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    resolvedByName: {
      type: String,
      default: null,
    },
    resolutionNote: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

passwordResetRequestSchema.methods.toJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  obj.id = String(this._id);
  delete obj.__v;
  return obj;
};

const MongoosePasswordResetModel =
  mongoose.models.PasswordResetRequest ||
  mongoose.model('PasswordResetRequest', passwordResetRequestSchema);

class InMemoryPasswordResetRepository {
  constructor() {
    this.requests = new Map();
  }

  clear() {
    this.requests.clear();
  }

  async create(data) {
    const id = `mem_reset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const reqObj = {
      _id: id,
      id,
      userId: String(data.userId),
      userName: data.userName,
      userEmail: String(data.userEmail).toLowerCase().trim(),
      status: data.status || 'pending',
      requestedAt: data.requestedAt || new Date(),
      resolvedAt: data.resolvedAt || null,
      resolvedBy: data.resolvedBy || null,
      resolvedByName: data.resolvedByName || null,
      resolutionNote: data.resolutionNote || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      toJSON() {
        return { ...this, id: this._id };
      },
    };

    this.requests.set(id, reqObj);
    return reqObj;
  }

  async find(query = {}) {
    let list = Array.from(this.requests.values());

    if (query._id) {
      const qId = String(query._id);
      list = list.filter((r) => String(r._id) === qId || String(r.id) === qId);
    }
    if (query.userId) {
      list = list.filter((r) => String(r.userId) === String(query.userId));
    }
    if (query.userEmail) {
      list = list.filter((r) => r.userEmail === query.userEmail.toLowerCase().trim());
    }
    if (query.status) {
      list = list.filter((r) => r.status === query.status);
    }

    list.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
    return list;
  }

  async findById(id) {
    const idStr = String(id);
    for (const r of this.requests.values()) {
      if (String(r._id) === idStr || String(r.id) === idStr) return r;
    }
    return null;
  }

  async findOne(query = {}) {
    const results = await this.find(query);
    return results.length > 0 ? results[0] : null;
  }

  async findByIdAndUpdate(id, update, options = {}) {
    const req = await this.findById(id);
    if (!req) return null;

    Object.keys(update).forEach((k) => {
      if (k !== '_id' && k !== 'id') {
        req[k] = update[k];
      }
    });
    req.updatedAt = new Date();
    return options.new !== false ? req : req;
  }

  async updateMany(query = {}, update = {}) {
    const list = await this.find(query);
    list.forEach((r) => {
      Object.keys(update).forEach((k) => {
        if (k !== '_id' && k !== 'id') {
          r[k] = update[k];
        }
      });
      r.updatedAt = new Date();
    });
    return { modifiedCount: list.length };
  }
}

const inMemoryPasswordResetStore = new InMemoryPasswordResetRepository();

export const PasswordResetRequest = {
  isMongooseActive() {
    return (
      mongoose.connection &&
      mongoose.connection.readyState === 1 &&
      !isUsingInMemoryStore()
    );
  },

  async create(data) {
    if (!this.isMongooseActive()) {
      return inMemoryPasswordResetStore.create(data);
    }
    const resetReq = new MongoosePasswordResetModel(data);
    await resetReq.save();
    return resetReq;
  },

  async find(query = {}) {
    if (!this.isMongooseActive()) {
      return inMemoryPasswordResetStore.find(query);
    }
    return MongoosePasswordResetModel.find(query).sort({ requestedAt: -1 }).exec();
  },

  async findById(id) {
    if (!this.isMongooseActive()) {
      return inMemoryPasswordResetStore.findById(id);
    }
    return MongoosePasswordResetModel.findById(id).exec();
  },

  async findOne(query = {}) {
    if (!this.isMongooseActive()) {
      return inMemoryPasswordResetStore.findOne(query);
    }
    return MongoosePasswordResetModel.findOne(query).exec();
  },

  async findByIdAndUpdate(id, update, options = { new: true }) {
    if (!this.isMongooseActive()) {
      return inMemoryPasswordResetStore.findByIdAndUpdate(id, update, options);
    }
    return MongoosePasswordResetModel.findByIdAndUpdate(id, update, options).exec();
  },

  async updateMany(query = {}, update = {}) {
    if (!this.isMongooseActive()) {
      return inMemoryPasswordResetStore.updateMany(query, update);
    }
    return MongoosePasswordResetModel.updateMany(query, update).exec();
  },

  clearInMemory() {
    inMemoryPasswordResetStore.clear();
  },
};
