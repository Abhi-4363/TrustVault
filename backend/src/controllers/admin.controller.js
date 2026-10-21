/**
 * TrustVault Backend - Administrator Governance Controller (Stage 8)
 * Provides admin-only endpoints for:
 *   1. System analytics (totals, permission distribution, access patterns)
 *   2. Global audit log viewer with filtering + CSV/JSON export
 *   3. User management console (list, view, deactivate accounts)
 */

import { User } from '../models/user.model.js';
import { Document } from '../models/document.model.js';
import { AuditLog } from '../models/audit.model.js';
import { logAuditEvent } from '../services/audit.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. System Analytics Dashboard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/analytics
 * Returns high-level system metrics for the admin governance dashboard.
 */
export async function getAnalytics(req, res) {
  try {
    const allUsers = await User.find();
    const allDocs = await Document.find();
    const allAuditLogs = await AuditLog.find();

    // ── User distribution by role ──
    const roleCounts = { admin: 0, owner: 0, viewer: 0 };
    const activeUsers = [];
    const deactivatedUsers = [];
    allUsers.forEach((u) => {
      let role = u.role || 'owner';
      if (role === 'document_owner' || role === 'manager') role = 'owner';
      if (role === 'member') role = 'viewer';
      if (roleCounts[role] !== undefined) {
        roleCounts[role]++;
      } else {
        roleCounts.owner = (roleCounts.owner || 0) + 1;
      }
      if (u.isActive === false) {
        deactivatedUsers.push(u);
      } else {
        activeUsers.push(u);
      }
    });

    // ── Document statistics ──
    let totalStorageBytes = 0;
    const formatDistribution = {};
    allDocs.forEach((doc) => {
      totalStorageBytes += doc.fileSize || 0;
      const ext = (doc.originalName || '').split('.').pop().toLowerCase() || 'unknown';
      formatDistribution[ext] = (formatDistribution[ext] || 0) + 1;
    });

    // ── Permission distribution ──
    let totalPermissions = 0;
    let readPermissions = 0;
    let editPermissions = 0;
    allDocs.forEach((doc) => {
      if (Array.isArray(doc.acl)) {
        doc.acl.forEach((entry) => {
          totalPermissions++;
          if (entry.permissionLevel === 'read') readPermissions++;
          else if (entry.permissionLevel === 'edit') editPermissions++;
        });
      }
    });

    // ── High-frequency access patterns (top 10 most-accessed documents) ──
    const accessCountMap = {};
    allAuditLogs.forEach((log) => {
      if (['DOCUMENT_READ', 'DOCUMENT_DOWNLOAD'].includes(log.action)) {
        const docId = String(log.targetDocumentId);
        if (!accessCountMap[docId]) {
          accessCountMap[docId] = {
            documentId: docId,
            title: log.targetDocumentTitle || 'Untitled',
            accessCount: 0,
          };
        }
        accessCountMap[docId].accessCount++;
      }
    });
    const topAccessedDocuments = Object.values(accessCountMap)
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    // ── Action breakdown ──
    const actionBreakdown = {};
    allAuditLogs.forEach((log) => {
      actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1;
    });

    // ── Recent activity trend (last 7 days, one bucket per day) ──
    const now = new Date();
    const activityTrend = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(now.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayCount = allAuditLogs.filter((log) => {
        const ts = new Date(log.timestamp);
        return ts >= dayStart && ts <= dayEnd;
      }).length;

      activityTrend.push({
        date: dayStart.toISOString().split('T')[0],
        events: dayCount,
      });
    }

    const pendingOwnerRequests = allUsers.filter((u) => u.ownerApprovalStatus === 'pending');
    const pendingOwnerRequestsCount = pendingOwnerRequests.length;

    return res.status(200).json({
      overview: {
        totalUsers: allUsers.length,
        activeUsers: activeUsers.length,
        deactivatedUsers: deactivatedUsers.length,
        totalDocuments: allDocs.length,
        totalStorageBytes,
        totalAuditEvents: allAuditLogs.length,
        pendingOwnerRequests: pendingOwnerRequestsCount,
      },
      totals: {
        users: allUsers.length,
        activeUsers: activeUsers.length,
        deactivatedUsers: deactivatedUsers.length,
        documents: allDocs.length,
        activeShares: totalPermissions,
        auditLogs: allAuditLogs.length,
        pendingOwnerRequests: pendingOwnerRequestsCount,
      },
      users: {
        roleDistribution: roleCounts,
      },
      documents: {
        formatDistribution,
      },
      permissions: {
        totalPermissions,
        readPermissions,
        editPermissions,
        read: readPermissions,
        edit: editPermissions,
      },
      topAccessedDocuments,
      actionBreakdown,
      activityTrend,
    });
  } catch (error) {
    console.error('[Admin Analytics Error]:', error);
    return res.status(500).json({
      error: {
        code: 'ANALYTICS_ERROR',
        message: 'Failed to compile system analytics.',
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Global Audit Log Viewer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/audit-logs
 * Returns audit logs with optional filtering by actor, action, date range, document.
 * Supports pagination via `page` and `limit` query params.
 */
export async function getGlobalAuditLogs(req, res) {
  try {
    const {
      actorId,
      actorEmail,
      action,
      documentId,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    let allLogs = await AuditLog.find();

    // Apply filters
    if (actorId) {
      allLogs = allLogs.filter((l) => String(l.actorId) === String(actorId));
    }
    if (actorEmail) {
      allLogs = allLogs.filter(
        (l) => (l.actorEmail || '').toLowerCase() === actorEmail.toLowerCase()
      );
    }
    if (action) {
      allLogs = allLogs.filter((l) => l.action === action);
    }
    if (documentId) {
      allLogs = allLogs.filter((l) => String(l.targetDocumentId) === String(documentId));
    }
    if (startDate) {
      const start = new Date(startDate);
      allLogs = allLogs.filter((l) => new Date(l.timestamp) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      allLogs = allLogs.filter((l) => new Date(l.timestamp) <= end);
    }

    // Sort by newest first
    allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const totalItems = allLogs.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (pageNum - 1) * pageSize;
    const paginatedLogs = allLogs.slice(startIndex, startIndex + pageSize);

    return res.status(200).json({
      logs: paginatedLogs,
      pagination: {
        page: pageNum,
        limit: pageSize,
        totalItems,
        totalPages,
      },
    });
  } catch (error) {
    console.error('[Admin Audit Logs Error]:', error);
    return res.status(500).json({
      error: {
        code: 'AUDIT_LOG_ERROR',
        message: 'Failed to retrieve global audit logs.',
      },
    });
  }
}

/**
 * GET /api/admin/audit-logs/export
 * Exports full audit trail as CSV or JSON (no pagination, no truncation).
 * Query param: format=csv|json (default: json)
 */
export async function exportAuditLogs(req, res) {
  try {
    const { format = 'json', actorEmail, action, documentId, startDate, endDate } = req.query;

    let allLogs = await AuditLog.find();

    // Apply same filters as viewer
    if (actorEmail) {
      allLogs = allLogs.filter(
        (l) => (l.actorEmail || '').toLowerCase() === actorEmail.toLowerCase()
      );
    }
    if (action) {
      allLogs = allLogs.filter((l) => l.action === action);
    }
    if (documentId) {
      allLogs = allLogs.filter((l) => String(l.targetDocumentId) === String(documentId));
    }
    if (startDate) {
      const start = new Date(startDate);
      allLogs = allLogs.filter((l) => new Date(l.timestamp) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      allLogs = allLogs.filter((l) => new Date(l.timestamp) <= end);
    }

    // Sort by timestamp ascending for chronological export
    allLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (format === 'csv') {
      const csvHeaders = [
        'timestamp',
        'actorId',
        'actorEmail',
        'actorName',
        'action',
        'targetDocumentId',
        'targetDocumentTitle',
        'ipAddress',
        'userAgent',
      ];

      const csvRows = allLogs.map((log) =>
        csvHeaders
          .map((h) => {
            const val = String(log[h] || '').replace(/"/g, '""');
            return `"${val}"`;
          })
          .join(',')
      );

      const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="trustvault-audit-log.csv"');
      return res.status(200).send(csvContent);
    }

    // Default: JSON export
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="trustvault-audit-log.json"');
    return res.status(200).json({
      exportDate: new Date().toISOString(),
      totalRecords: allLogs.length,
      logs: allLogs,
    });
  } catch (error) {
    console.error('[Admin Audit Export Error]:', error);
    return res.status(500).json({
      error: {
        code: 'EXPORT_ERROR',
        message: 'Failed to export audit log data.',
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. User Management Console
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/users
 * Lists all users in the system with their roles and document ownership counts.
 */
export async function listAllUsers(req, res) {
  try {
    const allUsers = await User.find();
    const allDocs = await Document.find();

    // Build ownership count map
    const ownershipMap = {};
    allDocs.forEach((doc) => {
      const oid = String(doc.ownerId);
      ownershipMap[oid] = (ownershipMap[oid] || 0) + 1;
    });

    const users = allUsers.map((u) => {
      const userId = String(u._id || u.id);
      return {
        id: userId,
        _id: userId,
        name: u.name,
        email: u.email,
        role: u.role,
        requestedRole: u.requestedRole || null,
        ownerApprovalStatus: u.ownerApprovalStatus || 'not_required',
        ownerApprovalRequestedAt: u.ownerApprovalRequestedAt || null,
        ownerApprovalReviewedAt: u.ownerApprovalReviewedAt || null,
        ownerApprovalReviewedByName: u.ownerApprovalReviewedByName || null,
        roleChangeReason: u.roleChangeReason || '',
        isActive: u.isActive !== false, // default true
        documentsOwned: ownershipMap[userId] || 0,
        createdAt: u.createdAt,
      };
    });

    return res.status(200).json({
      total: users.length,
      users,
    });
  } catch (error) {
    console.error('[Admin List Users Error]:', error);
    return res.status(500).json({
      error: {
        code: 'USER_LIST_ERROR',
        message: 'Failed to retrieve user list.',
      },
    });
  }
}

/**
 * GET /api/admin/users/:userId
 * Retrieves detailed profile and permissions for a specific user.
 */
export async function getUserDetail(req, res) {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The requested user does not exist.',
        },
      });
    }

    const allDocs = await Document.find();
    const ownedDocs = allDocs.filter((d) => String(d.ownerId) === String(userId));
    const sharedWithUser = allDocs.filter((d) => {
      if (String(d.ownerId) === String(userId)) return false;
      return (
        (Array.isArray(d.acl) && d.acl.some((e) => String(e.userId) === String(userId))) ||
        (Array.isArray(d.readers) && d.readers.some((r) => String(r) === String(userId)))
      );
    });

    // Recent audit activity for this user
    const userLogs = await AuditLog.find({ actorId: String(userId) });

    return res.status(200).json({
      user: {
        _id: String(user._id || user.id),
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive !== false,
        createdAt: user.createdAt,
      },
      documentsOwned: ownedDocs.length,
      documentsSharedWith: sharedWithUser.length,
      recentAuditEvents: userLogs.slice(0, 20),
    });
  } catch (error) {
    console.error('[Admin User Detail Error]:', error);
    return res.status(500).json({
      error: {
        code: 'USER_DETAIL_ERROR',
        message: 'Failed to retrieve user details.',
      },
    });
  }
}

/**
 * PATCH /api/admin/users/:userId/deactivate
 * Deactivates a user account. Prevents the user from logging in.
 * Cannot deactivate self or the last remaining admin.
 */
export async function deactivateUser(req, res) {
  try {
    const { userId } = req.params;
    const callerId = String(req.user.id || req.user._id);

    // Cannot deactivate self
    if (userId === callerId) {
      return res.status(400).json({
        error: {
          code: 'SELF_DEACTIVATION',
          message: 'Administrators cannot deactivate their own account.',
        },
      });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The target user does not exist.',
        },
      });
    }

    if (targetUser.isActive === false) {
      return res.status(400).json({
        error: {
          code: 'ALREADY_DEACTIVATED',
          message: 'This user account is already deactivated.',
        },
      });
    }

    // Prevent deactivating the last admin
    if (targetUser.role === 'admin') {
      const allUsers = await User.find();
      const activeAdmins = allUsers.filter(
        (u) => u.role === 'admin' && u.isActive !== false
      );
      if (activeAdmins.length <= 1) {
        return res.status(400).json({
          error: {
            code: 'LAST_ADMIN',
            message: 'Cannot deactivate the last remaining active administrator.',
          },
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { isActive: false },
      { new: true }
    );

    // Record immutable audit event for account deactivation
    await logAuditEvent({
      req,
      action: 'USER_DEACTIVATED',
      documentId: String(targetUser._id || targetUser.id),
      documentTitle: `Account: ${targetUser.email}`,
      metadata: {
        affectedUserId: String(targetUser._id || targetUser.id),
        affectedUserEmail: targetUser.email,
        previousStatus: 'active',
        newStatus: 'deactivated',
        changedBy: req.user.email,
      },
    });

    return res.status(200).json({
      message: `User account "${targetUser.name}" has been deactivated.`,
      user: {
        id: String(updatedUser._id || updatedUser.id),
        _id: String(updatedUser._id || updatedUser.id),
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: false,
      },
    });
  } catch (error) {
    console.error('[Admin Deactivate Error]:', error);
    return res.status(500).json({
      error: {
        code: 'DEACTIVATION_ERROR',
        message: 'Failed to deactivate user account.',
      },
    });
  }
}

/**
 * PATCH /api/admin/users/:userId/reactivate
 * Reactivates a previously deactivated user account.
 */
export async function reactivateUser(req, res) {
  try {
    const { userId } = req.params;

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The target user does not exist.',
        },
      });
    }

    if (targetUser.isActive !== false) {
      return res.status(400).json({
        error: {
          code: 'ALREADY_ACTIVE',
          message: 'This user account is already active.',
        },
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { isActive: true },
      { new: true }
    );

    // Record immutable audit event for account reactivation
    await logAuditEvent({
      req,
      action: 'USER_REACTIVATED',
      documentId: String(targetUser._id || targetUser.id),
      documentTitle: `Account: ${targetUser.email}`,
      metadata: {
        affectedUserId: String(targetUser._id || targetUser.id),
        affectedUserEmail: targetUser.email,
        previousStatus: 'deactivated',
        newStatus: 'active',
        changedBy: req.user.email,
      },
    });

    return res.status(200).json({
      message: `User account "${targetUser.name}" has been reactivated.`,
      user: {
        id: String(updatedUser._id || updatedUser.id),
        _id: String(updatedUser._id || updatedUser.id),
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: true,
      },
    });
  } catch (error) {
    console.error('[Admin Reactivate Error]:', error);
    return res.status(500).json({
      error: {
        code: 'REACTIVATION_ERROR',
        message: 'Failed to reactivate user account.',
      },
    });
  }
}

/**
 * PATCH /api/admin/users/:userId/role
 * Updates a user's global account role ('admin', 'owner', 'viewer').
 * Enforces:
 *   - Caller must be an authenticated administrator (enforced by route middleware)
 *   - Cannot change own role
 *   - Target role must be one of ['admin', 'owner', 'viewer']
 *   - Target user must exist
 *   - Cannot demote the last remaining active administrator
 *   - Records immutable audit log with previousRole, newRole, actor admin
 *   - Returns sanitized user record without password hash
 */
export async function updateUserRole(req, res) {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const callerId = String(req.user.id || req.user._id);

    // 1. Prevent self-role modification
    if (String(userId) === callerId) {
      return res.status(400).json({
        error: {
          code: 'SELF_ROLE_MODIFICATION',
          message: 'Administrators cannot modify their own role directly.',
        },
      });
    }

    // 2. Validate allowed roles
    const ALLOWED_ROLES = ['admin', 'owner', 'viewer'];
    const normalizedRole = String(role || '').toLowerCase().trim();
    if (!normalizedRole || !ALLOWED_ROLES.includes(normalizedRole)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ROLE',
          message: `Role must be one of: ${ALLOWED_ROLES.join(', ')}.`,
        },
      });
    }

    // 3. Find target user
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The target user does not exist.',
        },
      });
    }

    const previousRole = targetUser.role;

    // 4. Prevent demoting the last active administrator
    if (previousRole === 'admin' && normalizedRole !== 'admin') {
      const allUsers = await User.find();
      const activeAdmins = allUsers.filter(
        (u) => u.role === 'admin' && u.isActive !== false
      );
      if (activeAdmins.length <= 1) {
        return res.status(400).json({
          error: {
            code: 'CANNOT_DEMOTE_LAST_ADMIN',
            message: 'Cannot demote the last remaining active administrator.',
          },
        });
      }
    }

    // 5. Update user role
    const updates = { role: normalizedRole };
    let specificAuditAction = 'USER_ROLE_UPDATED';

    if (previousRole === 'viewer' && normalizedRole === 'owner') {
      specificAuditAction = 'USER_PROMOTED_TO_OWNER';
      updates.ownerApprovalStatus = 'approved';
      updates.ownerApprovalReviewedAt = new Date();
      updates.ownerApprovalReviewedBy = callerId;
      updates.ownerApprovalReviewedByName = req.user.name || req.user.email;
      updates.roleChangeReason = req.body.reason ? String(req.body.reason).trim() : 'Promoted to Document Owner by Administrator';
    } else if (previousRole === 'owner' && normalizedRole === 'viewer') {
      specificAuditAction = 'USER_DOWNGRADED_TO_VIEWER';
      updates.roleChangeReason = req.body.reason ? String(req.body.reason).trim() : 'Downgraded to Viewer by Administrator';
      // Critical Security & Data Guarantee: Documents are strictly preserved without deletion or ownership transfer!
    } else if (req.body.reason) {
      updates.roleChangeReason = String(req.body.reason).trim();
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updates,
      { new: true }
    );

    // 6. Record immutable audit log
    await logAuditEvent({
      req,
      action: specificAuditAction,
      documentId: String(targetUser._id || targetUser.id),
      documentTitle: `Account: ${targetUser.email}`,
      metadata: {
        affectedUserId: String(targetUser._id || targetUser.id),
        affectedUserEmail: targetUser.email,
        affectedUserName: targetUser.name,
        previousRole,
        newRole: normalizedRole,
        changedBy: req.user.email,
        reason: updates.roleChangeReason || '',
        documentsPreserved: true,
      },
    });

    return res.status(200).json({
      status: 'success',
      message: `User "${targetUser.name}" role updated from ${previousRole} to ${normalizedRole}.`,
      user: {
        id: String(updatedUser._id || updatedUser.id),
        _id: String(updatedUser._id || updatedUser.id),
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        requestedRole: updatedUser.requestedRole || null,
        ownerApprovalStatus: updatedUser.ownerApprovalStatus || 'not_required',
        ownerApprovalRequestedAt: updatedUser.ownerApprovalRequestedAt || null,
        ownerApprovalReviewedAt: updatedUser.ownerApprovalReviewedAt || null,
        ownerApprovalReviewedByName: updatedUser.ownerApprovalReviewedByName || null,
        roleChangeReason: updatedUser.roleChangeReason || '',
        isActive: updatedUser.isActive !== false,
        createdAt: updatedUser.createdAt,
      },
    });
  } catch (error) {
    console.error('[Admin Update User Role Error]:', error);
    return res.status(500).json({
      error: {
        code: 'ROLE_UPDATE_ERROR',
        message: 'Failed to update user role.',
      },
    });
  }
}

