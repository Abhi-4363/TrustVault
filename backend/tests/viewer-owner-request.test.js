/**
 * TrustVault Backend - Viewer Owner Access Request Suite
 * Comprehensive regression tests for the Viewer dashboard Owner Access Request feature:
 * 
 * 1. A Viewer can submit an Owner Access Request.
 * 2. Submitting a request does not immediately grant Owner privileges.
 * 3. A duplicate pending request is not created (returns 409 and avoids duplicate notifications).
 * 4. The request appears in Admin Notifications (with user's correct name, email, request type, pending status).
 * 5. The request appears in User Directory/Governance (/api/admin/owner-requests).
 * 6. Approval from Notifications changes the role to 'owner' and synchronizes User Directory.
 * 7. Approval from User Directory/Governance changes the role to 'owner' and synchronizes Notifications.
 * 8. Rejection from either interface leaves the user as Viewer.
 * 9. Non-Admins cannot approve requests through direct API calls (returns 403 Forbidden).
 * 10. An approved user receives Owner privileges based on backend-confirmed role (/api/auth/me returns role: owner and user can upload).
 * 11. Rejected user can submit a new request following retry policy.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Document } from '../src/models/document.model.js';
import { AuditLog } from '../src/models/audit.model.js';
import { AdminNotification } from '../src/models/notification.model.js';
import { generateToken } from '../src/utils/token.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testArtifactsDir = path.join(__dirname, 'test-artifacts-viewer-request');

const validPdfBuffer = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF'
);

describe('Viewer Dashboard - Request Owner Access Suite', () => {
  const app = createApp();
  let adminUser, adminToken;
  let viewerUser, viewerToken, viewerId;
  let testSamplePdf;

  beforeEach(async () => {
    User.clearInMemory();
    Document.clearInMemory();
    AuditLog.clearInMemory();
    if (AdminNotification.clearInMemory) {
      AdminNotification.clearInMemory();
    }

    if (!fs.existsSync(testArtifactsDir)) {
      fs.mkdirSync(testArtifactsDir, { recursive: true });
    }

    testSamplePdf = path.join(testArtifactsDir, 'sample-policy.pdf');
    fs.writeFileSync(testSamplePdf, validPdfBuffer);

    // Bootstrap Admin (Marcus Vance)
    adminUser = await User.create({
      name: 'Marcus Vance',
      email: 'admin@trustvault.internal',
      role: 'admin',
      passwordHash: '$2a$04$fakeHashMarcusVanceAdministrator12345678901234567890',
      isActive: true,
      isEmailVerified: true,
      ownerApprovalStatus: 'not_required',
    });
    adminToken = generateToken(adminUser);

    // Bootstrap Viewer (Jordan Rivera)
    viewerUser = await User.create({
      name: 'Jordan Rivera',
      email: 'viewer@trustvault.internal',
      role: 'viewer',
      passwordHash: '$2a$04$fakeHashJordanRiveraViewer1234567890123456789012345',
      isActive: true,
      isEmailVerified: true,
      ownerApprovalStatus: 'not_required',
    });
    viewerId = String(viewerUser._id || viewerUser.id);
    viewerToken = generateToken(viewerUser);
  });

  afterAll(() => {
    if (fs.existsSync(testArtifactsDir)) {
      fs.rmSync(testArtifactsDir, { recursive: true, force: true });
    }
  });

  // 1. A Viewer can submit an Owner Access Request
  it('Scenario 1: Authenticated Viewer can submit an Owner Access Request', async () => {
    const res = await request(app)
      .post('/api/auth/request-owner-access')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.user.role).toBe('viewer'); // Remains viewer
    expect(res.body.data.user.ownerApprovalStatus).toBe('pending');
    expect(res.body.data.user.requestedRole).toBe('owner');
    expect(res.body.data.user.ownerApprovalRequestedAt).toBeDefined();

    // Verify persisted record in DB
    const updatedViewer = await User.findById(viewerId);
    expect(updatedViewer.role).toBe('viewer');
    expect(updatedViewer.ownerApprovalStatus).toBe('pending');
    expect(updatedViewer.requestedRole).toBe('owner');
  });

  // 2. Submitting a request does not immediately grant Owner privileges
  it('Scenario 2: Submitting request does NOT immediately grant Owner privileges', async () => {
    // Submit request
    await request(app)
      .post('/api/auth/request-owner-access')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send();

    // Verify /api/auth/me returns effective role viewer
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.role).toBe('viewer');
    expect(meRes.body.data.user.ownerApprovalStatus).toBe('pending');

    // Attempting an owner-only action (upload) must be rejected with 403 Forbidden
    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${viewerToken}`)
      .attach('file', testSamplePdf)
      .field('title', 'Unauthorized Document Upload');

    expect(uploadRes.status).toBe(403);
    expect(uploadRes.body.error.code).toBe('FORBIDDEN');
  });

  // 3. A duplicate pending request is not created
  it('Scenario 3: Duplicate request submission is rejected with 409 Conflict', async () => {
    // First submission
    const firstRes = await request(app)
      .post('/api/auth/request-owner-access')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send();
    expect(firstRes.status).toBe(200);

    // Second submission attempt
    const secondRes = await request(app)
      .post('/api/auth/request-owner-access')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send();

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.error.code).toBe('REQUEST_ALREADY_PENDING');
    expect(secondRes.body.error.ownerApprovalStatus).toBe('pending');

    // Ensure only 1 AdminNotification was created
    const notifications = await AdminNotification.find({
      userId: viewerId,
      type: { $in: ['owner_access_request', 'owner_request'] },
    });
    expect(notifications.length).toBe(1);
  });

  // 4. The request appears in Admin Notifications
  it('Scenario 4: Request appears in Admin Notification Center with correct fields', async () => {
    await request(app)
      .post('/api/auth/request-owner-access')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send();

    const notifRes = await request(app)
      .get('/api/admin/notifications')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(notifRes.status).toBe(200);
    const notifications = notifRes.body.data?.notifications || notifRes.body.notifications;
    const ownerNotif = notifications.find(
      (n) => n.userId === viewerId && (n.type === 'owner_access_request' || n.type === 'owner_request')
    );

    expect(ownerNotif).toBeDefined();
    expect(ownerNotif.userName).toBe('Jordan Rivera');
    expect(ownerNotif.userEmail).toBe('viewer@trustvault.internal');
    expect(ownerNotif.status).toBe('pending');
    expect(ownerNotif.title).toBe('Document Owner Access Request');
    // Ensure it is NOT a password reset request
    expect(ownerNotif.type).not.toBe('password_reset_request');
  });

  // 5. The request appears in User Directory / Governance
  it('Scenario 5: Request appears in Admin User Directory / Governance', async () => {
    await request(app)
      .post('/api/auth/request-owner-access')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send();

    const listRes = await request(app)
      .get('/api/admin/owner-requests')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.requests).toBeDefined();
    const requestItem = listRes.body.requests.find((r) => r.id === viewerId || r._id === viewerId);
    expect(requestItem).toBeDefined();
    expect(requestItem.name).toBe('Jordan Rivera');
    expect(requestItem.email).toBe('viewer@trustvault.internal');
    expect(requestItem.ownerApprovalStatus).toBe('pending');
  });

  // 6. Approval from Notifications changes role and synchronizes User Directory
  it('Scenario 6: Approval from Notifications elevates role and synchronizes User Directory', async () => {
    await request(app)
      .post('/api/auth/request-owner-access')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send();

    // Get notification ID
    const notifs = await AdminNotification.find({ userId: viewerId });
    const notifId = String(notifs[0]._id || notifs[0].id);

    // Admin approves via notification endpoint
    const approveRes = await request(app)
      .post(`/api/admin/notifications/${notifId}/approve-owner`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.user.role).toBe('owner');
    expect(approveRes.body.user.ownerApprovalStatus).toBe('approved');

    // Verify User Directory has 0 pending requests now
    const listRes = await request(app)
      .get('/api/admin/owner-requests')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body.total).toBe(0);

    // Verify User in User Directory shows role 'owner'
    const userDetailRes = await request(app)
      .get(`/api/admin/users/${viewerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(userDetailRes.status).toBe(200);
    const detailUser = userDetailRes.body.user || userDetailRes.body.data?.user;
    expect(detailUser.role).toBe('owner');
  });

  // 7. Approval from User Directory / Governance synchronizes Notifications
  it('Scenario 7: Approval from User Directory synchronizes Notifications', async () => {
    await request(app)
      .post('/api/auth/request-owner-access')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send();

    // Admin approves via User Directory / Governance endpoint
    const approveRes = await request(app)
      .post(`/api/admin/owner-requests/${viewerId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.user.role).toBe('owner');
    expect(approveRes.body.user.ownerApprovalStatus).toBe('approved');

    // Verify Notifications are updated to 'approved' and 'isRead: true'
    const notifRes = await request(app)
      .get('/api/admin/notifications')
      .set('Authorization', `Bearer ${adminToken}`);
    const notifications = notifRes.body.data?.notifications || notifRes.body.notifications;
    const ownerNotif = notifications.find((n) => n.userId === viewerId);
    expect(ownerNotif.status).toBe('approved');
    expect(ownerNotif.isRead).toBe(true);
  });

  // 8. Rejection from either interface leaves the user as Viewer
  it('Scenario 8: Rejection keeps user as Viewer and updates status in both interfaces', async () => {
    await request(app)
      .post('/api/auth/request-owner-access')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send();

    // Admin rejects via User Directory
    const rejectRes = await request(app)
      .post(`/api/admin/owner-requests/${viewerId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Insufficient corporate justification for upload rights.' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.user.role).toBe('viewer');
    expect(rejectRes.body.user.ownerApprovalStatus).toBe('rejected');

    // Verify /api/auth/me returns rejected status and viewer role
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(meRes.body.data.user.role).toBe('viewer');
    expect(meRes.body.data.user.ownerApprovalStatus).toBe('rejected');

    // Verify notification is marked rejected
    const notifRes = await request(app)
      .get('/api/admin/notifications')
      .set('Authorization', `Bearer ${adminToken}`);
    const notifications = notifRes.body.data?.notifications || notifRes.body.notifications;
    const ownerNotif = notifications.find((n) => n.userId === viewerId);
    expect(ownerNotif.status).toBe('rejected');
  });

  // 9. Non-Admins cannot approve requests through direct API calls
  it('Scenario 9: Non-Admin receives 403 Forbidden when attempting approval endpoints', async () => {
    await request(app)
      .post('/api/auth/request-owner-access')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send();

    // Viewer attempts to call approval endpoint on their own request
    const directApproveRes = await request(app)
      .post(`/api/admin/owner-requests/${viewerId}/approve`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send();

    expect(directApproveRes.status).toBe(403);
    expect(directApproveRes.body.error.code).toBe('FORBIDDEN');

    // Verify user is STILL viewer and STILL pending
    const checkUser = await User.findById(viewerId);
    expect(checkUser.role).toBe('viewer');
    expect(checkUser.ownerApprovalStatus).toBe('pending');
  });

  // 10. An approved user receives the Owner privileges based on backend-confirmed role
  it('Scenario 10: Approved user can upload and manage documents after approval', async () => {
    // 1. Submit request
    await request(app)
      .post('/api/auth/request-owner-access')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send();

    // 2. Admin approves
    await request(app)
      .post(`/api/admin/owner-requests/${viewerId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    // 3. /api/auth/me confirms role: owner
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(meRes.body.data.user.role).toBe('owner');
    expect(meRes.body.data.user.ownerApprovalStatus).toBe('approved');

    // 4. User can now upload files successfully!
    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${viewerToken}`)
      .attach('file', testSamplePdf)
      .field('title', 'Enterprise Q3 Financial Report')
      .field('visibility', 'private');

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.document).toBeDefined();
    expect(uploadRes.body.document.title).toBe('Enterprise Q3 Financial Report');
  });

  // 11. Retry policy: Rejected Viewer can submit a new Owner Access Request
  it('Scenario 11: Rejected Viewer can re-submit an Owner Access Request', async () => {
    // 1. Initial submission
    await request(app)
      .post('/api/auth/request-owner-access')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send();

    // 2. Admin rejects
    await request(app)
      .post(`/api/admin/owner-requests/${viewerId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Initial request declined. Please re-apply with department approval.' });

    // 3. User re-submits
    const retryRes = await request(app)
      .post('/api/auth/request-owner-access')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send();

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.status).toBe('success');
    expect(retryRes.body.data.user.ownerApprovalStatus).toBe('pending');

    // 4. Admin sees new pending request
    const listRes = await request(app)
      .get('/api/admin/owner-requests')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body.total).toBe(1);
    expect(listRes.body.requests[0].ownerApprovalStatus).toBe('pending');
  });
});
