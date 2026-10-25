import React, { useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { FileCheck, Cpu } from 'lucide-react';
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
  onOpenLogin,
  onOpenRegister,
  myDocsCount,
  sharedDocsCount,
  userRole,
  isAuthenticated = false,
  pendingRequestsCount = 0,
}) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Safeguard: AppShell only renders application chrome (sidebar, app header, app footer) for authenticated sessions.
  // Unauthenticated visitors (landing, auth portals) render their own dedicated single layout.
  if (!isAuthenticated) {
    return (
      <div className="app-shell unauthenticated">
        <main className="app-content-container" id="main-content" tabIndex="-1">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {isAuthenticated && (
        <AppSidebar
          activeNav={activeNav}
          onNavSelect={onNavSelect}
          isMobileOpen={isMobileNavOpen}
          onCloseMobile={() => setIsMobileNavOpen(false)}
          myDocsCount={myDocsCount}
          sharedDocsCount={sharedDocsCount}
          userRole={userRole}
          pendingRequestsCount={pendingRequestsCount}
        />
      )}

      <div className={`app-main-layout ${!isAuthenticated ? 'no-sidebar' : ''}`}>
        <AppHeader
          pageTitle={pageTitle}
          onMenuToggle={() => setIsMobileNavOpen(!isMobileNavOpen)}
          backendConnected={backendConnected}
          onProfileClick={onProfileClick}
          onSearchFocus={onSearchFocus}
          onHelpClick={onHelpClick}
          onOpenLogin={onOpenLogin}
          onOpenRegister={onOpenRegister}
          showMenuToggle={isAuthenticated}
          showSearch={isAuthenticated}
          isMobileSidebarOpen={isMobileNavOpen}
        />

        <main className="app-content-container" id="main-content" tabIndex="-1">
          {children}
        </main>

        <footer className="app-footer" aria-label="Application Status Footer">
          <div className="footer-content">
            <div className="footer-left">
              <span className="footer-brand">TrustVault</span>
              <span className="footer-divider">•</span>
              <span className="footer-status">Every Access. Verified.</span>
              <span className="footer-divider">•</span>
              <span className="footer-copyright">Enterprise Document Governance</span>
            </div>

            <div className="footer-right">
              <div className="footer-badge">
                <FileCheck size={13} className="text-primary" />
                <span>Document-Level Authorization</span>
              </div>
              <div className="footer-badge">
                <Cpu size={13} />
                <span>Auditable Activity Records</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
