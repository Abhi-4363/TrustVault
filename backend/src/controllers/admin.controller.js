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

    return res.status(200).json({
      overview: {
        totalUsers: allUsers.length,
        activeUsers: activeUsers.length,
        deactivatedUsers: deactivatedUsers.length,
        totalDocuments: allDocs.length,
        totalStorageBytes,
        totalAuditEvents: allAuditLogs.length,
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
        _id: userId,
        name: u.name,
        email: u.email,
        role: u.role,
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

    return res.status(200).json({
      message: `User account "${targetUser.name}" has been deactivated.`,
      user: {
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

    return res.status(200).json({
      message: `User account "${targetUser.name}" has been reactivated.`,
      user: {
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
