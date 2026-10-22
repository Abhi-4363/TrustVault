/**
 * TrustVault Backend - Production Seed Script (Stage 10)
 * Populates realistic demonstration organizations, users, documents, permissions,
 * and immutable audit trail records.
 *
 * Usage: npm run seed
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { User } from '../src/models/user.model.js';
import { Document } from '../src/models/document.model.js';
import { AuditLog } from '../src/models/audit.model.js';
import { STORAGE_DIR } from '../src/middleware/upload.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const validPdfBuffer = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF'
);

export async function runSeed(isStandalone = false) {
  console.log('====================================================');
  console.log(' TrustVault — Database Seed (Stage 10)');
  console.log('====================================================');

  // Ensure storage directory exists
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  // Connect to MongoDB if available and not already connected
  let isMongoConnected = false;
  if (mongoose.connection.readyState !== 1) {
    try {
      if (config.mongoUri) {
        await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 2000 });
        isMongoConnected = true;
        console.log('✔ Connected to MongoDB for persistent seeding.');
      }
    } catch {
      console.log('ℹ MongoDB not reachable, seeding in-memory store adapter.');
    }
  } else {
    isMongoConnected = true;
  }

  // 1. Seed Users
  console.log('\n[1/4] Seeding corporate identities...');
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash('TrustVault2026!', salt);
  const abhiPasswordHash = await bcrypt.hash('Abhi@9346192300', salt);

  const seedUsersData = [
    {
      name: 'Marcus Vance',
      email: 'admin@trustvault.internal',
      role: 'admin',
      password: 'TrustVault2026!',
      passwordHash,
      isActive: true,
    },
    {
      name: 'Sarah Jenkins',
      email: 'sarah.lead@trustvault.internal',
      role: 'owner',
      password: 'TrustVault2026!',
      passwordHash,
      isActive: true,
    },
    {
      name: 'Elena Rostova',
      email: 'elena.legal@trustvault.internal',
      role: 'owner',
      password: 'TrustVault2026!',
      passwordHash,
      isActive: true,
    },
    {
      name: 'Alex Mercer',
      email: 'alex.dev@trustvault.internal',
      role: 'viewer',
      requestedRole: 'viewer',
      ownerApprovalStatus: 'not_required',
      password: 'TrustVault2026!',
      passwordHash,
      isActive: true,
    },
    {
      name: 'Jordan Lee',
      email: 'jordan.req@trustvault.internal',
      role: 'viewer',
      requestedRole: 'owner',
      ownerApprovalStatus: 'pending',
      ownerApprovalRequestedAt: new Date(Date.now() - 3600000),
      password: 'TrustVault2026!',
      passwordHash,
      isActive: true,
    },
    {
      name: 'Konagalla Abhirama Rao',
      email: 'abhiram.konagalla604@gmail.com',
      role: 'owner',
      requestedRole: 'owner',
      ownerApprovalStatus: 'approved',
      ownerApprovalRequestedAt: new Date(Date.now() - 3600000),
      ownerApprovalReviewedAt: new Date(),
      ownerApprovalReviewedByName: 'Marcus Vance',
      roleChangeReason: 'Owner privileges approved by Administrator.',
      password: 'Abhi@9346192300',
      passwordHash: abhiPasswordHash,
      isActive: true,
    },
  ];

  const createdUsers = {};
  for (const u of seedUsersData) {
    let existing = await User.findOne({ email: u.email });
    if (!existing) {
      existing = await User.create(u);
    } else {
      await User.findByIdAndUpdate(existing._id || existing.id, {
        passwordHash: u.passwordHash,
        role: u.role,
        requestedRole: u.requestedRole || existing.requestedRole,
        ownerApprovalStatus: u.ownerApprovalStatus || existing.ownerApprovalStatus,
        ownerApprovalReviewedAt: u.ownerApprovalReviewedAt || existing.ownerApprovalReviewedAt,
        ownerApprovalReviewedByName: u.ownerApprovalReviewedByName || existing.ownerApprovalReviewedByName,
        roleChangeReason: u.roleChangeReason || existing.roleChangeReason,
      });
    }
    createdUsers[u.email] = existing;
    console.log(`   ✔ ${u.name} <${u.email}> (${u.role.toUpperCase()})`);
  }

  const marcus = createdUsers['admin@trustvault.internal'];
  const sarah = createdUsers['sarah.lead@trustvault.internal'];
  const alex = createdUsers['alex.dev@trustvault.internal'];
  const elena = createdUsers['elena.legal@trustvault.internal'];

  // Helper to create and write a secure storage file
  function createDiskFile(originalName) {
    const ext = path.extname(originalName);
    const diskFilename = `${crypto.randomUUID()}${ext}`;
    const fullPath = path.join(STORAGE_DIR, diskFilename);
    fs.writeFileSync(fullPath, validPdfBuffer);
    return { diskFilename, fullPath };
  }

  // 2. Seed Documents
  console.log('\n[2/4] Seeding private vault documents...');
  const seedDocsData = [
    {
      title: 'Q4 2026 Enterprise SOC2 & ISO27001 Audit Dossier',
      description: 'Comprehensive compliance and penetration testing audit results.',
      originalName: 'Q4-2026-Enterprise-Audit.pdf',
      ownerId: marcus._id || marcus.id,
      ownerName: marcus.name,
      ownerEmail: marcus.email,
      fileSize: 412850,
      mimeType: 'application/pdf',
      tags: ['compliance', 'audit', 'iso27001', 'confidential'],
      acl: [
        {
          userId: elena._id || elena.id,
          email: elena.email,
          name: elena.name,
          userEmail: elena.email,
          userName: elena.name,
          permissionLevel: 'edit',
          grantedBy: marcus._id || marcus.id,
          grantedAt: new Date(Date.now() - 86400000 * 2),
        },
        {
          userId: sarah._id || sarah.id,
          email: sarah.email,
          name: sarah.name,
          userEmail: sarah.email,
          userName: sarah.name,
          permissionLevel: 'read',
          grantedBy: marcus._id || marcus.id,
          grantedAt: new Date(Date.now() - 86400000),
        },
      ],
    },
    {
      title: 'Project Apex Zero-Trust Cryptographic Blueprint',
      description: 'System specifications for hardware security modules and per-file keys.',
      originalName: 'Project-Apex-Architecture-Spec.pdf',
      ownerId: sarah._id || sarah.id,
      ownerName: sarah.name,
      ownerEmail: sarah.email,
      fileSize: 284190,
      mimeType: 'application/pdf',
      tags: ['architecture', 'apex', 'zero-trust'],
      acl: [
        {
          userId: alex._id || alex.id,
          email: alex.email,
          name: alex.name,
          userEmail: alex.email,
          userName: alex.name,
          permissionLevel: 'edit',
          grantedBy: sarah._id || sarah.id,
          grantedAt: new Date(Date.now() - 43200000),
        },
      ],
    },
    {
      title: 'FY2027 Executive Compensation & Strategic Budget',
      description: 'Strictly restricted executive allocations and merger contingencies.',
      originalName: 'FY2027-Budget-Allocations-Confidential.pdf',
      ownerId: marcus._id || marcus.id,
      ownerName: marcus.name,
      ownerEmail: marcus.email,
      fileSize: 521400,
      mimeType: 'application/pdf',
      tags: ['financials', 'executive', 'restricted'],
      acl: [], // strictly private to owner
    },
    {
      title: 'Global Privacy Framework & GDPR Data Map',
      description: 'Cross-border data transfer impact assessment and DPIA guidelines.',
      originalName: 'Global-Privacy-GDPR-Framework.pdf',
      ownerId: elena._id || elena.id,
      ownerName: elena.name,
      ownerEmail: elena.email,
      fileSize: 310500,
      mimeType: 'application/pdf',
      tags: ['legal', 'privacy', 'gdpr'],
      acl: [
        {
          userId: marcus._id || marcus.id,
          email: marcus.email,
          name: marcus.name,
          userEmail: marcus.email,
          userName: marcus.name,
          permissionLevel: 'read',
          grantedBy: elena._id || elena.id,
          grantedAt: new Date(Date.now() - 21600000),
        },
      ],
    },
  ];

  const createdDocs = [];
  for (const docData of seedDocsData) {
    let existing = await Document.findOne({ title: docData.title });
    if (!existing) {
      const { diskFilename, fullPath } = createDiskFile(docData.originalName);
      existing = await Document.create({
        ...docData,
        storagePath: fullPath,
      });
      console.log(`   ✔ "${existing.title}" (ACL: ${existing.acl?.length || 0} delegates)`);
    } else {
      console.log(`   ✔ "${existing.title}" (Existing)`);
    }
    createdDocs.push(existing);
  }

  // 3. Seed Immutable Audit Logs
  console.log('\n[3/4] Generating append-only tamper-resistant audit logs...');
  const existingLogs = await AuditLog.find();
  if (existingLogs.length === 0) {
    const auditEntries = [
      {
        action: 'DOCUMENT_UPLOAD',
        actorId: marcus._id || marcus.id,
        actorEmail: marcus.email,
        actorName: marcus.name,
        targetDocumentId: createdDocs[0]._id || createdDocs[0].id,
        targetDocumentTitle: createdDocs[0].title,
        ipAddress: '192.168.1.10',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TrustVault/1.0',
        timestamp: new Date(Date.now() - 86400000 * 3),
      },
      {
        action: 'PERMISSION_GRANTED',
        actorId: marcus._id || marcus.id,
        actorEmail: marcus.email,
        actorName: marcus.name,
        targetDocumentId: createdDocs[0]._id || createdDocs[0].id,
        targetDocumentTitle: createdDocs[0].title,
        ipAddress: '192.168.1.10',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TrustVault/1.0',
        timestamp: new Date(Date.now() - 86400000 * 2),
      },
      {
        action: 'DOCUMENT_READ',
        actorId: elena._id || elena.id,
        actorEmail: elena.email,
        actorName: elena.name,
        targetDocumentId: createdDocs[0]._id || createdDocs[0].id,
        targetDocumentTitle: createdDocs[0].title,
        ipAddress: '192.168.1.45',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) TrustVault/1.0',
        timestamp: new Date(Date.now() - 86400000 * 1.5),
      },
      {
        action: 'DOCUMENT_DOWNLOAD',
        actorId: elena._id || elena.id,
        actorEmail: elena.email,
        actorName: elena.name,
        targetDocumentId: createdDocs[0]._id || createdDocs[0].id,
        targetDocumentTitle: createdDocs[0].title,
        ipAddress: '192.168.1.45',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) TrustVault/1.0',
        timestamp: new Date(Date.now() - 86400000 * 1.2),
      },
      {
        action: 'DOCUMENT_UPLOAD',
        actorId: sarah._id || sarah.id,
        actorEmail: sarah.email,
        actorName: sarah.name,
        targetDocumentId: createdDocs[1]._id || createdDocs[1].id,
        targetDocumentTitle: createdDocs[1].title,
        ipAddress: '192.168.1.22',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) TrustVault/1.0',
        timestamp: new Date(Date.now() - 43200000),
      },
      {
        action: 'PERMISSION_GRANTED',
        actorId: sarah._id || sarah.id,
        actorEmail: sarah.email,
        actorName: sarah.name,
        targetDocumentId: createdDocs[1]._id || createdDocs[1].id,
        targetDocumentTitle: createdDocs[1].title,
        ipAddress: '192.168.1.22',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) TrustVault/1.0',
        timestamp: new Date(Date.now() - 36000000),
      },
      {
        action: 'DOCUMENT_DOWNLOAD',
        actorId: alex._id || alex.id,
        actorEmail: alex.email,
        actorName: alex.name,
        targetDocumentId: createdDocs[1]._id || createdDocs[1].id,
        targetDocumentTitle: createdDocs[1].title,
        ipAddress: '192.168.1.88',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TrustVault/1.0',
        timestamp: new Date(Date.now() - 18000000),
      },
    ];

    for (const entry of auditEntries) {
      await AuditLog.create(entry);
      console.log(`   ✔ Audit: [${entry.action}] by ${entry.actorEmail}`);
    }
  } else {
    console.log(`   ✔ (${existingLogs.length} audit logs already present)`);
  }

  // 4. Output Demo Credentials
  console.log('\n[4/4] Demo Credentials Ready for Evaluator Walkthrough:');
  console.log('----------------------------------------------------');
  console.log(' 👑 Admin:          admin@trustvault.internal       / TrustVault2026!');
  console.log(' 📄 Document Owner: sarah.lead@trustvault.internal  / TrustVault2026!');
  console.log(' 📄 Document Owner: elena.legal@trustvault.internal / TrustVault2026!');
  console.log(' 👁 Viewer:         alex.dev@trustvault.internal    / TrustVault2026!');
  console.log(' ⏳ Pending Owner:  jordan.req@trustvault.internal  / TrustVault2026!');
  console.log('----------------------------------------------------');
  console.log('✔ Seeding complete successfully.\n');

  if (isMongoConnected && isStandalone) {
    await mongoose.disconnect();
  }
}

// Run immediately if executed directly via CLI
const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('seed.js');
if (isDirectRun) {
  runSeed(true).catch((err) => {
    console.error('Seed Error:', err);
    process.exit(1);
  });
}
