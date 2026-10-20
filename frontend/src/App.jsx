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
import { Button } from './components/common/Button';
import { EmptyState } from './components/common/EmptyState';
import { 
  DEMO_METRICS, 
  DEMO_DOCUMENTS, 
  DEMO_ACTIVITIES 
} from './mock/mockData';
import './App.css';

export function App() {
  const [activeNav, setActiveNav] = useState('overview');
  const [backendHealth, setBackendHealth] = useState(null);
  const [backendConnected, setBackendConnected] = useState(false);

  // Auth Modal State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');

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
      // Backend server is not running on localhost:5000 in this process
      setBackendConnected(false);
    }
  };

  useEffect(() => {
    checkBackendHealth();
  }, []);

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

  // Action handlers with transparent Stage 1 feedback
  const handleUploadClick = () => {
    openModal({
      title: 'Document Ingestion (Stage 3)',
      subtitle: 'Upload handling and encrypted disk persistence',
      badge: 'Scheduled for Stage 3',
      content: (
        <div>
          <p>
            In Stage 1, all document records are demonstration models. In <strong>Stage 3</strong>, you will be able to:
          </p>
          <div className="modal-notice-box">
            <h4>Planned Stage 3 Capabilities</h4>
            <p>
              • Ingest PDF, Word, and Excel files with strict 25MB payload validation.<br />
              • Quarantine files in an isolated private directory outside public web roots.<br />
              • Generate cryptographic UUIDs and calculate file hashes for tamper prevention.
            </p>
          </div>
          <p className="text-secondary" style={{ fontSize: '13px' }}>
            No file was saved or transferred. To view the implementation plan, see <code>docs/DEVELOPMENT_PLAN.md</code>.
          </p>
        </div>
      ),
    });
  };

  const handleDocumentAction = (action, doc) => {
    if (action === 'share') {
      openModal({
        title: `Manage Permissions: ${doc.name}`,
        subtitle: 'Access Control Lists & Granular Sharing',
        badge: 'Scheduled for Stage 4 & 5',
        content: (
          <div>
            <p>
              Permission assignment and immediate revocation will be implemented in <strong>Stage 4 & 5</strong>.
            </p>
            <div className="modal-notice-box">
              <h4>Target Authorization Architecture</h4>
              <p>
                • Grant <strong>Can Read</strong> or <strong>Can Edit</strong> rights to specific named users.<br />
                • Immediately revoke access: authorization is re-checked on every single byte stream request without token caching lag.<br />
                • Automatically record all permission changes in the immutable audit log.
              </p>
            </div>
            <ul className="modal-meta-list">
              <li className="modal-meta-item">
                <span className="modal-meta-label">Selected Document:</span>
                <span className="modal-meta-val">{doc.name}</span>
              </li>
              <li className="modal-meta-item">
                <span className="modal-meta-label">Current Owner:</span>
                <span className="modal-meta-val">{doc.owner.name}</span>
              </li>
              <li className="modal-meta-item">
                <span className="modal-meta-label">Effective Permission:</span>
                <span className="modal-meta-val">{doc.accessLevel}</span>
              </li>
            </ul>
          </div>
        ),
      });
    } else if (action === 'download') {
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
              Because this file is a fictional Stage 1 demonstration record, no raw file exists on disk to download.
            </p>
          </div>
        ),
      });
    } else if (action === 'details') {
      openModal({
        title: `Security Metadata: ${doc.name}`,
        subtitle: 'File integrity and classification details',
        badge: 'Stage 1 Demo Record',
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
                <span className="modal-meta-label">Classification:</span>
                <span className="modal-meta-val">{doc.status}</span>
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
    openModal({
      title: 'Authentication & Session Architecture',
      subtitle: 'User accounts, hashed passwords, and RBAC',
      badge: 'Scheduled for Stage 2',
      content: (
        <div>
          <p>
            In Stage 1, TrustVault operates in anonymous preview mode without mock or fake authentication.
          </p>
          <div className="modal-notice-box">
            <h4>Scheduled for Stage 2</h4>
            <p>
              • MongoDB User model with bcrypt password hashing (12 rounds).<br />
              • JWT-based stateless session management with short expiration.<br />
              • Role-based permissions: Administrator, Manager, and Standard Member.
            </p>
          </div>
          <p style={{ fontSize: '13px' }}>
            Current placeholder user: <strong>Demo User (Anonymous)</strong>.
          </p>
        </div>
      ),
    });
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
      badge: 'Stage 1 Specification',
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
              <span className="modal-meta-label">Threat Model:</span>
              <span className="modal-meta-val">12 enterprise vectors in <code>THREATS.md</code></span>
            </li>
          </ul>
        </div>
      ),
    });
  };

  // Filter documents based on active navigation item
  const getNavFilteredDocuments = () => {
    if (activeNav === 'my-documents') {
      return DEMO_DOCUMENTS.filter((d) => d.accessLevel === 'Owner');
    }
    if (activeNav === 'shared-with-me') {
      return DEMO_DOCUMENTS.filter((d) => d.accessLevel !== 'Owner');
    }
    return DEMO_DOCUMENTS;
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
      {activeNav === 'settings' ? (
        <div className="settings-preview-panel" style={{ backgroundColor: 'var(--bg-card)', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Vault Security Standards (Stage 1 Baseline)</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
            These parameters represent the planned security baseline. Active configuration mutation will be enabled in Stage 8.
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
            activities={DEMO_ACTIVITIES}
            onViewAllClick={() => openModal({
              title: 'Complete Audit Log Stream',
              subtitle: 'System-wide compliance audit records',
              badge: 'Scheduled for Stage 6 & 8',
              content: <p>Comprehensive audit stream filtering by actor, IP address, and date range is scheduled for Stages 6 & 8.</p>
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
              activities={DEMO_ACTIVITIES}
              onViewAllClick={() => openModal({
                title: 'Audit Trail Explorer',
                subtitle: 'Full activity and compliance ledger',
                badge: 'Scheduled for Stage 6',
                content: <p>Complete audit ledger export (JSON/CSV) and filter by document ID will be available in Stage 6.</p>
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
    </AppShell>
  );
}

export default App;
