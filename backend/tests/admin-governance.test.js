/**
 * TrustVault Backend - Stage 8: Administrator Governance Dashboard Tests
 * Validates:
 * 1. RBAC enforcement: Non-admin users receive 403 on all /api/admin/* endpoints
 * 2. Analytics endpoint returns correct system metrics
 * 3. Global audit log viewer with filtering and pagination
 * 4. Audit log export (CSV/JSON) without data truncation
 * 5. User management: list, detail, deactivate, reactivate
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Document } from '../src/models/document.model.js';
import { AuditLog } from '../src/models/audit.model.js';
import { generateToken } from '../src/utils/token.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Stage 8: Administrator Governance Dashboard', () => {
  const app = createApp();

  let adminToken, adminId;
  let ownerToken, ownerId;
  let viewerToken, viewerId;

  beforeEach(async () => {
    User.clearInMemory();
    Document.clearInMemory();
    AuditLog.clearInMemory();

    // Create a Document Owner via registration
    const resOwner = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Document Owner',
        email: 'owner@trustvault.test',
        password: 'Password123!',
      });
    ownerToken = resOwner.body.data.token;
    ownerId = resOwner.body.data.user._id || resOwner.body.data.user.id;

    // Seed Viewer directly with role 'viewer'
    const viewerUser = await User.create({
      name: 'Document Viewer',
      email: 'viewer@trustvault.test',
      passwordHash: 'seeded_viewer_hash_for_testing',
      role: 'viewer',
    });
    viewerId = viewerUser._id || viewerUser.id;
    viewerToken = generateToken(viewerUser);

    // Seed admin user directly (THREAT-06 mitigation: can't register as admin)
    const adminUser = await User.create({
      name: 'Platform Admin',
      email: 'admin@trustvault.test',
      passwordHash: 'seeded_admin_hash_for_testing',
      role: 'admin',
    });
    adminId = adminUser._id || adminUser.id;
    adminToken = generateToken(adminUser);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // RBAC Enforcement
  // ─────────────────────────────────────────────────────────────────────────
  describe('RBAC Enforcement — Non-admin users receive 403 Forbidden', () => {
    const adminEndpoints = [
      { method: 'get', path: '/api/admin/analytics' },
      { method: 'get', path: '/api/admin/audit-logs' },
      { method: 'get', path: '/api/admin/audit-logs/export' },
      { method: 'get', path: '/api/admin/users' },
    ];

    adminEndpoints.forEach(({ method, path: ep }) => {
      it(`CRITICAL: Document Owner accessing ${method.toUpperCase()} ${ep} receives 403`, async () => {
        const res = await request(app)
          [method](ep)
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      it(`Viewer accessing ${method.toUpperCase()} ${ep} receives 403`, async () => {
        const res = await request(app)
          [method](ep)
          .set('Authorization', `Bearer ${viewerToken}`);

        expect(res.status).toBe(403);
      });
    });

    it('Unauthenticated request to admin endpoint receives 401', async () => {
      const res = await request(app).get('/api/admin/analytics');
      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Analytics Endpoint
  // ─────────────────────────────────────────────────────────────────────────
  describe('Analytics Dashboard', () => {
    it('should return comprehensive system metrics for admin', async () => {
      // Upload a document to generate data
      const testFilePath = path.join(__dirname, 'test-files-stage8-analytics.txt');
      fs.writeFileSync(testFilePath, 'Analytics test document content');

      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('title', 'Analytics Test Doc')
        .attach('file', testFilePath);

      const res = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // Validate overview structure
      expect(res.body.overview).toBeDefined();
      expect(res.body.overview.totalUsers).toBeGreaterThanOrEqual(3); // admin + owner + viewer
      expect(res.body.overview.totalDocuments).toBeGreaterThanOrEqual(1);
      expect(res.body.overview.totalAuditEvents).toBeGreaterThanOrEqual(0);

      // Validate role distribution
      expect(res.body.users.roleDistribution).toBeDefined();
      expect(res.body.users.roleDistribution.admin).toBeGreaterThanOrEqual(1);
      expect(res.body.users.roleDistribution.owner).toBeGreaterThanOrEqual(1);
      expect(res.body.users.roleDistribution.viewer).toBeGreaterThanOrEqual(1);

      // Validate permissions structure
      expect(res.body.permissions).toBeDefined();
      expect(typeof res.body.permissions.totalPermissions).toBe('number');

      // Validate activity trend (7 days)
      expect(res.body.activityTrend).toBeDefined();
      expect(res.body.activityTrend).toHaveLength(7);

      // Cleanup
      if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Audit Log Viewer
  // ─────────────────────────────────────────────────────────────────────────
  describe('Global Audit Log Viewer', () => {
    beforeEach(async () => {
      // Generate audit events by uploading documents
      const filePath = path.join(__dirname, 'test-files-stage8-audit.txt');
      fs.writeFileSync(filePath, 'Audit test content');

      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('title', 'Audit Test Document Alpha')
        .attach('file', filePath);

      await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('title', 'Audit Test Document Beta')
        .attach('file', filePath);

      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    it('should return paginated audit logs for admin', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.logs).toBeDefined();
      expect(Array.isArray(res.body.logs)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.totalItems).toBeGreaterThanOrEqual(2);
    });

    it('should support filtering by action type', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs?action=DOCUMENT_UPLOAD')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.logs.forEach((log) => {
        expect(log.action).toBe('DOCUMENT_UPLOAD');
      });
    });

    it('should support pagination with custom page and limit', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBeLessThanOrEqual(1);
      expect(res.body.pagination.limit).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Audit Log Export
  // ─────────────────────────────────────────────────────────────────────────
  describe('Audit Log Export (No Truncation)', () => {
    beforeEach(async () => {
      const filePath = path.join(__dirname, 'test-files-stage8-export.txt');
      fs.writeFileSync(filePath, 'Export test content');

      // Create 5 audit events
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/documents')
          .set('Authorization', `Bearer ${ownerToken}`)
          .field('title', `Export Test Doc ${i + 1}`)
          .attach('file', filePath);
      }

      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    it('CRITICAL: JSON export contains all records without truncation', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs/export?format=json')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalRecords).toBeGreaterThanOrEqual(5);
      expect(res.body.logs).toHaveLength(res.body.totalRecords);

      // Verify no data is missing — each log should have all required fields
      res.body.logs.forEach((log) => {
        expect(log.actorId).toBeDefined();
        expect(log.actorEmail).toBeDefined();
        expect(log.action).toBeDefined();
        expect(log.targetDocumentId).toBeDefined();
        expect(log.timestamp).toBeDefined();
      });
    });

    it('CRITICAL: CSV export contains all records without truncation', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs/export?format=csv')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/trustvault-audit-log\.csv/);

      // Parse CSV: first line is header, remaining are data rows
      const lines = res.text.trim().split('\n');
      const headerLine = lines[0];
      const dataLines = lines.slice(1);

      expect(headerLine).toContain('timestamp');
      expect(headerLine).toContain('actorEmail');
      expect(headerLine).toContain('action');
      expect(dataLines.length).toBeGreaterThanOrEqual(5);

      // Verify each data row has the same number of columns as header
      const headerCols = headerLine.split(',').length;
      dataLines.forEach((line) => {
        // Match quoted fields or unquoted values
        const matches = [...line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g)];
        expect(matches.length).toBe(headerCols);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // User Management
  // ─────────────────────────────────────────────────────────────────────────
  describe('User Management Console', () => {
    it('should list all users with document ownership counts', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThanOrEqual(3);
      expect(Array.isArray(res.body.users)).toBe(true);

      // Each user should have required fields
      res.body.users.forEach((u) => {
        expect(u._id).toBeDefined();
        expect(u.name).toBeDefined();
        expect(u.email).toBeDefined();
        expect(u.role).toBeDefined();
        expect(typeof u.isActive).toBe('boolean');
        expect(typeof u.documentsOwned).toBe('number');
      });
    });

    it('should return detailed user profile with permissions', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${ownerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('owner@trustvault.test');
      expect(typeof res.body.documentsOwned).toBe('number');
      expect(typeof res.body.documentsSharedWith).toBe('number');
      expect(Array.isArray(res.body.recentAuditEvents)).toBe(true);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .get('/api/admin/users/nonexistent_user_id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should deactivate a user account', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${ownerId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.isActive).toBe(false);
      expect(res.body.message).toContain('deactivated');
    });

    it('should prevent admin from deactivating themselves', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${adminId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_DEACTIVATION');
    });

    it('should prevent deactivating an already deactivated user', async () => {
      // First deactivate
      await request(app)
        .patch(`/api/admin/users/${ownerId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Try again
      const res = await request(app)
        .patch(`/api/admin/users/${ownerId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ALREADY_DEACTIVATED');
    });

    it('should reactivate a deactivated user account', async () => {
      // Deactivate first
      await request(app)
        .patch(`/api/admin/users/${ownerId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Reactivate
      const res = await request(app)
        .patch(`/api/admin/users/${ownerId}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.isActive).toBe(true);
      expect(res.body.message).toContain('reactivated');
    });

    it('should return error when reactivating an already active user', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${ownerId}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ALREADY_ACTIVE');
    });
  });
});