/**
 * GET /api/admin/owner-requests
 * Lists all pending Document Owner access requests.
 */
export async function listOwnerRequests(req, res) {
  try {
    const allUsers = await User.find();
    const pendingUsers = allUsers.filter((u) => u.ownerApprovalStatus === 'pending');

    return res.status(200).json({
      status: 'success',
      total: pendingUsers.length,
      requests: pendingUsers.map((u) => {
        const userId = String(u._id || u.id);
        return {
          id: userId,
          _id: userId,
          name: u.name,
          email: u.email,
          role: u.role,
          requestedRole: u.requestedRole || 'owner',
          ownerApprovalStatus: u.ownerApprovalStatus,
          ownerApprovalRequestedAt: u.ownerApprovalRequestedAt || u.createdAt,
          createdAt: u.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error('[Admin List Owner Requests Error]:', error);
    return res.status(500).json({
      error: {
        code: 'OWNER_REQUESTS_FETCH_ERROR',
        message: 'Failed to retrieve pending owner requests.',
      },
    });
  }
}

/**
 * POST /api/admin/owner-requests/:userId/approve
 * Approves a user's pending Owner access request.
 * Transitions role: 'viewer' -> 'owner' and status: 'pending' -> 'approved'.
 */
export async function approveOwnerRequest(req, res) {
  try {
    const { userId } = req.params;
    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The target user does not exist.',
        },
      });
    }

    if (targetUser.ownerApprovalStatus !== 'pending') {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST_STATE',
          message: `User does not have a pending Owner approval request. Current status: ${targetUser.ownerApprovalStatus || 'not_required'}.`,
        },
      });
    }

    const previousRole = targetUser.role;
    const adminId = String(req.user.id || req.user._id);
    const adminName = req.user.name || req.user.email;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        role: 'owner',
        ownerApprovalStatus: 'approved',
        ownerApprovalReviewedAt: new Date(),
        ownerApprovalReviewedBy: adminId,
        ownerApprovalReviewedByName: adminName,
        roleChangeReason: 'Owner privileges approved by Administrator.',
      },
      { new: true }
    );

    // Record immutable audit event
    await logAuditEvent({
      req,
      action: 'OWNER_REQUEST_APPROVED',
      documentId: String(targetUser._id || targetUser.id),
      documentTitle: `Account: ${targetUser.email}`,
      metadata: {
        affectedUserId: String(targetUser._id || targetUser.id),
        affectedUserEmail: targetUser.email,
        affectedUserName: targetUser.name,
        previousRole,
        newRole: 'owner',
        approvedBy: req.user.email,
        timestamp: new Date().toISOString(),
        outcome: 'approved',
      },
    });

    return res.status(200).json({
      status: 'success',
      message: `Owner access approved for "${targetUser.name}". Account upgraded to Document Owner.`,
      user: {
        id: String(updatedUser._id || updatedUser.id),
        _id: String(updatedUser._id || updatedUser.id),
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        requestedRole: updatedUser.requestedRole || null,
        ownerApprovalStatus: updatedUser.ownerApprovalStatus,
        ownerApprovalRequestedAt: updatedUser.ownerApprovalRequestedAt,
        ownerApprovalReviewedAt: updatedUser.ownerApprovalReviewedAt,
        ownerApprovalReviewedByName: updatedUser.ownerApprovalReviewedByName,
        roleChangeReason: updatedUser.roleChangeReason,
        isActive: updatedUser.isActive !== false,
        createdAt: updatedUser.createdAt,
      },
    });
  } catch (error) {
    console.error('[Admin Approve Owner Request Error]:', error);
    return res.status(500).json({
      error: {
        code: 'OWNER_APPROVAL_ERROR',
        message: 'Failed to approve owner request.',
      },
    });
  }
}

