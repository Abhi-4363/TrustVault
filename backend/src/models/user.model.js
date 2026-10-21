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
        values: ['admin', 'owner', 'document_owner', 'viewer', 'manager', 'member'],
        message: 'Role must be admin, owner (Document Owner), or viewer',
      },
      default: 'owner',
    },
    isActive: {
      type: Boolean,
      default: true,
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

  async create({ name, email, password, role = 'owner', passwordHash: suppliedHash }) {
    const normalizedEmail = email.toLowerCase().trim();
    if (this.users.has(normalizedEmail)) {
      const err = new Error('Email address is already registered');
      err.code = 11000;
      throw err;
    }

    // If a pre-hashed password was supplied (e.g. admin seeding), use it directly.
    // Otherwise hash the plaintext password via bcrypt as usual.
    let passwordHash;
    if (suppliedHash) {
      passwordHash = suppliedHash;
    } else {
      const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
      passwordHash = await bcrypt.hash(password, salt);
    }

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

  async findByIdAndUpdate(id, updateData, options = {}) {
    for (const [email, user] of this.users.entries()) {
      if (user._id === id) {
        // Apply updates
        Object.keys(updateData).forEach((key) => {
          if (key !== '_id' && key !== 'email') {
            user[key] = updateData[key];
          }
        });
        user.updatedAt = new Date();
        return options.new ? user : user;
      }
    }
    return null;
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

  async find(query = {}) {
    let list = Array.from(this.users.values());
    if (query.$or) {
      // Basic search support
      return list;
    }
    return list;
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

  async create({ name, email, password, passwordHash, role = 'owner' }) {
    // Support seeding a user with a pre‑hashed password (e.g., admin bootstrap).
    // If a passwordHash is provided directly, we skip bcrypt hashing to avoid
    // errors when `password` is undefined (as in the test suite).
    if (!this.isMongooseActive()) {
      // Forward the appropriate fields to the in‑memory repo.
      return inMemoryUserStore.create({ name, email, password, role, passwordHash });
    }

    let finalHash;
    if (passwordHash) {
      finalHash = passwordHash; // Use the supplied hash verbatim.
    } else {
      const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
      finalHash = await bcrypt.hash(password, salt);
    }

    const user = new MongooseUserModel({
      name,
      email,
      passwordHash: finalHash,
      role,
    });

    await user.save();
    return user;
  },

  async find(query = {}, selectFields = '-passwordHash') {
    if (!this.isMongooseActive()) {
      return inMemoryUserStore.find(query);
    }
    let q = MongooseUserModel.find(query);
    if (selectFields) {
      q = q.select(selectFields);
    }
    return q.exec();
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

  async findByIdAndUpdate(id, updateData, options = {}) {
    if (!this.isMongooseActive()) {
      return inMemoryUserStore.findByIdAndUpdate(id, updateData, options);
    }
    return MongooseUserModel.findByIdAndUpdate(id, updateData, options).exec();
  },

  clearInMemory() {
    inMemoryUserStore.clear();
  },
};
