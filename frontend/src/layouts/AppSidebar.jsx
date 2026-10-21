import React from 'react';
import { 
  LayoutDashboard, 
  Files, 
  Share2, 
  Activity, 
  Settings, 
  ShieldCheck, 
  ShieldAlert,
  Lock, 
  User, 
  X 
} from 'lucide-react';
import './AppSidebar.css';

/**
 * AppSidebar Component
 * Enterprise sidebar with brand mark, primary navigation links,
 * and security status indicator.
 */
function formatRoleLabel(role) {
  if (!role) return 'Viewer';
  const r = String(role).toLowerCase().trim();
  if (r === 'admin') return 'Administrator';
  if (r === 'owner' || r === 'document_owner') return 'Document Owner';
  if (r === 'viewer' || r === 'member') return 'Viewer';
  return role;
}

export function AppSidebar({
  activeNav = 'overview',
  onNavSelect,
  isMobileOpen = false,
  onCloseMobile,
  myDocsCount = null,
  sharedDocsCount = null,
  userRole = null,
}) {
  const normalizedRole = String(userRole || '').toLowerCase().trim();
  const isAdmin = normalizedRole === 'admin';
  const isViewer = normalizedRole === 'viewer' || normalizedRole === 'member';

  let navItems = [];
  if (isAdmin) {
    navItems = [
      { id: 'admin', label: 'Admin Governance', icon: ShieldAlert, tag: 'ADMIN' },
      { id: 'overview', label: 'Overview', icon: LayoutDashboard, tag: null },
      { id: 'my-documents', label: 'My Documents', icon: Files, tag: myDocsCount !== null ? String(myDocsCount) : null },
      { id: 'shared-with-me', label: 'Shared with Me', icon: Share2, tag: sharedDocsCount !== null ? String(sharedDocsCount) : null },
      { id: 'activity', label: 'Activity & Audit', icon: Activity, tag: null },
      { id: 'settings', label: 'Settings', icon: Settings, tag: null },
      { id: 'profile', label: 'Profile', icon: User, tag: null },
    ];
  } else if (isViewer) {
    navItems = [
      { id: 'shared-with-me', label: 'Shared with Me', icon: Share2, tag: sharedDocsCount !== null ? String(sharedDocsCount) : null },
      { id: 'overview', label: 'Overview', icon: LayoutDashboard, tag: null },
      { id: 'activity', label: 'Activity & Audit', icon: Activity, tag: null },
      { id: 'settings', label: 'Settings', icon: Settings, tag: null },
      { id: 'profile', label: 'Profile', icon: User, tag: null },
    ];
  } else {
    // Document Owner
    navItems = [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard, tag: null },
      { id: 'my-documents', label: 'My Documents', icon: Files, tag: myDocsCount !== null ? String(myDocsCount) : null },
      { id: 'shared-with-me', label: 'Shared with Me', icon: Share2, tag: sharedDocsCount !== null ? String(sharedDocsCount) : null },
      { id: 'activity', label: 'Activity & Audit', icon: Activity, tag: null },
      { id: 'settings', label: 'Settings', icon: Settings, tag: null },
      { id: 'profile', label: 'Profile', icon: User, tag: null },
    ];
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={onCloseMobile} 
          role="presentation" 
          aria-hidden="true" 
        />
      )}

      <aside className={`app-sidebar ${isMobileOpen ? 'mobile-open' : ''}`} aria-label="Main Navigation">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon-wrapper" aria-hidden="true">
              <ShieldCheck size={20} className="brand-shield" />
            </div>
            <div className="brand-text-group">
              <span className="brand-name">TrustVault</span>
              <span className="brand-badge">{formatRoleLabel(userRole)}</span>
            </div>
          </div>

          <button
            type="button"
            className="mobile-close-sidebar"
            onClick={onCloseMobile}
            aria-label="Close navigation sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group-label">Vault Workspace</div>
          <ul className="nav-list" role="list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;

              return (
                <li key={item.id} className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
                    onClick={() => {
                      onNavSelect(item.id);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon size={18} className="nav-icon" aria-hidden="true" />
                    <span className="nav-label">{item.label}</span>
                    {item.tag && <span className="nav-tag">{item.tag}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="security-status-card">
            <div className="security-status-header">
              <Lock size={14} className="security-lock-icon" aria-hidden="true" />
              <span className="security-status-title">Zero-Trust Vault</span>
            </div>
            <p className="security-status-text">
              Zero static exposure. Download streaming authorized per request.
            </p>
            <div className="security-status-meta">
              <span className="status-dot" aria-hidden="true" />
              <span>Zero-Trust Active</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