/**
 * POST /api/admin/owner-requests/:userId/reject
 * Rejects a user's pending Owner access request.
 * Retains effective role: 'viewer' and updates status: 'pending' -> 'rejected'.
 */
export async function rejectOwnerRequest(req, res) {
  try {
    const { userId } = req.params;
    const reason = req.body?.reason ? String(req.body.reason).trim() : 'Owner access request rejected by administrator.';
    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The target user does not exist.',
        },
      });
    }

    if (targetUser.ownerApprovalStatus !== 'pending') {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST_STATE',
          message: `User does not have a pending Owner approval request. Current status: ${targetUser.ownerApprovalStatus || 'not_required'}.`,
        },
      });
    }

    const adminId = String(req.user.id || req.user._id);
    const adminName = req.user.name || req.user.email;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        role: 'viewer',
        ownerApprovalStatus: 'rejected',
        ownerApprovalReviewedAt: new Date(),
        ownerApprovalReviewedBy: adminId,
        ownerApprovalReviewedByName: adminName,
        roleChangeReason: reason,
      },
      { new: true }
    );

    // Record immutable audit event
    await logAuditEvent({
      req,
      action: 'OWNER_REQUEST_REJECTED',
      documentId: String(targetUser._id || targetUser.id),
      documentTitle: `Account: ${targetUser.email}`,
      metadata: {
        affectedUserId: String(targetUser._id || targetUser.id),
        affectedUserEmail: targetUser.email,
        affectedUserName: targetUser.name,
        currentRole: 'viewer',
        rejectedBy: req.user.email,
        reason,
        timestamp: new Date().toISOString(),
        outcome: 'rejected',
      },
    });

    return res.status(200).json({
      status: 'success',
      message: `Owner access request for "${targetUser.name}" has been rejected. Account retains Viewer privileges.`,
      user: {
        id: String(updatedUser._id || updatedUser.id),
        _id: String(updatedUser._id || updatedUser.id),
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        requestedRole: updatedUser.requestedRole || null,
        ownerApprovalStatus: updatedUser.ownerApprovalStatus,
        ownerApprovalRequestedAt: updatedUser.ownerApprovalRequestedAt,
        ownerApprovalReviewedAt: updatedUser.ownerApprovalReviewedAt,
        ownerApprovalReviewedByName: updatedUser.ownerApprovalReviewedByName,
        roleChangeReason: updatedUser.roleChangeReason,
        isActive: updatedUser.isActive !== false,
        createdAt: updatedUser.createdAt,
      },
    });
  } catch (error) {
    console.error('[Admin Reject Owner Request Error]:', error);
    return res.status(500).json({
      error: {
        code: 'OWNER_REJECTION_ERROR',
        message: 'Failed to reject owner request.',
      },
    });
  }
}
