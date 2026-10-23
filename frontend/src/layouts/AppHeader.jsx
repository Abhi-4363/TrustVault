import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, 
  Search, 
  User, 
  ChevronRight, 
  HelpCircle,
  LogOut,
  Shield,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import './AppHeader.css';

/**
 * AppHeader Component
 * Desktop & mobile header with breadcrumbs, search trigger,
 * live backend health status, theme selection control, and active user session profile controls.
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
  showSearch,
  isMobileSidebarOpen = false,
}) {
  const { user, isAuthenticated, logout } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  
  // Theme state persisted in localStorage
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('trustvault_theme') || 'system';
  });

  const themeRef = useRef(null);
  const profileRef = useRef(null);

  // Sync theme attribute to documentElement
  useEffect(() => {
    const applyTheme = (t) => {
      if (t === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      } else {
        document.documentElement.setAttribute('data-theme', t);
      }
    };

    applyTheme(theme);
    try {
      localStorage.setItem('trustvault_theme', theme);
    } catch {
      // LocalStorage access handling
    }

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  // Click-outside listener for dropdown menus
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (themeRef.current && !themeRef.current.contains(e.target)) {
        setThemeDropdownOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Search bar is only displayed for authenticated vault sessions
  const isSearchVisible = showSearch !== undefined 
    ? (showSearch && Boolean(isAuthenticated && user)) 
    : Boolean(isAuthenticated && user);

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
          <div className="header-unauth-brand">
            <div className="brand-icon-shield">
              <Shield size={16} />
            </div>
            <span className="brand-text-logo">
              TrustVault
            </span>
          </div>
        ) : (
          <button
            type="button"
            className="mobile-menu-trigger"
            onClick={onMenuToggle}
            aria-label="Open mobile navigation menu"
            aria-expanded={isMobileSidebarOpen}
            id="mobile-nav-toggle-btn"
          >
            <Menu size={20} />
          </button>
        )}

        <nav className={`header-breadcrumb ${!showMenuToggle ? 'hide-on-mobile' : ''}`} aria-label="Breadcrumb">
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
        {/* Global Quick Search - Only rendered on authenticated application pages */}
        {isSearchVisible && (
          <div className="header-search-wrapper" id="header-search-wrapper">
            <Search size={15} className="header-search-icon" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search vault (Ctrl + K)..."
              className="header-search-input"
              onClick={onSearchFocus}
              readOnly
              aria-label="Search documents and audit logs"
              id="header-vault-search"
            />
          </div>
        )}

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

        {/* Theme Selector Control */}
        <div className="theme-dropdown-container" ref={themeRef}>
          <button
            type="button"
            className="header-icon-btn theme-toggle-btn"
            onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
            aria-label={`Theme: ${theme}. Click to change theme`}
            aria-expanded={themeDropdownOpen}
            aria-haspopup="true"
            title={`Appearance Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`}
            id="header-theme-selector-btn"
          >
            {theme === 'dark' ? (
              <Moon size={17} className="theme-icon-active" />
            ) : theme === 'light' ? (
              <Sun size={17} className="theme-icon-active" />
            ) : (
              <Monitor size={17} className="theme-icon-active" />
            )}
          </button>

          {themeDropdownOpen && (
            <div className="theme-dropdown-menu" role="menu" aria-label="Theme appearance options">
              <div className="dropdown-menu-header">
                <span className="dropdown-menu-title">Appearance Theme</span>
              </div>
              <button
                type="button"
                className={`dropdown-item theme-option ${theme === 'light' ? 'active' : ''}`}
                role="menuitem"
                onClick={() => {
                  setTheme('light');
                  setThemeDropdownOpen(false);
                }}
              >
                <Sun size={15} />
                <span className="theme-label">Light Theme</span>
                {theme === 'light' && <Check size={14} className="theme-check" />}
              </button>
              <button
                type="button"
                className={`dropdown-item theme-option ${theme === 'dark' ? 'active' : ''}`}
                role="menuitem"
                onClick={() => {
                  setTheme('dark');
                  setThemeDropdownOpen(false);
                }}
              >
                <Moon size={15} />
                <span className="theme-label">Dark Theme</span>
                {theme === 'dark' && <Check size={14} className="theme-check" />}
              </button>
              <button
                type="button"
                className={`dropdown-item theme-option ${theme === 'system' ? 'active' : ''}`}
                role="menuitem"
                onClick={() => {
                  setTheme('system');
                  setThemeDropdownOpen(false);
                }}
              >
                <Monitor size={15} />
                <span className="theme-label">System Default</span>
                {theme === 'system' && <Check size={14} className="theme-check" />}
              </button>
            </div>
          )}
        </div>

        {/* Active Session / Authentication Trigger */}
        {isAuthenticated && user ? (
          <div className="profile-dropdown-container" ref={profileRef}>
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
