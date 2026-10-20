import React, { useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { ShieldCheck, GitBranch, Cpu } from 'lucide-react';
import './AppShell.css';

/**
 * AppShell Layout Component
 * Coordinates sidebar navigation, header state, responsive viewport behavior,
 * and standard enterprise container spacing.
 */
export function AppShell({
  children,
  activeNav,
  onNavSelect,
  pageTitle,
  backendConnected,
  onProfileClick,
  onSearchFocus,
  onHelpClick,
}) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="app-shell">
      <AppSidebar
        activeNav={activeNav}
        onNavSelect={onNavSelect}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      <div className="app-main-layout">
        <AppHeader
          pageTitle={pageTitle}
          onMenuToggle={() => setIsMobileNavOpen(!isMobileNavOpen)}
          backendConnected={backendConnected}
          onProfileClick={onProfileClick}
          onSearchFocus={onSearchFocus}
          onHelpClick={onHelpClick}
        />

        <main className="app-content-container" id="main-content" tabIndex="-1">
          {children}
        </main>

        <footer className="app-footer" aria-label="Application Status Footer">
          <div className="footer-content">
            <div className="footer-left">
              <span className="footer-brand">TrustVault</span>
              <span className="footer-divider">•</span>
              <span className="footer-stage">Stage 1 Foundation & UI</span>
              <span className="footer-divider">•</span>
              <span className="footer-copyright">Snovasys Fresher Challenge 2026</span>
            </div>

            <div className="footer-right">
              <div className="footer-badge">
                <ShieldCheck size={13} className="text-primary" />
                <span>Zero-Trust Architecture</span>
              </div>
              <div className="footer-badge">
                <GitBranch size={13} />
                <span>Audited Checkpoints</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
