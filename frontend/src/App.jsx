import React, { useState, useEffect } from 'react';
import { 
  Files, 
  Share2, 
  UserCheck, 
  Activity, 
  Upload, 
  Lock, 
  HelpCircle,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Settings as SettingsIcon,
  Search,
  Clock,
  RefreshCw
} from 'lucide-react';
import { AppShell } from './layouts/AppShell';
import { PageHeader } from './components/dashboard/PageHeader';
import { SummaryCard } from './components/dashboard/SummaryCard';
import { DocumentTable } from './components/dashboard/DocumentTable';
import { ActivityList } from './components/dashboard/ActivityList';
import { DemoDataBanner } from './components/demo/DemoDataBanner';
import { Modal } from './components/common/Modal';
import { AuthModals } from './components/auth/AuthModals';
import { AuthLandingPortal } from './components/auth/AuthLandingPortal';
import { UploadModal } from './components/dashboard/UploadModal';
import { ShareModal } from './components/dashboard/ShareModal';
import { EditModal } from './components/dashboard/EditModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AccountSettings } from './components/dashboard/AccountSettings';
import { ForcedPasswordChangeModal } from './components/auth/ForcedPasswordChangeModal';
import { Button } from './components/common/Button';
import { EmptyState } from './components/common/EmptyState';
import { 
  DEMO_METRICS, 
  DEMO_DOCUMENTS, 
  DEMO_ACTIVITIES 
} from './mock/mockData';
import './App.css';
import { useAuth } from './context/AuthContext';
import { buildApiUrl } from './config/api';

