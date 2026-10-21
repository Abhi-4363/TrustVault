import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  FileText,
  Activity,
  Key,
  Download,
  Filter,
  RefreshCw,
  Search,
  UserX,
  UserCheck,
  AlertTriangle,
  Calendar,
  Layers,
  ArrowUpDown,
  Clock,
  Check,
  X,
  CheckCircle2,
  XCircle,
  UserMinus,
  UserPlus,
  Info
} from 'lucide-react';
import { Button } from '../common/Button';
import './AdminDashboard.css';

export function AdminDashboard({ user, token, onNavigateToLogin, onPendingCountChange }) {
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'audit' | 'users'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Analytics State
  const [analytics, setAnalytics] = useState(null);

  // 2. Audit Trail State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 15, totalPages: 1, totalItems: 0 });
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    actorEmail: '',
    startDate: '',
    endDate: ''
  });

  // 3. User Governance & Approval State
  const [usersList, setUsersList] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [pendingRequests, setPendingRequests] = useState([]);
  const [deactivatingUserId, setDeactivatingUserId] = useState(null);
  const [updatingRoleId, setUpdatingRoleId] = useState(null);

  // Downgrade and Rejection Modals
  const [downgradeModalUser, setDowngradeModalUser] = useState(null);
  const [downgradeReason, setDowngradeReason] = useState('');
  const [rejectModalUser, setRejectModalUser] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const isAdmin = user && user.role === 'admin';

  // Clear toast notifications after 5 seconds
  useEffect(() => {
    if (successMsg || errorMsg) {
      const timer = setTimeout(() => {
        setSuccessMsg('');
        setErrorMsg('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg, errorMsg]);

  // Fetch Analytics Data
  const fetchAnalytics = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/admin/analytics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error?.message || 'Failed to fetch analytics.');
      }
    } catch {
      setErrorMsg('Network error connecting to governance analytics endpoint.');
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin]);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async (page = 1) => {
    if (!token || !isAdmin) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(auditPagination.limit)
      });
      if (auditFilters.action) query.set('action', auditFilters.action);
      if (auditFilters.actorEmail) query.set('actorEmail', auditFilters.actorEmail);
      if (auditFilters.startDate) query.set('startDate', auditFilters.startDate);
      if (auditFilters.endDate) query.set('endDate', auditFilters.endDate);

      const res = await fetch(`http://localhost:5000/api/admin/audit-logs?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
        setAuditPagination(data.pagination || { page: 1, limit: 15, totalPages: 1, totalItems: 0 });
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error?.message || 'Failed to fetch audit records.');
      }
    } catch {
      setErrorMsg('Network error connecting to audit log service.');
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin, auditPagination.limit, auditFilters]);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error?.message || 'Failed to fetch user directory.');
      }
    } catch {
      setErrorMsg('Network error fetching governance user directory.');
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin]);

  // Fetch Pending Owner Requests (Stage 8)
  const fetchPendingRequests = useCallback(async () => {
    if (!token || !isAdmin) return;
    try {
      const res = await fetch('http://localhost:5000/api/admin/owner-requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const reqs = data.requests || [];
        setPendingRequests(reqs);
        if (typeof onPendingCountChange === 'function') {
          onPendingCountChange(data.total ?? reqs.length);
        }
      }
    } catch (err) {
      console.error('Failed to fetch pending owner requests:', err);
    }
  }, [token, isAdmin, onPendingCountChange]);

  // Initial load according to active tab
  useEffect(() => {
    if (!isAdmin) return;
    fetchPendingRequests();
    if (activeTab === 'analytics') {
      fetchAnalytics();
    } else if (activeTab === 'audit') {
      fetchAuditLogs(1);
    } else if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab, isAdmin, fetchAnalytics, fetchAuditLogs, fetchUsers, fetchPendingRequests]);

  // Approve Pending Owner Request
  const handleApproveRequest = async (targetUserId, targetUserName) => {
    if (!token) return;
    setUpdatingRoleId(targetUserId);
    try {
      const res = await fetch(`http://localhost:5000/api/admin/owner-requests/${targetUserId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || `Owner access approved for ${targetUserName}.`);
        fetchPendingRequests();
        fetchUsers();
        fetchAnalytics();
      } else {
        setErrorMsg(data.error?.message || 'Failed to approve owner request.');
      }
    } catch {
      setErrorMsg('Network error approving owner request.');
    } finally {
      setUpdatingRoleId(null);
    }
  };

  // Reject Pending Owner Request
  const handleRejectRequest = async (targetUserId, reason = '') => {
    if (!token) return;
    setUpdatingRoleId(targetUserId);
    try {
      const res = await fetch(`http://localhost:5000/api/admin/owner-requests/${targetUserId}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: reason || 'Owner access request rejected by administrator.' })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || 'Owner access request rejected.');
        setRejectModalUser(null);
        setRejectReason('');
        fetchPendingRequests();
        fetchUsers();
        fetchAnalytics();
      } else {
        setErrorMsg(data.error?.message || 'Failed to reject owner request.');
      }
    } catch {
      setErrorMsg('Network error rejecting owner request.');
    } finally {
      setUpdatingRoleId(null);
    }
  };

  // Promote Viewer to Document Owner directly
  const handlePromoteUser = async (targetUser) => {
    const targetId = targetUser.id || targetUser._id;
    await handleUpdateUserRole(targetId, 'owner', 'Promoted to Document Owner by administrator.');
  };

  // Confirm Downgrade of Owner to Viewer
  const handleConfirmDowngrade = async () => {
    if (!downgradeModalUser) return;
    const targetId = downgradeModalUser.id || downgradeModalUser._id;
    const reason = downgradeReason.trim() || 'Role downgraded to Viewer by administrator.';
    await handleUpdateUserRole(targetId, 'viewer', reason);
    setDowngradeModalUser(null);
    setDowngradeReason('');
  };

  // Export audit logs (CSV / JSON)
  const handleExport = (format) => {
    if (!token) return;
    const query = new URLSearchParams({ format });
    if (auditFilters.action) query.set('action', auditFilters.action);
    if (auditFilters.actorEmail) query.set('actorEmail', auditFilters.actorEmail);
    if (auditFilters.startDate) query.set('startDate', auditFilters.startDate);
    if (auditFilters.endDate) query.set('endDate', auditFilters.endDate);

    const exportUrl = `http://localhost:5000/api/admin/audit-logs/export?${query.toString()}`;

    // Fetch as blob with Authorization token
    fetch(exportUrl, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Export generation failed');
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trustvault-audit-export.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 10000);
        setSuccessMsg(`Successfully generated and downloaded ${format.toUpperCase()} compliance export.`);
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Failed to download export.');
      });
  };

  // Toggle user activation state
  const handleToggleUserStatus = async (targetUser) => {
    if (!token) return;
    const targetId = targetUser.id || targetUser._id;
    const isDeactivating = targetUser.isActive;
    const endpoint = isDeactivating
      ? `http://localhost:5000/api/admin/users/${targetId}/deactivate`
      : `http://localhost:5000/api/admin/users/${targetId}/reactivate`;

    setDeactivatingUserId(targetId);
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || (isDeactivating ? 'Account suspended successfully.' : 'Account restored successfully.'));
        fetchUsers();
      } else {
        setErrorMsg(data.error?.message || 'Operation failed.');
      }
    } catch {
      setErrorMsg('Network error executing user status change.');
    } finally {
      setDeactivatingUserId(null);
    }
  };

  // Update user role (Viewer, Document Owner, Administrator)
  const handleUpdateUserRole = async (targetUserId, newRole, reason = '') => {
    if (!token) return;
    setUpdatingRoleId(targetUserId);
    try {
      const res = await fetch(`http://localhost:5000/api/admin/users/${targetUserId}/role`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole, reason })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || `User role updated to ${newRole}.`);
        fetchUsers();
        fetchPendingRequests();
        fetchAnalytics();
      } else {
        setErrorMsg(data.error?.message || 'Failed to update user role.');
      }
    } catch {
      setErrorMsg('Network error executing user role update.');
    } finally {
      setUpdatingRoleId(null);
    }
  };

  // If user is not logged in or not an admin, render enterprise RBAC rejection
  if (!isAdmin) {
    return (
      <div className="admin-rbac-denied" role="alert">
        <div className="admin-denied-card">
          <div className="denied-icon-badge">
            <ShieldAlert size={44} className="text-danger" />
          </div>
          <h2 className="denied-title">403 Forbidden — Administrator Governance Boundary</h2>
          <p className="denied-description">
            Access to organizational governance dashboards, system analytics, global audit trails, and tenant user deactivation is strictly restricted to accounts possessing the <code>admin</code> enterprise role.
          </p>
          <div className="denied-user-meta">
            <span>Current Authenticated Identity: </span>
            <strong>{user ? `${user.name} (${user.email})` : 'Anonymous / Unauthenticated'}</strong>
            {user && (
              <span className="role-chip" style={{ marginLeft: '8px' }}>
                Role: {user.role === 'admin' ? 'Admin' : (user.role === 'viewer' || user.role === 'member') ? 'Viewer' : 'Document Owner'}
              </span>
            )}
          </div>
          <div className="denied-actions">
            {!user ? (
              <Button variant="primary" onClick={onNavigateToLogin}>
                Sign In as Administrator
              </Button>
            ) : (
              <p className="denied-hint">
                Please contact an enterprise administrator or sign in with an account having admin credentials.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const filteredUsers = usersList.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      (u.role && u.role.toLowerCase().includes(userSearchTerm.toLowerCase()))
  );

  return (
    <div className="admin-governance-container">
      {/* Notifications */}
      {successMsg && (
        <div className="admin-alert admin-alert-success" role="status">
          <ShieldCheck size={18} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="admin-alert admin-alert-danger" role="alert">
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Header with Navigation Tabs */}
      <div className="admin-nav-tabs-wrapper">
        <div className="admin-nav-tabs">
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <Activity size={16} />
            <span>System Analytics</span>
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <FileText size={16} />
            <span>Global Audit Trail</span>
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={16} />
            <span>User Directory & Governance</span>
          </button>
        </div>

        <button
          type="button"
          className="admin-refresh-btn"
          onClick={() => {
            if (activeTab === 'analytics') fetchAnalytics();
            if (activeTab === 'audit') fetchAuditLogs(auditPagination.page);
            if (activeTab === 'users') fetchUsers();
          }}
          disabled={loading}
          title="Refresh Data"
        >
          <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* TAB 1: SYSTEM ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="admin-tab-content">
          {analytics ? (
            <>
              {/* Stat Cards */}
              <div className="admin-stats-grid">
                <div className="admin-stat-card primary">
                  <div className="stat-card-header">
                    <span className="stat-card-title">Tenant Users</span>
                    <Users size={18} />
                  </div>
                  <div className="stat-card-value">
                    {analytics.overview?.totalUsers ?? analytics.totals?.users ?? 0}
                  </div>
                  <div className="stat-card-sub">
                    <span className="badge-active">
                      {analytics.overview?.activeUsers ?? analytics.totals?.activeUsers ?? 0} Active
                    </span>
                    {(analytics.overview?.deactivatedUsers ?? analytics.totals?.deactivatedUsers ?? 0) > 0 && (
                      <span className="badge-suspended">
                        {analytics.overview?.deactivatedUsers ?? analytics.totals?.deactivatedUsers} Suspended
                      </span>
                    )}
                  </div>
                </div>

                <div className="admin-stat-card purple">
                  <div className="stat-card-header">
                    <span className="stat-card-title">Vault Documents</span>
                    <FileText size={18} />
                  </div>
                  <div className="stat-card-value">
                    {analytics.overview?.totalDocuments ?? analytics.totals?.documents ?? 0}
                  </div>
                  <div className="stat-card-sub">Cryptographically Quarantined</div>
                </div>

                <div className="admin-stat-card success">
                  <div className="stat-card-header">
                    <span className="stat-card-title">Active Access Grants</span>
                    <Key size={18} />
                  </div>
                  <div className="stat-card-value">
                    {analytics.permissions?.totalPermissions ?? analytics.totals?.activeShares ?? 0}
                  </div>
                  <div className="stat-card-sub">
                    {analytics.permissions?.readPermissions ?? analytics.permissions?.read ?? 0} Read • {analytics.permissions?.editPermissions ?? analytics.permissions?.edit ?? 0} Edit
                  </div>
                </div>

                <div className="admin-stat-card warning">
                  <div className="stat-card-header">
                    <span className="stat-card-title">Audit Records</span>
                    <Activity size={18} />
                  </div>
                  <div className="stat-card-value">
                    {analytics.overview?.totalAuditEvents ?? analytics.totals?.auditLogs ?? 0}
                  </div>
                  <div className="stat-card-sub">Append-only Tamper-Resistant</div>
                </div>
              </div>

              {/* Roles & System Breakdown */}
              <div className="admin-analytics-grid-two">
                <div className="admin-panel-card">
                  <h3 className="panel-card-title">
                    <Layers size={16} /> Role Distribution
                  </h3>
                  <div className="distribution-bars">
                    {(() => {
                      const adminCount = analytics.users?.roleDistribution?.admin ?? analytics.roles?.admin ?? 0;
                      const ownerCount = (analytics.users?.roleDistribution?.owner ?? analytics.roles?.owner ?? 0) + (analytics.roles?.manager ?? 0);
                      const viewerCount = (analytics.users?.roleDistribution?.viewer ?? analytics.roles?.viewer ?? 0) + (analytics.roles?.member ?? 0);
                      const totalUsersCount = analytics.overview?.totalUsers ?? analytics.totals?.users ?? 1;

                      return (
                        <>
                          <div className="dist-item">
                            <div className="dist-label">
                              <span>Administrators</span>
                              <strong>{adminCount}</strong>
                            </div>
                            <div className="dist-progress-bar">
                              <div
                                className="dist-progress-fill admin-bar"
                                style={{ width: `${Math.round((adminCount / totalUsersCount) * 100)}%` }}
                              />
                            </div>
                          </div>

                          <div className="dist-item">
                            <div className="dist-label">
                              <span>Document Owners</span>
                              <strong>{ownerCount}</strong>
                            </div>
                            <div className="dist-progress-bar">
                              <div
                                className="dist-progress-fill owner-bar"
                                style={{ width: `${Math.round((ownerCount / totalUsersCount) * 100)}%` }}
                              />
                            </div>
                          </div>

                          <div className="dist-item">
                            <div className="dist-label">
                              <span>Viewers</span>
                              <strong>{viewerCount}</strong>
                            </div>
                            <div className="dist-progress-bar">
                              <div
                                className="dist-progress-fill viewer-bar"
                                style={{ width: `${Math.round((viewerCount / totalUsersCount) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="admin-panel-card">
                  <h3 className="panel-card-title">
                    <ShieldCheck size={16} /> Governance Compliance Health
                  </h3>
                  <div className="compliance-meta-list">
                    <div className="compliance-item">
                      <span className="c-label">Audit Log Immutability:</span>
                      <span className="c-status ok">ENFORCED (Pre-save hook disallows PUT/DELETE)</span>
                    </div>
                    <div className="compliance-item">
                      <span className="c-label">Session Token Verification:</span>
                      <span className="c-status ok">ACTIVE (HMAC SHA-256 JWT)</span>
                    </div>
                    <div className="compliance-item">
                      <span className="c-label">Magic Number Header Gate:</span>
                      <span className="c-status ok">ACTIVE (MIME Type Spoofing Blocked)</span>
                    </div>
                    <div className="compliance-item">
                      <span className="c-label">Direct-to-Disk Storage Isolation:</span>
                      <span className="c-status ok">ACTIVE (Private Vault Quarantine)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* High Frequency Actors & Top Accessed Documents */}
              <div className="admin-analytics-grid-two">
                <div className="admin-panel-card">
                  <h3 className="panel-card-title">
                    <Activity size={16} /> Most Active Actors (Audit Volume)
                  </h3>
                  {analytics.highFrequencyActors && analytics.highFrequencyActors.length > 0 ? (
                    <ul className="admin-list-summary">
                      {analytics.highFrequencyActors.map((actor, idx) => (
                        <li key={idx} className="list-summary-row">
                          <span className="actor-email">{actor.email}</span>
                          <span className="actor-count">{actor.count} events</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty-subtext">No high-frequency audit activity recorded yet.</p>
                  )}
                </div>

                <div className="admin-panel-card">
                  <h3 className="panel-card-title">
                    <FileText size={16} /> Top Accessed Vault Documents
                  </h3>
                  {analytics.topAccessedDocuments && analytics.topAccessedDocuments.length > 0 ? (
                    <ul className="admin-list-summary">
                      {analytics.topAccessedDocuments.map((doc, idx) => (
                        <li key={idx} className="list-summary-row">
                          <span className="doc-title-cell">{doc.title}</span>
                          <span className="actor-count">{doc.accessCount ?? doc.count ?? 0} reads/downloads</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty-subtext">No document interaction records found.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="admin-loading-state">
              <RefreshCw size={24} className="spinning" />
              <span>Loading system metrics...</span>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GLOBAL AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="admin-tab-content">
          {/* Controls Bar */}
          <div className="audit-controls-bar">
            <div className="audit-filters-group">
              <div className="filter-input-wrap">
                <Filter size={14} className="filter-icon" />
                <select
                  value={auditFilters.action}
                  onChange={(e) => setAuditFilters((prev) => ({ ...prev, action: e.target.value }))}
                  aria-label="Filter by action type"
                >
                  <option value="">All Action Types</option>
                  <option value="DOCUMENT_UPLOAD">Upload</option>
                  <option value="DOCUMENT_READ">Read Metadata</option>
                  <option value="DOCUMENT_DOWNLOAD">Stream Download</option>
                  <option value="PERMISSION_GRANTED">Grant Permission</option>
                  <option value="PERMISSION_REVOKED">Revoke Permission</option>
                  <option value="DOCUMENT_DELETED">Purge Document</option>
                  <option value="ACCOUNT_DEACTIVATED">Deactivate Account</option>
                  <option value="ACCOUNT_REACTIVATED">Reactivate Account</option>
                </select>
              </div>

              <div className="filter-input-wrap">
                <Search size={14} className="filter-icon" />
                <input
                  type="text"
                  placeholder="Filter by Actor Email..."
                  value={auditFilters.actorEmail}
                  onChange={(e) => setAuditFilters((prev) => ({ ...prev, actorEmail: e.target.value }))}
                />
              </div>

              <button
                type="button"
                className="audit-filter-apply-btn"
                onClick={() => fetchAuditLogs(1)}
              >
                Apply Filters
              </button>
            </div>

            <div className="audit-export-group">
              <button
                type="button"
                className="audit-export-btn"
                onClick={() => handleExport('csv')}
                title="Download un-truncated CSV audit log"
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                className="audit-export-btn"
                onClick={() => handleExport('json')}
                title="Download un-truncated JSON compliance log"
              >
                <Download size={14} />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="admin-table-wrapper">
            <table className="admin-data-table" aria-label="Global Audit Log Table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target Document</th>
                  <th>IP Address</th>
                  <th>Client Agent</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => {
                    let actionBadgeClass = 'badge-action-default';
                    if (log.action.includes('UPLOAD')) actionBadgeClass = 'badge-action-primary';
                    if (log.action.includes('DOWNLOAD')) actionBadgeClass = 'badge-action-success';
                    if (log.action.includes('GRANTED')) actionBadgeClass = 'badge-action-warning';
                    if (log.action.includes('REVOKED') || log.action.includes('DELETED'))
                      actionBadgeClass = 'badge-action-danger';

                    return (
                      <tr key={log._id}>
                        <td className="cell-timestamp">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="cell-actor">
                          <div className="actor-primary">{log.actorName || log.actorEmail}</div>
                          {log.actorName && <div className="actor-secondary">{log.actorEmail}</div>}
                        </td>
                        <td>
                          <span className={`audit-action-pill ${actionBadgeClass}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="cell-target">
                          {log.targetDocumentTitle || log.targetDocumentId || '—'}
                        </td>
                        <td className="cell-code">
                          <code>{log.ipAddress || '127.0.0.1'}</code>
                        </td>
                        <td className="cell-agent">
                          <span title={log.userAgent}>
                            {(log.userAgent || 'TrustVault Core Client').substring(0, 32)}...
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="admin-table-empty">
                      No audit log records match the current filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {auditPagination.totalPages > 1 && (
            <div className="admin-pagination">
              <span className="pagination-info">
                Showing Page {auditPagination.page} of {auditPagination.totalPages} ({auditPagination.totalItems} total events)
              </span>
              <div className="pagination-buttons">
                <button
                  type="button"
                  disabled={auditPagination.page <= 1}
                  onClick={() => fetchAuditLogs(auditPagination.page - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={auditPagination.page >= auditPagination.totalPages}
                  onClick={() => fetchAuditLogs(auditPagination.page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: USER DIRECTORY & GOVERNANCE */}
      {activeTab === 'users' && (
        <div className="admin-tab-content">
          {/* Dedicated Pending Owner Requests Queue (Stage 8) */}
          <div className="pending-requests-card" aria-labelledby="pending-requests-title">
            <div className="pending-requests-header">
              <div className="pending-header-title">
                <Clock size={18} className="text-warning" />
                <h3 id="pending-requests-title">Pending Document Owner Requests</h3>
                <span className={`pending-counter-badge ${pendingRequests.length > 0 ? 'badge-has-pending' : ''}`}>
                  {pendingRequests.length} Pending
                </span>
              </div>
              <p className="pending-header-subtitle">
                Registered users requesting Document Owner privileges to ingest corporate files and manage collaborator ACLs.
              </p>
            </div>

            {pendingRequests.length > 0 ? (
              <div className="pending-requests-table-wrap">
                <table className="admin-data-table pending-data-table" aria-label="Pending Owner Approval Requests Table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Requested Role</th>
                      <th>Requested Date</th>
                      <th>Approval Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRequests.map((reqUser) => {
                      const reqId = reqUser.id || reqUser._id;
                      return (
                        <tr key={reqId}>
                          <td>
                            <strong>{reqUser.name}</strong>
                          </td>
                          <td>
                            <code>{reqUser.email}</code>
                          </td>
                          <td>
                            <span className="user-role-pill role-owner">Document Owner</span>
                          </td>
                          <td className="cell-timestamp">
                            {new Date(reqUser.ownerApprovalRequestedAt || reqUser.createdAt).toLocaleString()}
                          </td>
                          <td>
                            <div className="pending-actions-btn-group">
                              <button
                                type="button"
                                className="action-btn-approve"
                                onClick={() => handleApproveRequest(reqId, reqUser.name)}
                                disabled={updatingRoleId === reqId}
                                title={`Approve Owner privileges for ${reqUser.name}`}
                              >
                                <Check size={14} />
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                className="action-btn-reject"
                                onClick={() => {
                                  setRejectModalUser(reqUser);
                                  setRejectReason('');
                                }}
                                disabled={updatingRoleId === reqId}
                                title={`Reject Owner privileges for ${reqUser.name}`}
                              >
                                <X size={14} />
                                <span>Reject</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="pending-empty-state">
                <CheckCircle2 size={18} className="text-success" />
                <span>All owner access requests have been reviewed. No pending requests in queue.</span>
              </div>
            )}
          </div>

          {/* User Directory Filter Bar */}
          <div className="users-filter-bar">
            <div className="filter-input-wrap user-search-input">
              <Search size={14} className="filter-icon" />
              <input
                type="text"
                placeholder="Search user by name, email, or role..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
              />
            </div>
            <span className="user-count-badge">
              {filteredUsers.length} Registered Accounts
            </span>
          </div>

          {/* Full User Governance Table */}
          <div className="admin-table-wrapper">
            <table className="admin-data-table" aria-label="User Governance Directory Table">
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Email Address</th>
                  <th>Effective Role</th>
                  <th>Requested Role</th>
                  <th>Approval Status</th>
                  <th>Account Status</th>
                  <th>Registration Date</th>
                  <th>Governance Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((targetUser) => {
                    const targetId = targetUser.id || targetUser._id;
                    const isSelf = user && (String(targetId) === String(user.id || user._id) || targetUser.email === user.email);
                    const isActive = targetUser.isActive !== false;

                    const r = targetUser.role || 'viewer';
                    const label = r === 'admin' ? 'Administrator' : r === 'owner' ? 'Document Owner' : 'Viewer';
                    const roleClass = r === 'admin' ? 'role-admin' : r === 'owner' ? 'role-owner' : 'role-viewer';

                    const reqRole = targetUser.requestedRole
                      ? (targetUser.requestedRole === 'owner' ? 'Document Owner' : 'Viewer')
                      : '—';

                    const approvalStatus = targetUser.ownerApprovalStatus || 'not_required';

                    return (
                      <tr key={targetId}>
                        <td>
                          <div className="actor-primary"><strong>{targetUser.name}</strong></div>
                        </td>
                        <td>
                          <div className="actor-secondary"><code>{targetUser.email}</code></div>
                        </td>
                        <td>
                          <span className={`user-role-pill ${roleClass}`}>
                            {label}
                          </span>
                        </td>
                        <td>
                          <span className="requested-role-text">
                            {reqRole}
                          </span>
                        </td>
                        <td>
                          {approvalStatus === 'pending' ? (
                            <span className="approval-badge badge-pending">
                              <Clock size={11} /> Pending Review
                            </span>
                          ) : approvalStatus === 'approved' ? (
                            <span className="approval-badge badge-approved">
                              <Check size={11} /> Approved
                            </span>
                          ) : approvalStatus === 'rejected' ? (
                            <span className="approval-badge badge-rejected">
                              <X size={11} /> Rejected
                            </span>
                          ) : (
                            <span className="approval-badge badge-neutral">
                              Not Required
                            </span>
                          )}
                        </td>
                        <td>
                          {isActive ? (
                            <span className="status-badge status-active">Active</span>
                          ) : (
                            <span className="status-badge status-suspended">Suspended</span>
                          )}
                        </td>
                        <td className="cell-timestamp">
                          {new Date(targetUser.createdAt || Date.now()).toLocaleDateString()}
                        </td>
                        <td>
                          <div className="user-actions-group">
                            {isSelf ? (
                              <span className="self-tag">(Current Admin)</span>
                            ) : (
                              <>
                                {/* Pending quick actions */}
                                {approvalStatus === 'pending' && (
                                  <>
                                    <button
                                      type="button"
                                      className="user-action-btn btn-approve-mini"
                                      onClick={() => handleApproveRequest(targetId, targetUser.name)}
                                      disabled={updatingRoleId === targetId}
                                      title="Approve Owner privileges"
                                    >
                                      <Check size={12} />
                                      <span>Approve</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="user-action-btn btn-reject-mini"
                                      onClick={() => {
                                        setRejectModalUser(targetUser);
                                        setRejectReason('');
                                      }}
                                      disabled={updatingRoleId === targetId}
                                      title="Reject Owner privileges"
                                    >
                                      <X size={12} />
                                      <span>Reject</span>
                                    </button>
                                  </>
                                )}

                                {/* Promote / Downgrade quick buttons */}
                                {r === 'viewer' && approvalStatus !== 'pending' && (
                                  <button
                                    type="button"
                                    className="user-action-btn btn-promote"
                                    onClick={() => handlePromoteUser(targetUser)}
                                    disabled={updatingRoleId === targetId}
                                    title="Promote Viewer to Document Owner"
                                  >
                                    <UserPlus size={12} />
                                    <span>Promote to Owner</span>
                                  </button>
                                )}

                                {r === 'owner' && (
                                  <button
                                    type="button"
                                    className="user-action-btn btn-downgrade"
                                    onClick={() => {
                                      setDowngradeModalUser(targetUser);
                                      setDowngradeReason('');
                                    }}
                                    disabled={updatingRoleId === targetId}
                                    title="Revoke Owner privileges (Strict Document Preservation Guarantee)"
                                  >
                                    <UserMinus size={12} />
                                    <span>Revoke Owner</span>
                                  </button>
                                )}

                                {/* Direct role dropdown */}
                                <select
                                  className="user-role-select"
                                  value={r}
                                  disabled={updatingRoleId === targetId}
                                  onChange={(e) => {
                                    const nextRole = e.target.value;
                                    if (nextRole === 'viewer' && r === 'owner') {
                                      setDowngradeModalUser(targetUser);
                                      setDowngradeReason('');
                                    } else {
                                      handleUpdateUserRole(targetId, nextRole);
                                    }
                                  }}
                                  title={`Change role for ${targetUser.name}`}
                                  aria-label={`Change role for ${targetUser.name}`}
                                >
                                  <option value="viewer">Viewer</option>
                                  <option value="owner">Document Owner</option>
                                  <option value="admin">Administrator</option>
                                </select>

                                {/* Deactivate / Reactivate button */}
                                <button
                                  type="button"
                                  className={`user-action-btn ${isActive ? 'btn-deactivate' : 'btn-reactivate'}`}
                                  onClick={() => handleToggleUserStatus(targetUser)}
                                  disabled={deactivatingUserId === targetId}
                                  title={isActive ? 'Deactivate this user account' : 'Reactivate this user account'}
                                >
                                  {isActive ? (
                                    <>
                                      <UserX size={13} />
                                      <span>Suspend</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck size={13} />
                                      <span>Restore</span>
                                    </>
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="admin-table-empty">
                      No user accounts found matching &quot;{userSearchTerm}&quot;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Downgrade Owner to Viewer (Strict Document Preservation) */}
      {downgradeModalUser && (
        <div className="admin-modal-backdrop" onClick={() => setDowngradeModalUser(null)} role="presentation">
          <div
            className="admin-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="downgrade-dialog-title"
          >
            <div className="admin-modal-header danger-header">
              <div className="modal-header-icon-box warning-box">
                <AlertTriangle size={22} className="text-warning" />
              </div>
              <div>
                <h3 id="downgrade-dialog-title" className="admin-modal-title">
                  Revoke Owner Privileges & Downgrade to Viewer
                </h3>
                <p className="admin-modal-subtitle">
                  Account: <strong>{downgradeModalUser.name}</strong> ({downgradeModalUser.email})
                </p>
              </div>
            </div>

            <div className="admin-modal-body">
              <div className="modal-guarantee-box">
                <div className="guarantee-header">
                  <ShieldCheck size={16} className="text-success" />
                  <strong>Zero Data Loss Guarantee</strong>
                </div>
                <p>
                  All existing documents previously uploaded by <strong>{downgradeModalUser.name}</strong> will remain <strong>strictly preserved</strong> in private vault storage. No files will be deleted or reassigned. Existing collaborators will retain active access.
                </p>
              </div>

              <p className="modal-consequence-text">
                <strong>Restrictions upon downgrade:</strong> The user will immediately be blocked from uploading new documents, purging files, or managing sharing ACL permissions.
              </p>

              <div className="form-group" style={{ marginTop: '14px' }}>
                <label className="form-label" htmlFor="downgrade-reason-input">
                  Reason for role downgrade <span className="label-hint">(optional, recorded in immutable audit trail)</span>:
                </label>
                <input
                  id="downgrade-reason-input"
                  type="text"
                  placeholder="e.g. Completed contractor tenure / role changed to external advisor"
                  value={downgradeReason}
                  onChange={(e) => setDowngradeReason(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="admin-modal-footer">
              <Button variant="secondary" onClick={() => setDowngradeModalUser(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmDowngrade}
                disabled={updatingRoleId === (downgradeModalUser.id || downgradeModalUser._id)}
              >
                <UserMinus size={14} />
                <span>Confirm Revocation & Downgrade to Viewer</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Reject Owner Access Request */}
      {rejectModalUser && (
        <div className="admin-modal-backdrop" onClick={() => setRejectModalUser(null)} role="presentation">
          <div
            className="admin-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-dialog-title"
          >
            <div className="admin-modal-header danger-header">
              <div className="modal-header-icon-box danger-box">
                <XCircle size={22} className="text-danger" />
              </div>
              <div>
                <h3 id="reject-dialog-title" className="admin-modal-title">
                  Reject Owner Access Request
                </h3>
                <p className="admin-modal-subtitle">
                  User: <strong>{rejectModalUser.name}</strong> ({rejectModalUser.email})
                </p>
              </div>
            </div>

            <div className="admin-modal-body">
              <p className="modal-consequence-text">
                The user&apos;s request for Document Owner upload privileges will be rejected. Their account will retain active <strong>Viewer</strong> privileges so they can continue reviewing documents shared with them.
              </p>

              <div className="form-group" style={{ marginTop: '14px' }}>
                <label className="form-label" htmlFor="reject-reason-input">
                  Reason for rejection <span className="label-hint">(recorded in audit log and visible to user)</span>:
                </label>
                <input
                  id="reject-reason-input"
                  type="text"
                  placeholder="e.g. Department quota reached / owner privileges not required for current project"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="admin-modal-footer">
              <Button variant="secondary" onClick={() => setRejectModalUser(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => handleRejectRequest(rejectModalUser.id || rejectModalUser._id, rejectReason)}
                disabled={updatingRoleId === (rejectModalUser.id || rejectModalUser._id)}
              >
                <X size={14} />
                <span>Confirm Rejection</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
