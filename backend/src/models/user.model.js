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
      default: 'viewer',
    },
    requestedRole: {
      type: String,
      enum: ['owner', 'viewer', null],
      default: null,
    },
    ownerApprovalStatus: {
      type: String,
      enum: ['not_required', 'pending', 'approved', 'rejected'],
      default: 'not_required',
    },
    ownerApprovalRequestedAt: {
      type: Date,
      default: null,
    },
    ownerApprovalReviewedAt: {
      type: Date,
      default: null,
    },
    ownerApprovalReviewedBy: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ownerApprovalReviewedByName: {
      type: String,
      default: null,
    },
    roleChangeReason: {
      type: String,
      default: '',
    },
    passwordResetTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    passwordResetExpiresAt: {
      type: Date,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    emailVerificationExpiresAt: {
      type: Date,
      default: null,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    dateOfBirth: {
      type: String,
      default: null,
      trim: true,
    },
    termsVersionAccepted: {
      type: String,
      default: null,
    },
    privacyVersionAcknowledged: {
      type: String,
      default: null,
    },
    termsAcceptedAt: {
      type: Date,
      default: null,
    },
    termsPolicyEffectiveDate: {
      type: String,
      default: null,
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

// Ensure passwordHash, passwordResetTokenHash, and emailVerificationTokenHash are NEVER returned in JSON representations
userSchema.methods.toJSON = function () {
  const obj = this.toObject ? this.toObject({ virtuals: true }) : { ...this };
  obj.id = String(this._id);
  delete obj.passwordHash;
  delete obj.passwordResetTokenHash;
  delete obj.emailVerificationTokenHash;
  delete obj.__v;
  if ((obj.role === 'owner' || obj.role === 'admin') && obj.ownerApprovalStatus === 'pending') {
    obj.ownerApprovalStatus = 'approved';
  }
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

  async create({
    name,
    email,
    password,
    role = 'viewer',
    passwordHash: suppliedHash,
    isActive = true,
    requestedRole = null,
    ownerApprovalStatus = 'not_required',
    ownerApprovalRequestedAt = null,
    ownerApprovalReviewedAt = null,
    ownerApprovalReviewedBy = null,
    ownerApprovalReviewedByName = null,
    roleChangeReason = '',
    passwordResetTokenHash = null,
    passwordResetExpiresAt = null,
    isEmailVerified = true,
    emailVerificationTokenHash = null,
    emailVerificationExpiresAt = null,
    mustChangePassword = false,
    dateOfBirth = null,
    termsVersionAccepted = null,
    privacyVersionAcknowledged = null,
    termsAcceptedAt = null,
    termsPolicyEffectiveDate = null,
  }) {
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

    const id = `mem_user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const userObj = {
      _id: id,
      id,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
      requestedRole,
      ownerApprovalStatus,
      ownerApprovalRequestedAt,
      ownerApprovalReviewedAt,
      ownerApprovalReviewedBy,
      ownerApprovalReviewedByName,
      roleChangeReason,
      passwordResetTokenHash,
      passwordResetExpiresAt,
      isEmailVerified: Boolean(isEmailVerified),
      emailVerificationTokenHash,
      emailVerificationExpiresAt,
      mustChangePassword: Boolean(mustChangePassword),
      isActive: isActive !== false,
      dateOfBirth: dateOfBirth ? String(dateOfBirth).trim() : null,
      termsVersionAccepted: termsVersionAccepted || null,
      privacyVersionAcknowledged: privacyVersionAcknowledged || null,
      termsAcceptedAt: termsAcceptedAt ? new Date(termsAcceptedAt) : null,
      termsPolicyEffectiveDate: termsPolicyEffectiveDate || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      async comparePassword(candidatePassword) {
        return bcrypt.compare(candidatePassword, this.passwordHash);
      },
      toJSON() {
        const copy = { ...this, id: this._id };
        delete copy.passwordHash;
        delete copy.passwordResetTokenHash;
        delete copy.emailVerificationTokenHash;
        delete copy.comparePassword;
        delete copy.toJSON;
        if ((copy.role === 'owner' || copy.role === 'admin') && copy.ownerApprovalStatus === 'pending') {
          copy.ownerApprovalStatus = 'approved';
        }
        return copy;
      },
    };

    this.users.set(normalizedEmail, userObj);
    return userObj;
  }

  async findByIdAndUpdate(id, updateData, options = {}) {
    const idStr = String(id);
    for (const [email, user] of this.users.entries()) {
      if (String(user._id) === idStr || String(user.id) === idStr) {
        // Apply updates
        Object.keys(updateData).forEach((key) => {
          if (key !== '_id' && key !== 'id' && key !== 'email') {
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
      const queryIdStr = String(query._id);
      for (const u of this.users.values()) {
        if (String(u._id) === queryIdStr || String(u.id) === queryIdStr) return u;
      }
    }
    if (query.passwordResetTokenHash) {
      for (const u of this.users.values()) {
        if (u.passwordResetTokenHash === query.passwordResetTokenHash) return u;
      }
    }
    if (query.emailVerificationTokenHash) {
      for (const u of this.users.values()) {
        if (u.emailVerificationTokenHash === query.emailVerificationTokenHash) return u;
      }
    }
    // Generic match fallback
    for (const u of this.users.values()) {
      let match = true;
      for (const [k, v] of Object.entries(query)) {
        if (u[k] !== v) {
          match = false;
          break;
        }
      }
      if (match) return u;
    }
    return null;
  }

  async findById(id) {
    const idStr = String(id);
    for (const u of this.users.values()) {
      if (String(u._id) === idStr || String(u.id) === idStr) return u;
    }
    return null;
  }

  async find(query = {}) {
    let list = Array.from(this.users.values());
    if (query.$or) {
      // Basic search support
      return list;
    }
    return list;
  }

  async deleteMany(query = {}) {
    if (query.email && query.email.$nin) {
      const keep = query.email.$nin.map((e) => String(e).toLowerCase().trim());
      for (const email of Array.from(this.users.keys())) {
        if (!keep.includes(email)) {
          this.users.delete(email);
        }
      }
      return { acknowledged: true };
    }
    if (Object.keys(query).length === 0) {
      this.users.clear();
      return { acknowledged: true };
    }
    for (const [email, user] of Array.from(this.users.entries())) {
      let match = true;
      for (const [k, v] of Object.entries(query)) {
        if (user[k] !== v) {
          match = false;
          break;
        }
      }
      if (match) this.users.delete(email);
    }
    return { acknowledged: true };
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

  async create({
    name,
    email,
    password,
    passwordHash,
    role = 'viewer',
    isActive = true,
    isEmailVerified = true,
    emailVerificationTokenHash = null,
    emailVerificationExpiresAt = null,
    requestedRole = null,
    ownerApprovalStatus = 'not_required',
    ownerApprovalRequestedAt = null,
    ownerApprovalReviewedAt = null,
    ownerApprovalReviewedBy = null,
    ownerApprovalReviewedByName = null,
    roleChangeReason = '',
    dateOfBirth = null,
    termsVersionAccepted = null,
    privacyVersionAcknowledged = null,
    termsAcceptedAt = null,
    termsPolicyEffectiveDate = null,
  }) {
    // Support seeding a user with a pre‑hashed password (e.g., admin bootstrap).
    // If a passwordHash is provided directly, we skip bcrypt hashing to avoid
    // errors when `password` is undefined (as in the test suite).
    if (!this.isMongooseActive()) {
      // Forward the appropriate fields to the in‑memory repo.
      return inMemoryUserStore.create({
        name,
        email,
        password,
        role,
        passwordHash,
        isActive,
        isEmailVerified,
        emailVerificationTokenHash,
        emailVerificationExpiresAt,
        requestedRole,
        ownerApprovalStatus,
        ownerApprovalRequestedAt,
        ownerApprovalReviewedAt,
        ownerApprovalReviewedBy,
        ownerApprovalReviewedByName,
        roleChangeReason,
        dateOfBirth,
        termsVersionAccepted,
        privacyVersionAcknowledged,
        termsAcceptedAt,
        termsPolicyEffectiveDate,
      });
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
      isActive: isActive !== false,
      isEmailVerified: Boolean(isEmailVerified),
      emailVerificationTokenHash,
      emailVerificationExpiresAt,
      requestedRole,
      ownerApprovalStatus,
      ownerApprovalRequestedAt,
      ownerApprovalReviewedAt,
      ownerApprovalReviewedBy,
      ownerApprovalReviewedByName,
      roleChangeReason,
      dateOfBirth: dateOfBirth ? String(dateOfBirth).trim() : null,
      termsVersionAccepted: termsVersionAccepted || null,
      privacyVersionAcknowledged: privacyVersionAcknowledged || null,
      termsAcceptedAt: termsAcceptedAt ? new Date(termsAcceptedAt) : null,
      termsPolicyEffectiveDate: termsPolicyEffectiveDate || null,
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

  async deleteMany(query = {}) {
    if (!this.isMongooseActive()) {
      return inMemoryUserStore.deleteMany(query);
    }
    return MongooseUserModel.deleteMany(query).exec();
  },

  clearInMemory() {
    inMemoryUserStore.clear();
  },
};