export function App() {
  const [activeNav, setActiveNav] = useState('overview');
  const [backendHealth, setBackendHealth] = useState(null);
  const [backendConnected, setBackendConnected] = useState(false);

  // Authentication Context
  const { user, token, logout, refreshProfile, requestOwnerAccess } = useAuth();
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [refreshingProfile, setRefreshingProfile] = useState(false);
  const [approvalStatusNotice, setApprovalStatusNotice] = useState('');
  const [submittingOwnerRequest, setSubmittingOwnerRequest] = useState(false);
  const [ownerRequestNotice, setOwnerRequestNotice] = useState({ type: '', message: '' });

  // Auth, Upload, Share & Edit Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const m = params.get('mode');
      if (m === 'register' || window.location.hash === '#register') {
        return 'register';
      }
    } catch {
      // fallback
    }
    return 'login';
  });
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [shareModalConfig, setShareModalConfig] = useState({ isOpen: false, document: null });
  const [editModalConfig, setEditModalConfig] = useState({ isOpen: false, document: null });

  // Private Vault Documents
  const [vaultDocuments, setVaultDocuments] = useState([]);
  const [liveActivities, setLiveActivities] = useState([]);

  // Modal State
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    subtitle: '',
    badge: 'System Notice',
    type: 'info',
    content: null,
  });

  // Attempt live connection check to Express backend
  const checkBackendHealth = async () => {
    try {
      const response = await fetch(buildApiUrl('/health'));
      if (response.ok) {
        const data = await response.json();
        setBackendHealth(data);
        setBackendConnected(true);
      } else {
        setBackendConnected(false);
      }
    } catch {
      setBackendConnected(false);
    }
  };

  // Fetch real authenticated documents from private vault
  const fetchVaultDocuments = async () => {
    if (!token) return;
    try {
      const response = await fetch(buildApiUrl('/documents'), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const formatted = (data.documents || []).map((doc) => {
          const isUserOwner = doc.accessLevel === 'Owner';
          const ownerName = doc.owner?.name || (isUserOwner ? (user?.name || 'You') : 'Colleague');
          const ownerEmail = doc.owner?.email || (isUserOwner ? (user?.email || '') : '');
          const initials = (ownerName || 'D')
            .split(' ')
            .map((n) => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

          const mappedAccess = doc.accessLevel === 'Owner'
            ? 'Owner'
            : doc.accessLevel === 'Editor'
              ? 'Can Edit'
              : doc.accessLevel === 'Admin'
                ? 'Admin'
                : 'Can Read';

          return {
            id: doc._id,
            name: doc.title,
            originalName: doc.originalName,
            description: doc.description || '',
            fileType: (doc.originalName ? doc.originalName.split('.').pop() : 'FILE').toUpperCase(),
            fileSize:
              doc.fileSize > 1048576
                ? `${(doc.fileSize / 1048576).toFixed(1)} MB`
                : `${(doc.fileSize / 1024).toFixed(1)} KB`,
            rawSize: doc.fileSize,
            owner: {
              id: doc.owner?.id || doc.ownerId,
              name: ownerName,
              email: ownerEmail,
              initials: initials || 'TV',
            },
            ownerId: doc.owner?.id || doc.ownerId,
            visibility: doc.visibility || 'private',
            accessLevel: mappedAccess,
            acl: doc.acl || [],
            lastUpdated: doc.updatedAt || doc.createdAt,
            formattedDate: new Date(doc.updatedAt || doc.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            tags: doc.tags || [],
            category: doc.category || 'General',
            isReal: true,
          };
        });
        setVaultDocuments(formatted);
      } else if (response.status === 401) {
        logout();
      }
    } catch (err) {
      console.error('[Document Fetch Error]:', err);
    }
  };

  // Fetch real immutable audit activity records
  const fetchLiveActivities = async () => {
    if (!token) return;
    try {
      const res = await fetch(buildApiUrl('/documents/audit/activity'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const formatted = (data.activities || []).map((log) => {
          let type = 'clock';
          let badgeVariant = 'primary';
          let actionText = 'accessed';

          switch (log.action) {
            case 'DOCUMENT_UPLOAD':
              type = 'upload';
              badgeVariant = 'primary';
              actionText = 'quarantined & uploaded';
              break;
            case 'DOCUMENT_DOWNLOAD':
              type = 'update';
              badgeVariant = 'success';
              actionText = 'streamed download of';
              break;
            case 'PERMISSION_GRANTED':
              type = 'grant';
              badgeVariant = 'warning';
              actionText = 'granted permissions for';
              break;
            case 'PERMISSION_REVOKED':
              type = 'revoke';
              badgeVariant = 'danger';
              actionText = 'immediately revoked access to';
              break;
            case 'DOCUMENT_DELETED':
              type = 'revoke';
              badgeVariant = 'danger';
              actionText = 'permanently purged';
              break;
            default:
              actionText = 'inspected';
          }

          return {
            id: log._id,
            type,
            badgeVariant,
            actor: { name: log.actorName || log.actorEmail },
            actionText,
            documentName: log.targetDocumentTitle || 'Confidential File',
            formattedDate: new Date(log.timestamp).toLocaleString(),
            timestamp: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
        });
        setLiveActivities(formatted);
      }
    } catch (err) {
      console.error('[Activity Fetch Error]', err);
    }
  };

  useEffect(() => {
    checkBackendHealth();
  }, []);

  useEffect(() => {
    if (token) {
      fetchVaultDocuments();
      fetchLiveActivities();
    } else {
      setVaultDocuments([]);
      setLiveActivities([]);
    }
  }, [token]);

  // Live refresh documents when switching views
  useEffect(() => {
    if (token && (activeNav === 'overview' || activeNav === 'my-documents' || activeNav === 'shared-with-me')) {
      fetchVaultDocuments();
      fetchLiveActivities();
    }
  }, [activeNav, token]);

  // Live refresh documents on tab focus
  useEffect(() => {
    if (!token) return;
    const handleWindowFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchVaultDocuments();
        fetchLiveActivities();
      }
    };
    document.addEventListener('visibilitychange', handleWindowFocus);
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleWindowFocus);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [token]);

  // Role-based dashboard routing upon authentication
  useEffect(() => {
    if (user && user.role) {
      const normalizedRole = String(user.role).toLowerCase().trim();
      if (normalizedRole === 'admin') {
        setActiveNav('admin');
      } else if (normalizedRole === 'viewer' || normalizedRole === 'member') {
        setActiveNav('shared-with-me');
      } else {
        // Document Owner
        setActiveNav('overview');
      }
    }
  }, [user?.role, user?.id || user?._id]);

  // Fetch pending owner requests count for Admin badge
  useEffect(() => {
    if (user?.role === 'admin' && token) {
      fetch(buildApiUrl('/admin/owner-requests'), {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setPendingRequestsCount(data.total ?? data.requests?.length ?? 0);
        })
        .catch(() => {});
    }
  }, [user?.role, token]);

  // Check approval status in real-time for Viewer accounts
  const handleCheckApprovalStatus = async () => {
    setRefreshingProfile(true);
    setApprovalStatusNotice('');
    try {
      const updatedUser = await refreshProfile();
      if (updatedUser) {
        if (updatedUser.role === 'owner') {
          setApprovalStatusNotice('Owner access approved.');
        } else if (updatedUser.ownerApprovalStatus === 'rejected') {
          setApprovalStatusNotice('Your Owner access request was declined.');
        } else if (updatedUser.ownerApprovalStatus === 'pending') {
          setApprovalStatusNotice('Owner access request pending administrator approval.');
        } else {
          setApprovalStatusNotice('Profile refreshed.');
        }
      }
    } catch {
      setApprovalStatusNotice('Failed to refresh status.');
    } finally {
      setRefreshingProfile(false);
      setTimeout(() => setApprovalStatusNotice(''), 6000);
    }
  };

  // Submit Owner access request from Viewer dashboard
  const handleRequestOwnerAccess = async () => {
    setSubmittingOwnerRequest(true);
    setOwnerRequestNotice({ type: '', message: '' });
    try {
      const res = await requestOwnerAccess();
      setOwnerRequestNotice({
        type: 'success',
        message: res.message || 'Owner access request pending administrator approval.',
      });
      // Also fetch updated documents and activities
      fetchVaultDocuments();
      fetchLiveActivities();
    } catch (err) {
      setOwnerRequestNotice({
        type: 'error',
        message: err.message || 'Failed to submit Owner access request.',
      });
    } finally {
      setSubmittingOwnerRequest(false);
    }
  };

  // Auto-refresh profile periodically and upon tab focus for Viewers awaiting Owner approval
  useEffect(() => {
    if (!token || !user || user.role !== 'viewer' || user.ownerApprovalStatus !== 'pending') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        await refreshProfile();
      } catch {
        // silent polling failure
      }
    }, 12000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshProfile().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [token, user?.role, user?.ownerApprovalStatus]);

  // Clear any stale owner request feedback banner when user is approved or has owner/admin role
  useEffect(() => {
    if (user?.role === 'owner' || user?.role === 'admin' || user?.ownerApprovalStatus === 'approved') {
      setOwnerRequestNotice({ type: '', message: '' });
      setApprovalStatusNotice('');
    }
  }, [user?.role, user?.ownerApprovalStatus]);

  const openModal = (config) => {
    setModalConfig({
      isOpen: true,
      title: config.title || 'Feature Notice',
      subtitle: config.subtitle || 'TrustVault Architecture Boundary',
      badge: config.badge || 'Security Notice',
      type: config.type || 'info',
      content: config.content,
    });
  };

  const closeModal = () => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
  };

  // Open interactive private storage upload modal
  const handleUploadClick = () => {
    setUploadModalOpen(true);
  };

  const handleDocumentAction = async (action, doc) => {
    if (action === 'download') {
      if (doc.isReal) {
        try {
          // Build save filename from stored metadata (available before fetch)
          let downloadFilename = doc.originalName || doc.name || 'document';
          if (!downloadFilename.includes('.') && doc.fileType && doc.fileType !== 'FILE') {
            downloadFilename += `.${doc.fileType.toLowerCase()}`;
          }

          // ── Chrome / Edge 86+ ──────────────────────────────────────────
          // showSaveFilePicker must be called BEFORE any async fetch, while
          // the click user-gesture is still active. The native Save-As dialog
          // presents the correct filename. This is the only reliable way to
          // preserve original filenames in Chromium — Chrome ignores the
          // <a download> attribute on blob: URLs clicked outside a live gesture.
          let fileHandle = null;
          if (typeof window.showSaveFilePicker === 'function') {
            try {
              fileHandle = await window.showSaveFilePicker({ suggestedName: downloadFilename });
            } catch (pickerErr) {
              if (pickerErr.name === 'AbortError') return; // user cancelled
              fileHandle = null; // other error — fall through to blob path
            }
          }

          // Fetch document bytes with Bearer auth (token never in URL)
          const response = await fetch(buildApiUrl(`/documents/${doc.id}/download`), {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'Download failed.');
          }
          const ct = response.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'Received unexpected response format.');
          }

          const blobType = ct || 'application/octet-stream';
          const rawBlob = await response.blob();
          const blob = rawBlob.type ? rawBlob : new Blob([rawBlob], { type: blobType });

          if (fileHandle) {
            // File System Access API path (Chrome / Edge)
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
          } else {
            // Fallback: blob URL (Firefox / Safari where link.download is honoured)
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.style.display = 'none';
            link.href = downloadUrl;
            link.download = downloadFilename;
            document.body.appendChild(link);
            link.click();
            if (link.parentNode) link.parentNode.removeChild(link);
            // Retain blob in memory for 60 seconds so mobile download managers can complete
            setTimeout(() => {
              URL.revokeObjectURL(downloadUrl);
            }, 60000);
          }
        } catch (err) {
          openModal({
            title: 'Download Streaming Error',
            subtitle: 'Secure transfer failed',
            type: 'notice',
            content: <p>{err.message}</p>,
          });
        }
        return;
      }


      openModal({
        title: `Secure Stream: ${doc.name}`,
        subtitle: 'Protected Byte Streaming',
        badge: 'Zero-Leakage Streaming',
        content: (
          <div>
            <p>
              TrustVault strictly prohibits public static file links.
            </p>
            <div className="modal-notice-box">
              <h4>Zero-Leakage Streaming Design</h4>
              <p>
                All downloads are routed through <code>GET /api/documents/:id/download</code>. The server verifies user authentication and active ACL permissions in real-time before streaming bytes with <code>Content-Disposition: attachment</code> and <code>X-Content-Type-Options: nosniff</code>.
              </p>
            </div>
            <p style={{ fontSize: '13px' }}>
              Upload your own confidential document using the "Upload document" button to test live streaming downloads!
            </p>
          </div>
        ),
      });
    } else if (action === 'delete') {
      if (doc.isReal) {
        if (window.confirm(`Are you sure you want to permanently delete "${doc.name}" from private vault storage?`)) {
          try {
            const response = await fetch(buildApiUrl(`/documents/${doc.id}`), {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!response.ok) {
              const errData = await response.json().catch(() => ({}));
              throw new Error(errData.error?.message || 'Failed to remove document.');
            }

            setVaultDocuments((prev) => prev.filter((d) => d.id !== doc.id));
          } catch (err) {
            openModal({
              title: 'Deletion Failed',
              subtitle: 'Vault error',
              type: 'notice',
              content: <p>{err.message}</p>,
            });
          }
        }
        return;
      }
    } else if (action === 'edit') {
      if (!user) {
        setAuthModalMode('login');
        setAuthModalOpen(true);
        return;
      }
      setEditModalConfig({ isOpen: true, document: doc });
    } else if (action === 'share') {
      if (!user) {
        setAuthModalMode('login');
        setAuthModalOpen(true);
        return;
      }
      setShareModalConfig({ isOpen: true, document: doc });
    } else if (action === 'details') {
      if (doc.isReal) {
        // Fetch real immutable audit trail for this document
        fetch(buildApiUrl(`/documents/${doc.id}/audit`), {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json())
          .then((data) => {
            const logs = data.auditLogs || [];
            openModal({
              title: `Security Metadata: ${doc.name}`,
              subtitle: 'File integrity and tamper-resistant audit ledger',
              badge: 'Compliance Audit Trail',
              content: (
                <div>
                  <ul className="modal-meta-list" style={{ marginBottom: 'var(--space-4)' }}>
                    <li className="modal-meta-item">
                      <span className="modal-meta-label">Document ID:</span>
                      <span className="modal-meta-val"><code>{doc.id}</code></span>
                    </li>
                    <li className="modal-meta-item">
                      <span className="modal-meta-label">File Format:</span>
                      <span className="modal-meta-val">{doc.fileType} ({doc.fileSize})</span>
                    </li>
                    <li className="modal-meta-item">
                      <span className="modal-meta-label">Storage Location:</span>
                      <span className="modal-meta-val">Isolated Private Storage (Non-web root)</span>
                    </li>
                    <li className="modal-meta-item">
                      <span className="modal-meta-label">Current Owner:</span>
                      <span className="modal-meta-val">{doc.owner.name} ({doc.owner.email})</span>
                    </li>
                  </ul>

                  <h4 style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                    Immutable Audit Trail ({logs.length} events)
                  </h4>
                  {logs.length === 0 ? (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>No audit events logged yet.</p>
                  ) : (
                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}>
                      {logs.map((log) => (
                        <div key={log._id} style={{ fontSize: '11px', padding: '4px 0', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between' }}>
                          <span><strong>{log.action}</strong> by {log.actorEmail}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ),
            });
          })
          .catch(() => {
            openModal({
              title: `Security Metadata: ${doc.name}`,
              subtitle: 'Private storage metadata',
              badge: 'Persisted Vault Record',
              content: <p>Document ID: {doc.id}</p>,
            });
          });
        return;
      }

      openModal({
        title: `Security Metadata: ${doc.name}`,
        subtitle: 'File integrity and classification details',
        badge: 'Demo Record',
        content: (
          <div>
            <ul className="modal-meta-list">
              <li className="modal-meta-item">
                <span className="modal-meta-label">Document ID:</span>
                <span className="modal-meta-val"><code>{doc.id}</code></span>
              </li>
              <li className="modal-meta-item">
                <span className="modal-meta-label">File Format:</span>
                <span className="modal-meta-val">{doc.fileType} ({doc.fileSize})</span>
              </li>
              <li className="modal-meta-item">
                <span className="modal-meta-label">Storage Location:</span>
                <span className="modal-meta-val">Demo Storage Model</span>
              </li>
              <li className="modal-meta-item">
                <span className="modal-meta-label">Created By:</span>
                <span className="modal-meta-val">{doc.owner.name} ({doc.owner.email})</span>
              </li>
              <li className="modal-meta-item">
                <span className="modal-meta-label">Last Modified:</span>
                <span className="modal-meta-val">{doc.formattedDate}</span>
              </li>
            </ul>
          </div>
        ),
      });
    }
  };

  const handleProfileClick = () => {
    setActiveNav('profile');
  };

  const handleSearchFocus = () => {
    openModal({
      title: 'Document & Metadata Search',
      subtitle: 'Zero-leakage keyword indexing',
      badge: 'Vault Search',
      content: (
        <div>
          <p>
            Global vault search indexes documents with real-time ACL verification.
          </p>
          <div className="modal-notice-box">
            <h4>Security Guarantee</h4>
            <p>
              Search indexes always enforce the requesting user's permission boundaries at query execution time, ensuring confidential file titles or metadata never leak in search results.
            </p>
          </div>
          <p style={{ fontSize: '13px' }}>
            Tip: You can use the search bar inside the Recent Documents table to instantly filter vault documents.
          </p>
        </div>
      ),
    });
  };

  // Global search keyboard shortcut (Ctrl+K / Cmd+K) - only active for authenticated users
  useEffect(() => {
    if (!user) return;
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        handleSearchFocus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user]);

  const handleHelpClick = () => {
    openModal({
      title: 'TrustVault — Engineering Guide',
      subtitle: 'Enterprise Security Architecture',
      badge: 'System Architecture',
      content: (
        <div>
          <p>
            TrustVault is built with modular engineering practices:
          </p>
          <ul className="modal-meta-list">
            <li className="modal-meta-item">
              <span className="modal-meta-label">Frontend Framework:</span>
              <span className="modal-meta-val">React + Vite + Vanilla CSS Tokens</span>
            </li>
            <li className="modal-meta-item">
              <span className="modal-meta-label">Backend Framework:</span>
              <span className="modal-meta-val">Node.js + Express (Port 5000)</span>
            </li>
            <li className="modal-meta-item">
              <span className="modal-meta-label">Health Check:</span>
              <span className="modal-meta-val"><code>GET /api/health</code></span>
            </li>
            <li className="modal-meta-item">
              <span className="modal-meta-label">Document Ingestion:</span>
              <span className="modal-meta-val">25MB Limit + Private Disk Quarantine</span>
            </li>
          </ul>
        </div>
      ),
    });
  };

  // Filter documents based on active navigation item
  const getNavFilteredDocuments = () => {
    if (activeNav === 'my-documents') {
      return vaultDocuments.filter((d) => d.accessLevel === 'Owner');
    }
    if (activeNav === 'shared-with-me') {
      return vaultDocuments.filter((d) => d.accessLevel !== 'Owner');
    }
    return vaultDocuments;
  };

  const myDocsCount = user ? vaultDocuments.filter((d) => d.accessLevel === 'Owner').length : null;
  const sharedDocsCount = user ? vaultDocuments.filter((d) => d.accessLevel !== 'Owner').length : null;
  const sharedWithOthersCount = user
    ? vaultDocuments.filter((d) => d.accessLevel === 'Owner' && Array.isArray(d.acl) && d.acl.length > 0).length
    : null;

  // Determine current page title
  const getPageTitle = () => {
    switch (activeNav) {
      case 'my-documents':
        return 'My Documents';
      case 'shared-with-me':
        return 'Shared with Me';
      case 'activity':
        return 'Security Activity & Audit';
      case 'admin':
        return 'Administrator Governance & Compliance';
      case 'settings':
        return 'Account Settings & Security';
      case 'profile':
        return 'User Profile & Identity';
      default:
        return 'Overview';
    }
  };

  // Unauthenticated visitor layout: dedicated single navigation & portal
  if (!user) {
    return (
      <>
        <AuthLandingPortal
          initialMode={authModalMode}
          onModeChange={(newMode) => setAuthModalMode(newMode)}
          backendConnected={backendConnected}
          onHelpClick={handleHelpClick}
        />

        {/* Accessible Informational Modal (e.g. TrustVault Guide) */}
        <Modal
          isOpen={modalConfig.isOpen}
          onClose={closeModal}
          title={modalConfig.title}
          subtitle={modalConfig.subtitle}
          badge={modalConfig.badge}
          type={modalConfig.type}
          confirmLabel="Understood"
          onConfirm={closeModal}
        >
          {modalConfig.content}
        </Modal>

        {/* Authentication Dialog (if explicitly opened) */}
        <AuthModals
          key={`${authModalMode}-${authModalOpen}`}
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialMode={authModalMode}
          onModeChange={(newMode) => setAuthModalMode(newMode)}
        />
      </>
    );
  }

  return (
    <AppShell
      activeNav={activeNav}
      onNavSelect={(navId) => setActiveNav(navId)}
      pageTitle={getPageTitle()}
      backendConnected={backendConnected}
      onProfileClick={handleProfileClick}
      onSearchFocus={handleSearchFocus}
      onHelpClick={handleHelpClick}
      onOpenLogin={() => {
        setAuthModalMode('login');
        setAuthModalOpen(true);
      }}
      onOpenRegister={() => {
        setAuthModalMode('register');
        setAuthModalOpen(true);
      }}
      myDocsCount={myDocsCount}
      sharedDocsCount={sharedDocsCount}
      userRole={user?.role}
      isAuthenticated={true}
      pendingRequestsCount={pendingRequestsCount}
    >
      {user.mustChangePassword ? (
        <ForcedPasswordChangeModal
          user={user}
          token={token}
          onPasswordChanged={refreshProfile}
          onLogout={logout}
        />
      ) : activeNav === 'profile' || activeNav === 'settings' ? (
        <AccountSettings
          user={user}
          token={token}
          onLogout={logout}
          onCheckApprovalStatus={handleCheckApprovalStatus}
          refreshingStatus={refreshingProfile}
          approvalNotice={approvalStatusNotice}
          activeNav={activeNav}
          onProfileUpdated={() => {
            fetchVaultDocuments();
          }}
        />
      ) : activeNav === 'admin' ? (
        <AdminDashboard
          user={user}
          token={token}
          onNavigateToLogin={() => {
            setAuthModalMode('login');
            setAuthModalOpen(true);
          }}
          onPendingCountChange={(cnt) => setPendingRequestsCount(cnt)}
        />
      ) : activeNav === 'activity' ? (
        <div style={{ maxWidth: '800px' }}>
          <ActivityList
            activities={liveActivities}
            isLive={true}
            onViewAllClick={() => openModal({
              title: 'Complete Audit Log Stream',
              subtitle: 'System-wide compliance audit records',
              badge: 'Immutable Ledger',
              content: <p>All document uploads, reads, downloads, permission grants, and revocations are permanently logged with actor ID and IP.</p>
            })}
          />
        </div>
      ) : (
        <>
          {/* Viewer Owner Access Request Feedback Banner */}
          {ownerRequestNotice.message && user.role === 'viewer' && (user.ownerApprovalStatus === 'pending' || ownerRequestNotice.type === 'error') && (
            <div
              className={`viewer-role-banner ${ownerRequestNotice.type === 'success' ? 'viewer-banner-downgraded' : 'viewer-banner-rejected'}`}
              role="alert"
              id="owner-request-feedback"
            >
              <div className="banner-icon-box">
                {ownerRequestNotice.type === 'success' ? (
                  <CheckCircle2 size={20} className="text-info" />
                ) : (
                  <AlertTriangle size={20} className="text-danger" />
                )}
              </div>
              <div className="banner-content">
                <div className="banner-title-row">
                  <strong>{ownerRequestNotice.type === 'success' ? 'Owner Access Request Submitted' : 'Owner Request Notice'}</strong>
                  <span className={`banner-badge ${ownerRequestNotice.type === 'success' ? 'badge-info' : 'badge-rejected'}`}>
                    {ownerRequestNotice.type === 'success' ? 'Request Recorded' : 'Action Required'}
                  </span>
                </div>
                <p className="banner-description">{ownerRequestNotice.message}</p>
              </div>
              <button
                type="button"
                className="banner-refresh-btn"
                onClick={() => setOwnerRequestNotice({ type: '', message: '' })}
                aria-label="Dismiss notice"
              >
                <span>Dismiss</span>
              </button>
            </div>
          )}

          {/* Viewer Account Status Notice Banners */}
          {user.role === 'viewer' && user.ownerApprovalStatus === 'pending' && (
            <div className="viewer-role-banner viewer-banner-pending" role="status" id="viewer-pending-status-banner">
              <div className="banner-icon-box">
                <Clock size={20} className="text-warning" />
              </div>
              <div className="banner-content">
                <div className="banner-title-row">
                  <strong>Owner access request pending administrator approval.</strong>
                  <span className="banner-badge badge-pending">Under Review</span>
                </div>
                <p className="banner-description">
                  {user.ownerApprovalRequestedAt ? (
                    <>
                      Submitted on <strong>{new Date(user.ownerApprovalRequestedAt).toLocaleString()}</strong>.{' '}
                    </>
                  ) : (
                    <>Your request is currently awaiting administrator review.{' '}</>
                  )}
                  Your account retains standard Viewer privileges while awaiting Administrator review.
                </p>
                {approvalStatusNotice && (
                  <div className="banner-live-notice">{approvalStatusNotice}</div>
                )}
              </div>
              <button
                type="button"
                className="banner-refresh-btn"
                onClick={handleCheckApprovalStatus}
                disabled={refreshingProfile}
                title="Check if Administrator has approved your Owner access request"
                id="btn-refresh-approval-status"
              >
                <RefreshCw size={13} className={refreshingProfile ? 'spinner' : ''} />
                <span>{refreshingProfile ? 'Checking...' : 'Check Status'}</span>
              </button>
            </div>
          )}

          {user.role === 'viewer' && user.ownerApprovalStatus === 'rejected' && (
            <div className="viewer-role-banner viewer-banner-rejected" role="status" id="viewer-rejected-status-banner">
              <div className="banner-icon-box">
                <AlertTriangle size={20} className="text-danger" />
              </div>
              <div className="banner-content">
                <div className="banner-title-row">
                  <strong>Your Owner access request was declined.</strong>
                  <span className="banner-badge badge-rejected">Request Declined</span>
                </div>
                <p className="banner-description">
                  An Administrator reviewed your request for Owner privileges: &quot;
                  <em>{user.roleChangeReason || 'Owner access request rejected by administrator.'}</em>
                  &quot;. Your account retains Viewer access to documents shared with you. You may submit another request when ready.
                </p>
                {approvalStatusNotice && (
                  <div className="banner-live-notice">{approvalStatusNotice}</div>
                )}
              </div>
            </div>
          )}

          {user.role === 'viewer' && user.roleChangeReason && user.ownerApprovalStatus !== 'pending' && user.ownerApprovalStatus !== 'rejected' && (
            <div className="viewer-role-banner viewer-banner-downgraded" role="status">
              <div className="banner-icon-box">
                <CheckCircle2 size={20} className="text-info" />
              </div>
              <div className="banner-content">
                <div className="banner-title-row">
                  <strong>Account Role Notice: Effective Role is Viewer</strong>
                  <span className="banner-badge badge-info">Zero Data Loss Guarantee</span>
                </div>
                <p className="banner-description">
                  Your effective role is Viewer ({user.roleChangeReason}). All documents previously uploaded by you remain{' '}
                  <strong>strictly preserved in vault storage</strong> with existing collaborator access active. New uploads and sharing administration are restricted.
                </p>
              </div>
            </div>
          )}

          {/* Main Page Header */}
          <PageHeader
            title={
              activeNav === 'my-documents'
                ? 'My confidential documents'
                : activeNav === 'shared-with-me'
                ? 'Documents shared with me'
                : `Welcome back, ${user.name}`
            }
            description={
              activeNav === 'my-documents'
                ? 'View and manage confidential corporate files where you are designated as the owner.'
                : activeNav === 'shared-with-me'
                ? user.role === 'viewer'
                  ? 'Review files where a Document Owner has granted you read or edit privileges. Uploading and document ownership require an Owner account.'
                  : 'Review files where another team member has granted you read or edit privileges.'
                : user.role === 'viewer'
                ? 'Review confidential documents shared with your account. Document uploads and ownership require a Document Owner account.'
                : 'Manage, share, and track confidential enterprise documents with fine-grained access policies.'
            }
            onUploadClick={handleUploadClick}
            onViewSharedClick={() => setActiveNav('shared-with-me')}
            isViewer={user.role === 'viewer'}
            onRequestOwnerAccess={handleRequestOwnerAccess}
            ownerApprovalStatus={user.ownerApprovalStatus}
            ownerApprovalRequestedAt={user.ownerApprovalRequestedAt}
            isSubmittingOwnerRequest={submittingOwnerRequest}
          />

          {/* Summary Cards Row */}
          <section className="dashboard-metrics-grid" aria-label="Key Performance Metrics">
            <SummaryCard
              title="TOTAL ACCESSIBLE"
              value={vaultDocuments.length}
              description={user.role === 'viewer' ? 'Files shared with you' : 'Files in your private vault'}
              trend={`${myDocsCount || 0} owned by you`}
              icon={Files}
              variant="primary"
              isDemo={false}
            />
            <SummaryCard
              title="SHARED WITH OTHERS"
              value={sharedWithOthersCount || 0}
              description="Files with active outbound ACLs"
              trend="Real-time access control"
              icon={Share2}
              variant="purple"
              isDemo={false}
            />
            <SummaryCard
              title="SHARED WITH ME"
              value={sharedDocsCount || 0}
              description="Files granted by team members"
              trend="Read or Edit privileges"
              icon={UserCheck}
              variant="success"
              isDemo={false}
            />
            <SummaryCard
              title="AUDIT TRAIL EVENTS"
              value={liveActivities.length}
              description="Logged lifecycle & access events"
              trend="Append-only immutable"
              icon={Activity}
              variant="warning"
              isDemo={false}
            />
          </section>

          {/* Main Content Split: Documents Table + Recent Activity */}
          <div className="dashboard-main-split">
            <div className="table-column">
              {getNavFilteredDocuments().length === 0 ? (
                <div style={{ backgroundColor: 'var(--bg-card)', padding: 'var(--space-8)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
                  <EmptyState
                    icon={Files}
                    title={
                      activeNav === 'my-documents'
                        ? 'No owned documents found'
                        : activeNav === 'shared-with-me'
                        ? 'No shared documents found'
                        : 'Your document vault is empty'
                    }
                    description={
                      user.role === 'viewer'
                        ? 'No documents have been shared with your account yet. When a Document Owner grants you access, documents will appear here.'
                        : 'You have not uploaded any documents yet. Upload a confidential PDF, DOCX, or spreadsheet to begin.'
                    }
                    actionLabel={user.role !== 'viewer' ? 'Upload Document' : undefined}
                    onAction={user.role !== 'viewer' ? handleUploadClick : undefined}
                  />
                </div>
              ) : (
                <DocumentTable
                  documents={getNavFilteredDocuments()}
                  onActionSelect={handleDocumentAction}
                  userRole={user?.role}
                  onRefresh={() => {
                    fetchVaultDocuments();
                    fetchLiveActivities();
                  }}
                />
              )}
            </div>

            <aside className="activity-column" aria-label="Security Audit Trail">
              <ActivityList
                activities={liveActivities}
                isLive={true}
                onViewAllClick={() => openModal({
                  title: 'Audit Trail Explorer',
                  subtitle: 'Full activity and compliance ledger',
                  badge: 'Immutable Compliance Ledger',
                  content: <p>All document lifecycle events are cryptographically captured in the append-only ledger.</p>
                })}
              />
            </aside>
          </div>
        </>
      )}

      {/* Accessible Informational Modal */}
      <Modal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        title={modalConfig.title}
        subtitle={modalConfig.subtitle}
        badge={modalConfig.badge}
        type={modalConfig.type}
        confirmLabel="Understood"
        onConfirm={closeModal}
      >
        {modalConfig.content}
      </Modal>

      {/* Authentication Dialog (Login & Registration) */}
      <AuthModals
        key={`${authModalMode}-${authModalOpen}`}
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        onModeChange={(newMode) => setAuthModalMode(newMode)}
      />

      {/* Document Upload Dialog */}
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadSuccess={(doc) => {
          fetchVaultDocuments();
          fetchLiveActivities();
        }}
        onOpenAuth={() => {
          setAuthModalMode('login');
          setAuthModalOpen(true);
        }}
      />

      {/* Per-Document Access Sharing Dialog */}
      <ShareModal
        isOpen={shareModalConfig.isOpen}
        onClose={() => setShareModalConfig({ isOpen: false, document: null })}
        document={shareModalConfig.document}
        onPermissionsUpdated={() => {
          fetchVaultDocuments();
          fetchLiveActivities();
        }}
      />

      {/* Document Metadata Editor Dialog */}
      <EditModal
        isOpen={editModalConfig.isOpen}
        onClose={() => setEditModalConfig({ isOpen: false, document: null })}
        document={editModalConfig.document}
        onUpdateSuccess={() => {
          fetchVaultDocuments();
          fetchLiveActivities();
        }}
      />
    </AppShell>
  );
}

export default App;
