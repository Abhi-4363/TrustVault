import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  UserCheck, 
  Shield, 
  Eye, 
  FileText, 
  Activity, 
  ArrowRight, 
  LogIn, 
  UserPlus, 
  AlertCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import './AuthLandingPortal.css';

export function AuthLandingPortal({ onOpenLogin, onOpenRegister }) {
  const { login } = useAuth();
  const [loadingPersona, setLoadingPersona] = useState(null);
  const [error, setError] = useState('');

  const personas = [
    {
      id: 'owner',
      name: 'Sarah Jenkins',
      title: 'VP Engineering',
      role: 'Document Owner',
      roleBadgeClass: 'badge-owner',
      email: 'sarah.lead@trustvault.internal',
      password: 'TrustVault2026!',
      description: 'Can upload confidential files, manage ACL access control lists, and review document audit trails.',
      icon: FileText,
      accentColor: 'var(--color-primary-600)',
    },
    {
      id: 'viewer',
      name: 'Alex Mercer',
      title: 'Platform Engineer',
      role: 'Viewer',
      roleBadgeClass: 'badge-viewer',
      email: 'alex.dev@trustvault.internal',
      password: 'TrustVault2026!',
      description: 'Read-only collaborator. Can view and download shared files; strictly blocked from uploading new documents.',
      icon: Eye,
      accentColor: 'var(--color-slate-600)',
    },
    {
      id: 'admin',
      name: 'Marcus Vance',
      title: 'Chief Security Officer',
      role: 'Administrator',
      roleBadgeClass: 'badge-admin',
      email: 'admin@trustvault.internal',
      password: 'TrustVault2026!',
      description: 'Full governance visibility: system analytics, global audit log explorer with CSV/JSON export, and user management.',
      icon: Shield,
      accentColor: 'var(--color-purple-600)',
    },
  ];

  const handleQuickLogin = async (persona) => {
    setError('');
    setLoadingPersona(persona.id);
    try {
      await login(persona.email, persona.password);
    } catch (err) {
      setError(err.message || `Failed to sign in as ${persona.name}`);
    } finally {
      setLoadingPersona(null);
    }
  };

  return (
    <div className="auth-landing-container" role="region" aria-label="Authentication Required Portal">
      {/* Top Banner Notice */}
      <div className="auth-gate-notice">
        <Lock size={18} className="gate-lock-icon" />
        <div className="gate-notice-text">
          <strong>Authentication Required:</strong> All documents, metrics, and audit trails are encrypted and protected under Zero-Trust access control. Sign in with your corporate account or select an evaluation persona below.
        </div>
      </div>

      {/* Hero Section */}
      <div className="auth-landing-hero">
        <div className="hero-shield-pill">
          <ShieldCheck size={16} />
          <span>Zero-Trust Enterprise Vault</span>
        </div>
        <h1 className="hero-main-title">
          Secure Document Collaboration & Auditable Access Control
        </h1>
        <p className="hero-subtext">
          TrustVault protects high-stakes enterprise records with per-document ACL permissions, immediate zero-lag revocation, and an append-only cryptographic audit ledger.
        </p>

        {error && (
          <div className="landing-error-banner" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="hero-action-row">
          <Button 
            variant="primary" 
            size="lg" 
            onClick={onOpenLogin}
            icon={LogIn}
          >
            Sign In with Email
          </Button>
          <Button 
            variant="secondary" 
            size="lg" 
            onClick={onOpenRegister}
            icon={UserPlus}
          >
            Create New Account
          </Button>
        </div>
      </div>

      {/* Quick Evaluation Personas */}
      <div className="personas-section">
        <div className="section-label-group">
          <span className="section-eyebrow">ONE-CLICK EVALUATION PERSONAS</span>
          <h2 className="section-heading">Experience TrustVault by Role</h2>
          <p className="section-subtext">
            Choose a pre-configured persona to test role-based access control, file ownership, and administrative governance instantly.
          </p>
        </div>

        <div className="personas-grid">
          {personas.map((p) => {
            const Icon = p.icon;
            const isLoading = loadingPersona === p.id;

            return (
              <div key={p.id} className="persona-card">
                <div className="persona-card-header">
                  <div className="persona-avatar-wrap">
                    <Icon size={20} />
                  </div>
                  <span className={`persona-role-badge ${p.roleBadgeClass}`}>
                    {p.role}
                  </span>
                </div>

                <div className="persona-meta">
                  <h3 className="persona-name">{p.name}</h3>
                  <span className="persona-title">{p.title}</span>
                  <code className="persona-email">{p.email}</code>
                </div>

                <p className="persona-desc">{p.description}</p>

                <div className="persona-card-footer">
                  <button
                    type="button"
                    className="persona-signin-btn"
                    onClick={() => handleQuickLogin(p)}
                    disabled={isLoading || loadingPersona !== null}
                    aria-label={`Sign in as ${p.name}`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={16} className="spinner" />
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In as {p.role}</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Security Principles Highlights */}
      <div className="security-guarantees-grid">
        <div className="guarantee-item">
          <div className="guarantee-icon"><Lock size={18} /></div>
          <div>
            <h4>Isolated Private Storage</h4>
            <p>Files are stored outside web roots with UUID aliases. Zero direct static exposure.</p>
          </div>
        </div>
        <div className="guarantee-item">
          <div className="guarantee-icon"><UserCheck size={18} /></div>
          <div>
            <h4>Per-Document Granular ACLs</h4>
            <p>Owners grant fine-grained Read/Edit access with immediate per-stream revocation.</p>
          </div>
        </div>
        <div className="guarantee-item">
          <div className="guarantee-icon"><Activity size={18} /></div>
          <div>
            <h4>Immutable Audit Ledger</h4>
            <p>Append-only audit trail records all reads, downloads, grants, and revocations.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
