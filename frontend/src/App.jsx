import React, { useState, useEffect } from 'react';
import { 
  Files, 
  Share2, 
  UserCheck, 
  Activity, 
  Upload, 
  ShieldCheck, 
  Lock, 
  HelpCircle,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Settings as SettingsIcon,
  Search
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
import { Button } from './components/common/Button';
import { EmptyState } from './components/common/EmptyState';
import { 
  DEMO_METRICS, 
  DEMO_DOCUMENTS, 
  DEMO_ACTIVITIES 
} from './mock/mockData';
import './App.css';
import { useAuth } from './context/AuthContext';

export function App() {
  const [activeNav, setActiveNav] = useState('overview');
  const [backendHealth, setBackendHealth] = useState(null);
  const [backendConnected, setBackendConnected] = useState(false);

  // Authentication Context
  const { user, token, logout } = useAuth();

  // Auth, Upload, Share & Edit Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
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
    badge: 'Stage 1 Notice',
    type: 'info',
    content: null,
  });

  // Attempt live connection check to Express backend
  const checkBackendHealth = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/health');
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
      const response = await fetch('http://localhost:5000/api/documents', {
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
              name: ownerName,
              email: ownerEmail,
              initials: initials || 'TV',
            },
            accessLevel: mappedAccess,
            acl: doc.acl || [],
            lastUpdated: doc.updatedAt || doc.createdAt,
            formattedDate: new Date(doc.updatedAt || doc.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            tags: doc.tags || [],
            isReal: true,
          };
        });
        setVaultDocuments(formatted);
      }
    } catch (err) {
      console.error('[Document Fetch Error]:', err);
    }
  };

  // Fetch real immutable audit activity records (Stage 6)
  const fetchLiveActivities = async () => {
    if (!token) return;
    try {
      const res = await fetch('http://localhost:5000/api/documents/audit/activity', {
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

  const openModal = (config) => {
    setModalConfig({
      isOpen: true,
      title: config.title || 'Feature Notice',
      subtitle: config.subtitle || 'TrustVault Architecture Boundary',
      badge: config.badge || 'Stage Notice',
      type: config.type || 'info',
      content: config.content,
    });
  };

  const closeModal = () => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
  };

  // Open interactive Stage 3 private storage upload modal
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
          const response = await fetch(`http://localhost:5000/api/documents/${doc.id}/download`, {
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
            setTimeout(() => {
              if (link.parentNode) link.parentNode.removeChild(link);
              URL.revokeObjectURL(downloadUrl);
            }, 100);
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
        badge: 'Scheduled for Stage 3',
        content: (
          <div>
            <p>
              TrustVault strictly prohibits public static file links.
            </p>
            <div className="modal-notice-box">
              <h4>Zero-Leakage Streaming Design</h4>
              <p>
                In Stage 3, downloads are routed through <code>GET /api/documents/:id/download</code>. The server verifies user authentication and active ACL permissions in real-time before streaming bytes with <code>Content-Disposition: attachment</code> and <code>X-Content-Type-Options: nosniff</code>.
              </p>
            </div>
            <p style={{ fontSize: '13px' }}>
              Because this file is a fictional demonstration record, no raw file exists on disk to download. Upload your own file using the "Upload" button to test live streaming downloads!
            </p>
          </div>
        ),
      });
    } else if (action === 'delete') {
      if (doc.isReal) {
        if (window.confirm(`Are you sure you want to permanently delete "${doc.name}" from private vault storage?`)) {
          try {
            const response = await fetch(`http://localhost:5000/api/documents/${doc.id}`, {
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
        fetch(`http://localhost:5000/api/documents/${doc.id}/audit`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json())
          .then((data) => {
            const logs = data.auditLogs || [];
            openModal({
              title: `Security Metadata: ${doc.name}`,
              subtitle: 'File integrity and tamper-resistant audit ledger',
              badge: 'Stage 6 Audit Trail',
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
      badge: 'Scheduled for Stage 7',
      content: (
        <div>
          <p>
            Global vault search is scheduled for <strong>Stage 7</strong>.
          </p>
          <div className="modal-notice-box">
            <h4>Security Guarantee</h4>
            <p>
              Search indexes will always enforce the requesting user's permission boundaries at query execution time, ensuring confidential file titles or metadata never leak in search results.
            </p>
          </div>
          <p style={{ fontSize: '13px' }}>
            Tip: You can use the search bar inside the Recent Documents table right now to filter the demonstration documents in memory.
          </p>
        </div>
      ),
    });
  };

  const handleHelpClick = () => {
    openModal({
      title: 'TrustVault — Engineering Guide',
      subtitle: 'Snovasys Fresher Challenge 2026',
      badge: 'Stage 3 Specification',
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
    if (!user) return 'Welcome to TrustVault';
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
        return 'Vault Configuration';
      case 'profile':
        return 'User Identity & Role';
      default:
        return 'Overview';
    }
  };

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
      isAuthenticated={Boolean(user)}
    >
      {!user ? (
        <AuthLandingPortal
          onOpenLogin={() => {
            setAuthModalMode('login');
            setAuthModalOpen(true);
          }}
          onOpenRegister={() => {
            setAuthModalMode('register');
            setAuthModalOpen(true);
          }}
        />
      ) : activeNav === 'profile' ? (
        <div 
          className="profile-preview-panel" 
          style={{ 
            backgroundColor: 'var(--bg-card)', 
            padding: 'var(--space-6)', 
            borderRadius: 'var(--radius-lg)', 
            border: '1px solid var(--border-light)',
            maxWidth: '680px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div style={{ backgroundColor: 'var(--color-primary-100)', color: 'var(--color-primary-700)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)' }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: 'var(--text-lg)', margin: 0, color: 'var(--text-main)' }}>
                Identity & Access Governance
              </h2>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                Cryptographic session verification and tenant role assignment
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <ul className="modal-meta-list">
              <li className="modal-meta-item">
                <span className="modal-meta-label">Full Name:</span>
                <span className="modal-meta-val"><strong>{user.name}</strong></span>
              </li>
              <li className="modal-meta-item">
                <span className="modal-meta-label">Email Address:</span>
                <span className="modal-meta-val"><code>{user.email}</code></span>
              </li>
              <li className="modal-meta-item">
                <span className="modal-meta-label">Assigned Role:</span>
                <span className="modal-meta-val" style={{ textTransform: 'capitalize' }}>
                  <span className="doc-vault-pill" style={{ fontSize: '11px' }}>
                    {user.role === 'admin' ? 'Administrator' : (user.role === 'viewer' || user.role === 'member') ? 'Viewer' : 'Document Owner'}
                  </span>
                </span>
              </li>
              <li className="modal-meta-item">
                <span className="modal-meta-label">Private Documents:</span>
                <span className="modal-meta-val">{vaultDocuments.length} files accessible in vault storage</span>
              </li>
              <li className="modal-meta-item">
                <span className="modal-meta-label">Session Security:</span>
                <span className="modal-meta-val">HMAC SHA-256 JWT (Active)</span>
              </li>
            </ul>

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={logout}>
                Sign Out of Session
              </Button>
              {user.role !== 'viewer' && (
                <Button variant="primary" onClick={() => setUploadModalOpen(true)}>
                  Upload Document
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : activeNav === 'admin' ? (
        <AdminDashboard
          user={user}
          token={token}
          onNavigateToLogin={() => {
            setAuthModalMode('login');
            setAuthModalOpen(true);
          }}
        />
      ) : activeNav === 'settings' ? (
        <div className="settings-preview-panel" style={{ backgroundColor: 'var(--bg-card)', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Vault Security Standards (Production Hardened)</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
            These parameters represent the active security baseline enforced across all API endpoints and streams.
          </p>
          <ul className="modal-meta-list">
            <li className="modal-meta-item">
              <span className="modal-meta-label">Storage Isolation:</span>
              <span className="modal-meta-val">Private disk storage (Non-web-accessible UUID filenames)</span>
            </li>
            <li className="modal-meta-item">
              <span className="modal-meta-label">Maximum Upload Size:</span>
              <span className="modal-meta-val">25 MB per document (Magic-number inspection enforced)</span>
            </li>
            <li className="modal-meta-item">
              <span className="modal-meta-label">Authorization Protocol:</span>
              <span className="modal-meta-val">Per-request database validation (Zero token caching lag)</span>
            </li>
            <li className="modal-meta-item">
              <span className="modal-meta-label">Audit Log Policy:</span>
              <span className="modal-meta-val">Append-only immutable ledger (Modifications and deletions prohibited)</span>
            </li>
          </ul>
        </div>
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
          {/* Main Page Header */}
          <PageHeader
            title={
              activeNav === 'my-documents'
                ? 'My confidential documents'
                : activeNav === 'shared-with-me'
                ? 'Documents shared with me'
                : 'Document overview'
            }
            description={
              activeNav === 'my-documents'
                ? 'View and manage confidential corporate files where you are designated as the owner.'
                : activeNav === 'shared-with-me'
                ? 'Review files where another team member has granted you read or edit privileges.'
                : 'Manage, share, and track confidential enterprise documents with fine-grained access policies.'
            }
            onUploadClick={handleUploadClick}
            onViewSharedClick={() => setActiveNav('shared-with-me')}
            isViewer={user.role === 'viewer'}
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
                  badge: 'Stage 6 Immutable Ledger',
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
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />

      {/* Stage 3 Document Upload Dialog */}
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

      {/* Stage 4 Per-Document Access Sharing Dialog */}
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
