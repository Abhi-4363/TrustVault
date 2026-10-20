/**
 * TrustVault Backend - User Model
 * Implements User schema with bcrypt password hashing (12 rounds),
 * role validation, and strict JSON sanitisation preventing password leaks.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { isUsingInMemoryStore } from '../config/database.js';

const BCRYPT_SALT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

// Standard Mongoose Schema
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Omit from default queries
    },
    role: {
      type: String,
      enum: {
        values: ['admin', 'manager', 'member'],
        message: 'Role must be admin, manager, or member',
      },
      default: 'member',
    },
  },
  {
    timestamps: true,
  }
);

// Method to verify candidate password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Ensure passwordHash is NEVER returned in JSON representations
userSchema.methods.toJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

const MongooseUserModel = mongoose.models.User || mongoose.model('User', userSchema);

// -----------------------------------------------------------------------------
// Resilient In-Memory Fallback Repository
// Ensures testing & local development work seamlessly even when MongoDB is offline
// -----------------------------------------------------------------------------
class InMemoryUserRepository {
  constructor() {
    this.users = new Map();
  }

  clear() {
    this.users.clear();
  }

  async create({ name, email, password, role = 'member' }) {
    const normalizedEmail = email.toLowerCase().trim();
    if (this.users.has(normalizedEmail)) {
      const err = new Error('Email address is already registered');
      err.code = 11000;
      throw err;
    }

    const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(password, salt);

    const userObj = {
      _id: `mem_user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      async comparePassword(candidatePassword) {
        return bcrypt.compare(candidatePassword, this.passwordHash);
      },
      toJSON() {
        const copy = { ...this };
        delete copy.passwordHash;
        delete copy.comparePassword;
        delete copy.toJSON;
        return copy;
      },
    };

    this.users.set(normalizedEmail, userObj);
    return userObj;
  }

  async findOne(query) {
    if (query.email) {
      const normalizedEmail = query.email.toLowerCase().trim();
      const user = this.users.get(normalizedEmail);
      return user || null;
    }
    if (query._id) {
      for (const u of this.users.values()) {
        if (u._id === query._id) return u;
      }
    }
    return null;
  }

  async findById(id) {
    return this.findOne({ _id: id });
  }
}

export const inMemoryUserStore = new InMemoryUserRepository();

/**
 * Universal User Model Adapter
 * Dispatches to Mongoose when connected to live MongoDB, or to InMemoryUserStore
 */
export const User = {
  isMongooseActive() {
    return mongoose.connection && mongoose.connection.readyState === 1;
  },

  async create({ name, email, password, role = 'member' }) {
    if (!this.isMongooseActive()) {
      return inMemoryUserStore.create({ name, email, password, role });
    }

    const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new MongooseUserModel({
      name,
      email,
      passwordHash,
      role,
    });

    await user.save();
    return user;
  },

  async findOne(query, selectFields) {
    if (!this.isMongooseActive()) {
      return inMemoryUserStore.findOne(query);
    }
    let q = MongooseUserModel.findOne(query);
    if (selectFields) {
      q = q.select(selectFields);
    }
    return q.exec();
  },

  async findById(id, selectFields) {
    if (!this.isMongooseActive()) {
      return inMemoryUserStore.findById(id);
    }
    let q = MongooseUserModel.findById(id);
    if (selectFields) {
      q = q.select(selectFields);
    }
    return q.exec();
  },

  clearInMemory() {
    inMemoryUserStore.clear();
  },
};
