import React, { useState } from 'react';
import { 
  Menu, 
  Search, 
  User, 
  ChevronRight, 
  HelpCircle,
  LogOut,
  Shield,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import './AppHeader.css';

/**
 * AppHeader Component
 * Desktop & mobile header with breadcrumbs, search trigger,
 * live backend health status, and active user session profile controls.
 */
export function AppHeader({
  pageTitle = 'Overview',
  onMenuToggle,
  onSearchFocus,
  onHelpClick,
  backendConnected = false,
  onOpenLogin,
  onOpenRegister,
  showMenuToggle = true,
}) {
  const { user, isAuthenticated, logout } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const formatRoleLabel = (role) => {
    if (!role) return 'Viewer';
    const r = String(role).toLowerCase().trim();
    if (r === 'admin') return 'Administrator';
    if (r === 'owner' || r === 'document_owner') return 'Document Owner';
    if (r === 'viewer' || r === 'member') return 'Viewer';
    return role;
  };

  const getInitials = (fullName) => {
    if (!fullName) return 'U';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <header className="app-header" aria-label="Application Header">
      <div className="header-left">
        {!showMenuToggle ? (
          <div className="header-unauth-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
            <div style={{ backgroundColor: 'var(--color-primary-600)', color: '#ffffff', width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={16} />
            </div>
            <span style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              TrustVault
            </span>
          </div>
        ) : (
          <button
            type="button"
            className="mobile-menu-trigger"
            onClick={onMenuToggle}
            aria-label="Open mobile navigation menu"
          >
            <Menu size={20} />
          </button>
        )}

        <nav className="header-breadcrumb" aria-label="Breadcrumb">
          <ol className="breadcrumb-list">
            <li className="breadcrumb-item">
              <span className="breadcrumb-root">TrustVault</span>
            </li>
            <li className="breadcrumb-separator" aria-hidden="true">
              <ChevronRight size={14} />
            </li>
            <li className="breadcrumb-item">
              <span className="breadcrumb-current" aria-current="page">
                {pageTitle}
              </span>
            </li>
          </ol>
        </nav>
      </div>

      <div className="header-right">
        {/* Global Quick Search */}
        <div className="header-search-wrapper">
          <Search size={15} className="header-search-icon" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search vault (Ctrl + K)..."
            className="header-search-input"
            onClick={onSearchFocus}
            readOnly
            aria-label="Search documents and audit logs"
          />
        </div>

        {/* Backend API Health Status Indicator */}
        <div 
          className={`api-status-pill ${backendConnected ? 'api-online' : 'api-standby'}`}
          title={backendConnected ? 'Backend service online at /api/health' : 'Backend in standby mode'}
        >
          <span className="api-dot" aria-hidden="true" />
          <span className="api-status-text">
            {backendConnected ? 'API Connected' : 'API Standby'}
          </span>
        </div>

        {/* Help Documentation Link */}
        <button
          type="button"
          className="header-icon-btn"
          onClick={onHelpClick}
          title="TrustVault Architecture & Guide"
          aria-label="View documentation guide"
        >
          <HelpCircle size={18} />
        </button>

        {/* Active Session / Authentication Trigger */}
        {isAuthenticated && user ? (
          <div className="profile-dropdown-container">
            <button
              type="button"
              className="user-profile-trigger"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              aria-expanded={profileDropdownOpen}
              aria-haspopup="true"
              aria-label={`User menu for ${user.name}`}
            >
              <div className="user-avatar" aria-hidden="true">
                {getInitials(user.name)}
              </div>
              <div className="user-profile-meta">
                <span className="user-display-name">{user.name}</span>
                <span className="user-role-badge">{formatRoleLabel(user.role)}</span>
              </div>
              <ChevronDown size={14} className="dropdown-caret" />
            </button>

            {profileDropdownOpen && (
              <div className="profile-dropdown-menu" role="menu">
                <div className="dropdown-user-header">
                  <p className="dropdown-user-name">{user.name}</p>
                  <p className="dropdown-user-email">{user.email}</p>
                  <span className="dropdown-role-tag">Role: {formatRoleLabel(user.role)}</span>
                </div>
                <div className="dropdown-divider" />
                <button
                  type="button"
                  className="dropdown-item dropdown-logout-btn"
                  role="menuitem"
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    logout();
                  }}
                >
                  <LogOut size={14} />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="auth-header-actions">
            <Button variant="ghost" size="sm" onClick={onOpenLogin}>
              Sign in
            </Button>
            <Button variant="primary" size="sm" onClick={onOpenRegister}>
              Create account
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
