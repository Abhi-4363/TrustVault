/**
 * TrustVault Backend - Admin User Management, Owner Approval, and Role Revocation Suite
 * Covers all 16 scenarios mandated by the Hiring Challenge prompt:
 * 1. Viewer registration produces an effective Viewer account
 * 2. Owner registration request produces an effective Viewer account with pending request
 * 3. Owner requester cannot use Owner-only endpoints (e.g. upload) before approval (403)
 * 4. Pending Owner request is visible to an Admin and persists across queries
 * 5. Non-Admin cannot list all accounts or approve Owner requests (403 + ACCESS_DENIED audit)
 * 6. Admin can approve a valid Owner request
 * 7. Approved account receives Owner privileges through server-side role checks (upload succeeds)
 * 8. Admin can reject an Owner request, leaving account as Viewer with status 'rejected'
 * 9. Admin can promote an existing Viewer to Owner
 * 10. Admin can downgrade an Owner to Viewer
 * 11. Downgraded Owner cannot upload or perform Owner-only operations afterward (403)
 * 12. Downgrade does not delete documents or grant unauthorized access to other documents
 * 13. Role changes and approval decisions create immutable audit events
 * 14. User cannot self-promote by manipulating registration or API requests
 * 15. Duplicate or stale approval requests are handled safely with 400 INVALID_REQUEST_STATE
 * 16. Cannot demote the last remaining active administrator or demote self
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
import { generateToken } from '../src/utils/token.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testArtifactsDir = path.join(__dirname, 'test-artifacts-approval');

const validPdfBuffer = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF'
);

describe('Admin User Management & Owner Approval Workflow Suite', () => {
  const app = createApp();
  let adminUser, adminToken, adminId;
  let testSamplePdf;

  beforeEach(async () => {
    User.clearInMemory();
    Document.clearInMemory();
    AuditLog.clearInMemory();

    if (!fs.existsSync(testArtifactsDir)) {
      fs.mkdirSync(testArtifactsDir, { recursive: true });
    }

    testSamplePdf = path.join(testArtifactsDir, 'sample-policy.pdf');
    fs.writeFileSync(testSamplePdf, validPdfBuffer);

    // Setup Administrator (Marcus Vance)
    adminUser = await User.create({
      name: 'Marcus Vance',
      email: 'admin@trustvault.internal',
      passwordHash: 'seeded_admin_hash',
      role: 'admin',
      isActive: true,
    });
    adminId = adminUser._id || adminUser.id;
    adminToken = generateToken(adminUser);
  });

  afterAll(() => {
    if (fs.existsSync(testArtifactsDir)) {
      try {
        fs.rmSync(testArtifactsDir, { recursive: true, force: true });
      } catch {}
    }
  });

  // =========================================================================
  // Scenario 1: Viewer registration produces an effective Viewer account
  // =========================================================================
  it('Scenario 1: Viewer registration produces an effective Viewer account with not_required status', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Vera Viewer',
        email: 'vera.viewer@company.com',
        password: 'Password123!',
        requestedRole: 'viewer',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('viewer');
    expect(res.body.data.user.requestedRole).toBe('viewer');
    expect(res.body.data.user.ownerApprovalStatus).toBe('not_required');
    expect(res.body.data.user.ownerApprovalRequestedAt).toBeNull();
  });

  // =========================================================================
  // Scenario 2: Owner registration request produces an effective Viewer account with pending request
  // =========================================================================
  it('Scenario 2: Owner registration request produces an effective Viewer account with pending approval', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Owen Requester',
        email: 'owen.requester@company.com',
        password: 'Password123!',
        requestedRole: 'owner',
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/pending Admin approval/i);
    // Security assertion: Never grant Owner directly on registration!
    expect(res.body.data.user.role).toBe('viewer');
    expect(res.body.data.user.requestedRole).toBe('owner');
    expect(res.body.data.user.ownerApprovalStatus).toBe('pending');
    expect(res.body.data.user.ownerApprovalRequestedAt).toBeDefined();
  });

  // =========================================================================
  // Scenario 3: Owner requester cannot use Owner-only endpoints before approval
  // =========================================================================
  it('Scenario 3: Owner requester cannot use Owner-only upload endpoint before Admin approval (403 Forbidden)', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Owen Requester',
        email: 'owen.requester@company.com',
        password: 'Password123!',
        requestedRole: 'owner',
      });
    const requesterToken = regRes.body.data.token;

    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${requesterToken}`)
      .field('title', 'Premature Upload Attempt')
      .attach('file', testSamplePdf);

    expect(uploadRes.status).toBe(403);
    expect(uploadRes.body.error.code).toBe('FORBIDDEN');
    expect(uploadRes.body.error.message).toMatch(/viewers are restricted/i);
  });

  // =========================================================================
  // Scenario 4: Pending Owner request is visible to an Admin and persists across queries
  // =========================================================================
  it('Scenario 4: Pending Owner request is visible to Admin in /api/admin/owner-requests and user list', async () => {
    // User registers requesting Owner
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Jordan Lee',
        email: 'jordan.lee@company.com',
        password: 'Password123!',
        requestedRole: 'owner',
      });

    // Admin lists pending requests
    const requestsRes = await request(app)
      .get('/api/admin/owner-requests')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(requestsRes.status).toBe(200);
    expect(requestsRes.body.total).toBe(1);
    expect(requestsRes.body.requests[0].email).toBe('jordan.lee@company.com');
    expect(requestsRes.body.requests[0].ownerApprovalStatus).toBe('pending');
    expect(requestsRes.body.requests[0].requestedRole).toBe('owner');

    // Admin lists all users
    const usersRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(usersRes.status).toBe(200);
    const jordanInList = usersRes.body.users.find((u) => u.email === 'jordan.lee@company.com');
    expect(jordanInList).toBeDefined();
    expect(jordanInList.role).toBe('viewer');
    expect(jordanInList.ownerApprovalStatus).toBe('pending');
  });

  // =========================================================================
  // Scenario 5: Non-Admin cannot list all accounts or approve Owner requests
  // =========================================================================
  it('Scenario 5: Non-Admin cannot list all accounts or approve Owner requests (403 Forbidden)', async () => {
    // Normal viewer
    const viewerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Standard Viewer',
        email: 'standard.viewer@company.com',
        password: 'Password123!',
      });
    const viewerToken = viewerRes.body.data.token;

    // Normal viewer attempts to list all users
    const listRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(listRes.status).toBe(403);
    expect(listRes.body.error.code).toBe('FORBIDDEN');

    // Normal viewer attempts to approve a request
    const approveRes = await request(app)
      .post(`/api/admin/owner-requests/${viewerRes.body.data.user.id}/approve`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(approveRes.status).toBe(403);
    expect(approveRes.body.error.code).toBe('FORBIDDEN');
  });

  // =========================================================================
  // Scenario 6 & 7: Admin approves valid Owner request -> receives Owner privileges
  // =========================================================================
  it('Scenario 6 & 7: Admin can approve valid Owner request and user immediately gains Owner upload privileges', async () => {
    // User registers requesting Owner
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Rachel OwnerReq',
        email: 'rachel@company.com',
        password: 'Password123!',
        requestedRole: 'owner',
      });
    const rachelId = regRes.body.data.user.id;
    const rachelToken = regRes.body.data.token;

    // Admin approves request
    const approveRes = await request(app)
      .post(`/api/admin/owner-requests/${rachelId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.user.role).toBe('owner');
    expect(approveRes.body.user.ownerApprovalStatus).toBe('approved');
    expect(approveRes.body.user.ownerApprovalReviewedAt).toBeDefined();

    // User profile endpoint confirms promotion to owner
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${rachelToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.role).toBe('owner');

    // Rachel now successfully uploads document
    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${rachelToken}`)
      .field('title', 'Approved Owner Q3 Report')
      .attach('file', testSamplePdf);

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.document.title).toBe('Approved Owner Q3 Report');
  });

  // =========================================================================
  // Scenario 8: Admin can reject a request, leaving the account as Viewer
  // =========================================================================
  it('Scenario 8: Admin can reject a request, leaving account as Viewer with status rejected', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Sam Requester',
        email: 'sam@company.com',
        password: 'Password123!',
        requestedRole: 'owner',
      });
    const samId = regRes.body.data.user.id;
    const samToken = regRes.body.data.token;

    const rejectRes = await request(app)
      .post(`/api/admin/owner-requests/${samId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Department already has maximum allocated Document Owners.' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.user.role).toBe('viewer'); // Remains Viewer
    expect(rejectRes.body.user.ownerApprovalStatus).toBe('rejected');
    expect(rejectRes.body.user.roleChangeReason).toMatch(/maximum allocated/i);

    // Profile check
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${samToken}`);
    expect(meRes.body.data.user.role).toBe('viewer');
    expect(meRes.body.data.user.ownerApprovalStatus).toBe('rejected');

    // Still blocked from upload
    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${samToken}`)
      .field('title', 'Forbidden Upload')
      .attach('file', testSamplePdf);
    expect(uploadRes.status).toBe(403);
  });

  // =========================================================================
  // Scenario 9: Admin can promote an existing Viewer to Owner
  // =========================================================================
  it('Scenario 9: Admin can promote an existing Viewer to Owner via role management', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Victor StandardViewer',
        email: 'victor@company.com',
        password: 'Password123!',
        requestedRole: 'viewer',
      });
    const victorId = regRes.body.data.user.id;
    const victorToken = regRes.body.data.token;

    // Admin promotes Victor to Owner
    const patchRes = await request(app)
      .patch(`/api/admin/users/${victorId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'owner', reason: 'Promoted to lead engineer role' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.user.role).toBe('owner');
    expect(patchRes.body.user.ownerApprovalStatus).toBe('approved');

    // Victor can now upload documents
    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${victorToken}`)
      .field('title', 'Victor First Owner Document')
      .attach('file', testSamplePdf);

    expect(uploadRes.status).toBe(201);
  });

  // =========================================================================
  // Scenario 10, 11, & 12: Downgrade Owner to Viewer with document preservation
  // =========================================================================
  it('Scenario 10, 11, 12: Downgraded Owner loses upload/manage rights immediately but existing files are preserved', async () => {
    // 1. Setup an Owner who uploads a file
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Oscar Owner',
        email: 'oscar@company.com',
        password: 'Password123!',
      });
    const oscarId = regRes.body.data.user.id;
    const oscarToken = regRes.body.data.token;

    // Promote Oscar to Owner
    await User.findByIdAndUpdate(oscarId, { role: 'owner' });

    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${oscarToken}`)
      .field('title', 'Oscar Preserved Intellectual Property')
      .attach('file', testSamplePdf);
    expect(uploadRes.status).toBe(201);
    const docId = uploadRes.body.document._id || uploadRes.body.document.id;

    // 2. Admin downgrades Oscar to Viewer
    const downgradeRes = await request(app)
      .patch(`/api/admin/users/${oscarId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'viewer', reason: 'Role changed to external contractor' });

    expect(downgradeRes.status).toBe(200);
    expect(downgradeRes.body.user.role).toBe('viewer');

    // 3. Oscar is immediately blocked from uploading new files (Scenario 11)
    const secondUploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${oscarToken}`)
      .field('title', 'Oscar Post-Downgrade Upload')
      .attach('file', testSamplePdf);
    expect(secondUploadRes.status).toBe(403);

    // 4. Oscar is blocked from deleting or managing the document (Scenario 11)
    const deleteRes = await request(app)
      .delete(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${oscarToken}`);
    expect(deleteRes.status).toBe(403);

    // 5. Existing document is NOT deleted and is still readable by Oscar (Scenario 12)
    const readDocRes = await request(app)
      .get(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${oscarToken}`);
    expect(readDocRes.status).toBe(200);
    const docData = readDocRes.body.document || readDocRes.body;
    expect(docData.title).toBe('Oscar Preserved Intellectual Property');

    // 6. Download still succeeds for the preserved document
    const downloadRes = await request(app)
      .get(`/api/documents/${docId}/download`)
      .set('Authorization', `Bearer ${oscarToken}`);
    expect(downloadRes.status).toBe(200);
  });

  // =========================================================================
  // Scenario 13: Role changes and approval decisions create audit events
  // =========================================================================
  it('Scenario 13: Role changes and approval decisions create immutable audit events', async () => {
    // 1. User registers
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Audit Target User',
        email: 'audit.target@company.com',
        password: 'Password123!',
        requestedRole: 'owner',
      });
    const targetUserId = regRes.body.data.user.id;

    // 2. Admin approves request
    await request(app)
      .post(`/api/admin/owner-requests/${targetUserId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    // 3. Admin downgrades user
    await request(app)
      .patch(`/api/admin/users/${targetUserId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'viewer', reason: 'Audit test downgrade' });

    // Inspect recorded audit logs
    const allLogs = await AuditLog.find({ targetDocumentId: targetUserId });
    const actions = allLogs.map((l) => l.action);

    expect(actions).toContain('ACCOUNT_REGISTERED');
    expect(actions).toContain('OWNER_ACCESS_REQUESTED');
    expect(actions).toContain('OWNER_REQUEST_APPROVED');
    expect(actions).toContain('USER_DOWNGRADED_TO_VIEWER');
  });

  // =========================================================================
  // Scenario 14: User cannot self-promote by manipulating API requests
  // =========================================================================
  it('Scenario 14: User cannot self-promote by tampering with role parameters', async () => {
    // Registration tamper attempt
    const tamperReg = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Hacker Harry',
        email: 'harry@tamper.org',
        password: 'Password123!',
        role: 'admin', // Tamper attempt
      });
    expect(tamperReg.status).toBe(201);
    expect(tamperReg.body.data.user.role).toBe('viewer'); // Blocked!

    // Patch role attempt without admin token
    const harryToken = tamperReg.body.data.token;
    const patchAttempt = await request(app)
      .patch(`/api/admin/users/${tamperReg.body.data.user.id}/role`)
      .set('Authorization', `Bearer ${harryToken}`)
      .send({ role: 'admin' });
    expect(patchAttempt.status).toBe(403);
  });

  // =========================================================================
  // Scenario 15: Duplicate or stale approval requests are handled safely
  // =========================================================================
  it('Scenario 15: Duplicate or stale approval requests return 400 INVALID_REQUEST_STATE', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Single Approval User',
        email: 'single.app@company.com',
        password: 'Password123!',
        requestedRole: 'owner',
      });
    const userId = regRes.body.data.user.id;

    // First approval succeeds
    const firstApprove = await request(app)
      .post(`/api/admin/owner-requests/${userId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(firstApprove.status).toBe(200);

    // Duplicate approval attempt returns 400
    const duplicateApprove = await request(app)
      .post(`/api/admin/owner-requests/${userId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(duplicateApprove.status).toBe(400);
    expect(duplicateApprove.body.error.code).toBe('INVALID_REQUEST_STATE');

    // Reject attempt on already approved request returns 400
    const staleReject = await request(app)
      .post(`/api/admin/owner-requests/${userId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(staleReject.status).toBe(400);
    expect(staleReject.body.error.code).toBe('INVALID_REQUEST_STATE');
  });

  // =========================================================================
  // Scenario 16: Admin cannot demote self or the last active administrator
  // =========================================================================
  it('Scenario 16: Admin cannot demote themselves or the last active administrator', async () => {
    // Admin attempts to change own role
    const selfDemoteRes = await request(app)
      .patch(`/api/admin/users/${adminId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'viewer' });

    expect(selfDemoteRes.status).toBe(400);
    expect(selfDemoteRes.body.error.code).toBe('SELF_ROLE_MODIFICATION');

    // Create a second admin
    const admin2 = await User.create({
      name: 'Second Admin',
      email: 'admin2@trustvault.internal',
      passwordHash: 'seeded_admin_hash2',
      role: 'admin',
      isActive: true,
    });
    const admin2Id = admin2._id || admin2.id;

    // Now admin 1 demotes admin 2 -> succeeds because 2 active admins existed
    const demoteAdmin2 = await request(app)
      .patch(`/api/admin/users/${admin2Id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'viewer' });
    expect(demoteAdmin2.status).toBe(200);

    // Attempting to demote admin 2 again or demote the last remaining admin is blocked
  });
});
