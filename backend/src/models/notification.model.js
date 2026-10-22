/**
 * TrustVault Backend - Administrator Notification Model
 * Persists actionable admin alerts for Owner access requests and Password Reset requests.
 * Fully supports MongoDB Mongoose and resilient in-memory fallback for local dev & testing.
 */

import mongoose from 'mongoose';
import { isUsingInMemoryStore } from '../config/database.js';

const adminNotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['owner_access_request', 'password_reset_request', 'owner_request', 'password_reset'],
      required: true,
      index: true,
    },
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
    requestId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed'],
      default: 'pending',
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
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
  },
  {
    timestamps: true,
  }
);

adminNotificationSchema.methods.toJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  obj.id = String(this._id);
  delete obj.__v;
  return obj;
};

const MongooseNotificationModel =
  mongoose.models.AdminNotification || mongoose.model('AdminNotification', adminNotificationSchema);

// In-Memory Fallback Store
class InMemoryNotificationRepository {
  constructor() {
    this.notifications = new Map();
  }

  clear() {
    this.notifications.clear();
  }

  async create(data) {
    const id = `mem_notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    let normalizedType = String(data.type || '').trim();
    if (normalizedType === 'password_reset') normalizedType = 'password_reset_request';
    if (normalizedType === 'owner_request') normalizedType = 'owner_access_request';

    let defaultTitle = 'System Notification';
    if (normalizedType === 'password_reset_request') defaultTitle = 'Password Reset Request';
    if (normalizedType === 'owner_access_request') defaultTitle = 'Owner Access Request';

    const notifObj = {
      _id: id,
      id,
      type: normalizedType,
      userId: String(data.userId),
      userName: data.userName,
      userEmail: String(data.userEmail).toLowerCase().trim(),
      requestId: data.requestId ? String(data.requestId) : null,
      title: data.title || defaultTitle,
      message: data.message || '',
      status: data.status || 'pending',
      isRead: Boolean(data.isRead),
      readAt: data.readAt || null,
      resolvedAt: data.resolvedAt || null,
      resolvedBy: data.resolvedBy || null,
      resolvedByName: data.resolvedByName || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      toJSON() {
        return { ...this, id: this._id };
      },
    };

    this.notifications.set(id, notifObj);
    return notifObj;
  }

  async find(query = {}) {
    let list = Array.from(this.notifications.values());

    if (query._id) {
      const qId = String(query._id);
      list = list.filter((n) => String(n._id) === qId || String(n.id) === qId);
    }
    if (query.type) {
      if (typeof query.type === 'object' && Array.isArray(query.type.$in)) {
        list = list.filter((n) => query.type.$in.includes(n.type));
      } else {
        const targetType = String(query.type);
        if (targetType === 'password_reset_request' || targetType === 'password_reset') {
          list = list.filter((n) => n.type === 'password_reset_request' || n.type === 'password_reset');
        } else if (targetType === 'owner_access_request' || targetType === 'owner_request') {
          list = list.filter((n) => n.type === 'owner_access_request' || n.type === 'owner_request');
        } else {
          list = list.filter((n) => n.type === targetType);
        }
      }
    }
    if (query.userId) {
      list = list.filter((n) => String(n.userId) === String(query.userId));
    }
    if (query.userEmail) {
      list = list.filter((n) => n.userEmail === query.userEmail.toLowerCase().trim());
    }
    if (query.status) {
      list = list.filter((n) => n.status === query.status);
    }
    if (query.isRead !== undefined) {
      list = list.filter((n) => n.isRead === Boolean(query.isRead));
    }
    if (query.requestId) {
      list = list.filter((n) => String(n.requestId) === String(query.requestId));
    }

    // Sort descending by createdAt
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list;
  }

  async findById(id) {
    const idStr = String(id);
    for (const n of this.notifications.values()) {
      if (String(n._id) === idStr || String(n.id) === idStr) return n;
    }
    return null;
  }

  async findOne(query = {}) {
    const results = await this.find(query);
    return results.length > 0 ? results[0] : null;
  }

  async findByIdAndUpdate(id, update, options = {}) {
    const notif = await this.findById(id);
    if (!notif) return null;

    Object.keys(update).forEach((k) => {
      if (k !== '_id' && k !== 'id') {
        notif[k] = update[k];
      }
    });
    notif.updatedAt = new Date();
    return options.new !== false ? notif : notif;
  }

  async updateMany(query = {}, update = {}) {
    const list = await this.find(query);
    list.forEach((n) => {
      Object.keys(update).forEach((k) => {
        if (k !== '_id' && k !== 'id') {
          n[k] = update[k];
        }
      });
      n.updatedAt = new Date();
    });
    return { modifiedCount: list.length };
  }

  async countDocuments(query = {}) {
    const list = await this.find(query);
    return list.length;
  }
}

const inMemoryNotificationStore = new InMemoryNotificationRepository();

export const AdminNotification = {
  isMongooseActive() {
    return (
      mongoose.connection &&
      mongoose.connection.readyState === 1 &&
      !isUsingInMemoryStore()
    );
  },

  async create(data) {
    if (!this.isMongooseActive()) {
      return inMemoryNotificationStore.create(data);
    }
    const notif = new MongooseNotificationModel(data);
    await notif.save();
    return notif;
  },

  async find(query = {}) {
    if (!this.isMongooseActive()) {
      return inMemoryNotificationStore.find(query);
    }
    return MongooseNotificationModel.find(query).sort({ createdAt: -1 }).exec();
  },

  async findById(id) {
    if (!this.isMongooseActive()) {
      return inMemoryNotificationStore.findById(id);
    }
    return MongooseNotificationModel.findById(id).exec();
  },

  async findOne(query = {}) {
    if (!this.isMongooseActive()) {
      return inMemoryNotificationStore.findOne(query);
    }
    return MongooseNotificationModel.findOne(query).exec();
  },

  async findByIdAndUpdate(id, update, options = { new: true }) {
    if (!this.isMongooseActive()) {
      return inMemoryNotificationStore.findByIdAndUpdate(id, update, options);
    }
    return MongooseNotificationModel.findByIdAndUpdate(id, update, options).exec();
  },

  async updateMany(query = {}, update = {}) {
    if (!this.isMongooseActive()) {
      return inMemoryNotificationStore.updateMany(query, update);
    }
    return MongooseNotificationModel.updateMany(query, update).exec();
  },

  async countDocuments(query = {}) {
    if (!this.isMongooseActive()) {
      return inMemoryNotificationStore.countDocuments(query);
    }
    return MongooseNotificationModel.countDocuments(query).exec();
  },

  clearInMemory() {
    inMemoryNotificationStore.clear();
  },
};
