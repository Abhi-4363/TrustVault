import React from 'react';
import { 
  Menu, 
  Search, 
  User, 
  ShieldCheck, 
  ChevronRight, 
  HelpCircle,
  Activity
} from 'lucide-react';
import './AppHeader.css';

/**
 * AppHeader Component
 * Desktop & mobile header with breadcrumbs, search trigger,
 * live backend health status, and explicitly labelled auth placeholder.
 */
export function AppHeader({
  pageTitle = 'Overview',
  onMenuToggle,
  onProfileClick,
  onSearchFocus,
  onHelpClick,
  backendConnected = false,
}) {
  return (
    <header className="app-header" aria-label="Application Header">
      <div className="header-left">
        <button
          type="button"
          className="mobile-menu-trigger"
          onClick={onMenuToggle}
          aria-label="Open mobile navigation menu"
        >
          <Menu size={20} />
        </button>

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

        {/* Stage 1 Help Documentation Link */}
        <button
          type="button"
          className="header-icon-btn"
          onClick={onHelpClick}
          title="TrustVault Stage 1 Guide & Architecture"
          aria-label="View Stage 1 documentation guide"
        >
          <HelpCircle size={18} />
        </button>

        {/* Explicitly Labelled Authentication Placeholder */}
        <button
          type="button"
          className="user-profile-trigger"
          onClick={onProfileClick}
          aria-label="User profile — Placeholder for Stage 2 Authentication"
          title="Authentication scheduled for Stage 2"
        >
          <div className="user-avatar" aria-hidden="true">
            <User size={16} />
          </div>
          <div className="user-profile-meta">
            <span className="user-display-name">Demo User</span>
            <span className="auth-stage-tag">Auth: Stage 2</span>
          </div>
        </button>
      </div>
    </header>
  );
}
