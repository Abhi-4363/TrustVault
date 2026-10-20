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
import { UploadModal } from './components/dashboard/UploadModal';
import { ShareModal } from './components/dashboard/ShareModal';
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

  // Auth, Upload & Share Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [shareModalConfig, setShareModalConfig] = useState({ isOpen: false, document: null });

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
        const formatted = (data.documents || []).map((doc) => ({
          id: doc._id,
          name: doc.title,
          originalName: doc.originalName,
          description: doc.description || '',
          fileType: (doc.originalName.split('.').pop() || 'FILE').toUpperCase(),
          fileSize:
            doc.fileSize > 1048576
              ? `${(doc.fileSize / 1048576).toFixed(1)} MB`
              : `${(doc.fileSize / 1024).toFixed(1)} KB`,
          rawSize: doc.fileSize,
          owner: {
            name: user?.name || 'You',
            email: user?.email || '',
            initials: (user?.name || 'Y')
              .split(' ')
              .map((n) => n[0])
              .join('')
              .substring(0, 2)
              .toUpperCase(),
          },
          accessLevel: 'Owner',
          lastUpdated: doc.updatedAt || doc.createdAt,
          formattedDate: new Date(doc.updatedAt || doc.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          tags: doc.tags || [],
          isReal: true,
        }));
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
          const response = await fetch(`http://localhost:5000/api/documents/${doc.id}/download`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'Download failed.');
          }

          const blob = await response.blob();
          const downloadUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = doc.originalName || doc.name;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(downloadUrl);
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
    const combinedDocs = [...vaultDocuments, ...DEMO_DOCUMENTS];
    if (activeNav === 'my-documents') {
      return combinedDocs.filter((d) => d.accessLevel === 'Owner');
    }
    if (activeNav === 'shared-with-me') {
      return combinedDocs.filter((d) => d.accessLevel !== 'Owner');
    }
    return combinedDocs;
  };

  // Determine current page title
  const getPageTitle = () => {
    switch (activeNav) {
      case 'my-documents':
        return 'My Documents';
      case 'shared-with-me':
        return 'Shared with Me';
      case 'activity':
        return 'Security Activity & Audit';
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
    >
      {/* Explicit Demonstration Banner */}
      <DemoDataBanner
        onCheckHealth={checkBackendHealth}
        healthStatus={backendHealth}
      />

      {/* Main Page Header */}
      <PageHeader
        title={
          activeNav === 'my-documents'
            ? 'My confidential documents'
            : activeNav === 'shared-with-me'
            ? 'Documents shared with me'
            : activeNav === 'activity'
            ? 'Audit trail & event log'
            : activeNav === 'settings'
            ? 'Vault security settings'
            : 'Document overview'
        }
        description={
          activeNav === 'my-documents'
            ? 'View and manage confidential corporate files where you are designated as the owner.'
            : activeNav === 'shared-with-me'
            ? 'Review files where another team member has granted you read or edit privileges.'
            : activeNav === 'activity'
            ? 'Chronological record of document access, permissions changes, and administrative events.'
            : activeNav === 'settings'
            ? 'Manage encryption policies, access revocation parameters, and compliance standards.'
            : 'Manage, share, and track confidential enterprise documents with fine-grained access policies.'
        }
        onUploadClick={handleUploadClick}
        onViewSharedClick={() => setActiveNav('shared-with-me')}
      />

      {/* Summary Cards Row */}
      <section className="dashboard-metrics-grid" aria-label="Key Performance Metrics">
        <SummaryCard
          title={DEMO_METRICS.totalDocuments.label}
          value={DEMO_METRICS.totalDocuments.value}
          description={DEMO_METRICS.totalDocuments.description}
          trend={DEMO_METRICS.totalDocuments.trend}
          icon={Files}
          variant="primary"
          isDemo={true}
        />
        <SummaryCard
          title={DEMO_METRICS.sharedWithOthers.label}
          value={DEMO_METRICS.sharedWithOthers.value}
          description={DEMO_METRICS.sharedWithOthers.description}
          trend={DEMO_METRICS.sharedWithOthers.trend}
          icon={Share2}
          variant="purple"
          isDemo={true}
        />
        <SummaryCard
          title={DEMO_METRICS.sharedWithMe.label}
          value={DEMO_METRICS.sharedWithMe.value}
          description={DEMO_METRICS.sharedWithMe.description}
          trend={DEMO_METRICS.sharedWithMe.trend}
          icon={UserCheck}
          variant="success"
          isDemo={true}
        />
        <SummaryCard
          title={DEMO_METRICS.recentActivities.label}
          value={DEMO_METRICS.recentActivities.value}
          description={DEMO_METRICS.recentActivities.description}
          trend={DEMO_METRICS.recentActivities.trend}
          icon={Activity}
          variant="warning"
          isDemo={true}
        />
      </section>

      {/* Main Content Split: Documents Table + Recent Activity */}
      {activeNav === 'profile' ? (
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

          {user ? (
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
                      {user.role || 'Member'}
                    </span>
                  </span>
                </li>
                <li className="modal-meta-item">
                  <span className="modal-meta-label">Private Documents:</span>
                  <span className="modal-meta-val">{vaultDocuments.length} files quarantined in vault storage</span>
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
                <Button variant="primary" onClick={() => setUploadModalOpen(true)}>
                  Upload Document
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
              <Lock size={36} style={{ color: 'var(--color-warning-icon)', margin: '0 auto var(--space-3)' }} />
              <h3 style={{ fontSize: 'var(--text-base)', margin: '0 0 var(--space-2)' }}>
                Anonymous Vault Session
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', maxWidth: '420px', margin: '0 auto var(--space-4)' }}>
                You are currently exploring TrustVault in public preview mode. Sign in to your corporate identity to manage your private vault documents.
              </p>
              <Button 
                variant="primary" 
                onClick={() => {
                  setAuthModalMode('login');
                  setAuthModalOpen(true);
                }}
              >
                Sign In to Vault
              </Button>
            </div>
          )}
        </div>
      ) : activeNav === 'settings' ? (
        <div className="settings-preview-panel" style={{ backgroundColor: 'var(--bg-card)', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Vault Security Standards (Stage 3 Baseline)</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
            These parameters represent the active security baseline. Active configuration mutation will be enabled in Stage 8.
          </p>
          <ul className="modal-meta-list">
            <li className="modal-meta-item">
              <span className="modal-meta-label">Storage Isolation:</span>
              <span className="modal-meta-val">Private disk storage (Non-web-accessible)</span>
            </li>
            <li className="modal-meta-item">
              <span className="modal-meta-label">Maximum Upload Size:</span>
              <span className="modal-meta-val">25 MB per document</span>
            </li>
            <li className="modal-meta-item">
              <span className="modal-meta-label">Authorization Protocol:</span>
              <span className="modal-meta-val">Per-request database validation (Zero token caching lag)</span>
            </li>
            <li className="modal-meta-item">
              <span className="modal-meta-label">Audit Log Policy:</span>
              <span className="modal-meta-val">Append-only (Modifications and deletions prohibited)</span>
            </li>
          </ul>
        </div>
      ) : activeNav === 'activity' ? (
        <div style={{ maxWidth: '800px' }}>
          <ActivityList
            activities={liveActivities.length > 0 ? liveActivities : DEMO_ACTIVITIES}
            isLive={liveActivities.length > 0}
            onViewAllClick={() => openModal({
              title: 'Complete Audit Log Stream',
              subtitle: 'System-wide compliance audit records',
              badge: 'Stage 6 Immutable Ledger',
              content: <p>All document uploads, reads, downloads, permission grants, and revocations are permanently logged with actor ID and IP.</p>
            })}
          />
        </div>
      ) : (
        <div className="dashboard-main-split">
          <div className="table-column">
            <DocumentTable
              documents={getNavFilteredDocuments()}
              onActionSelect={handleDocumentAction}
            />
          </div>

          <aside className="activity-column" aria-label="Security Audit Trail">
            <ActivityList
              activities={liveActivities.length > 0 ? liveActivities : DEMO_ACTIVITIES}
              isLive={liveActivities.length > 0}
              onViewAllClick={() => openModal({
                title: 'Audit Trail Explorer',
                subtitle: 'Full activity and compliance ledger',
                badge: 'Stage 6 Immutable Ledger',
                content: <p>All document lifecycle events are cryptographically captured in the append-only ledger.</p>
              })}
            />
          </aside>
        </div>
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
    </AppShell>
  );
}

export default App;
