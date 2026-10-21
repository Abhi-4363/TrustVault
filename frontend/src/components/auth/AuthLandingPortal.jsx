import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  User, 
  Shield, 
  FileText, 
  Activity, 
  ArrowRight, 
  AlertCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import './AuthLandingPortal.css';

export function AuthLandingPortal({ initialMode = 'login' }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please provide both your work email and password.');
      return;
    }

    if (mode === 'register') {
      if (!name.trim() || name.trim().length < 2) {
        setError('Full name is required (minimum 2 characters).');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) {
        setError('Password must contain at least one letter and one number.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        await register(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
  };

  return (
    <div className="auth-portal-page" role="region" aria-label="TrustVault Authentication Portal">
      <div className="auth-portal-wrapper">
        
        {/* Left Column: Enterprise Security Overview */}
        <div className="auth-portal-info">
          <div className="auth-brand-pill">
            <ShieldCheck size={16} className="brand-pill-icon" aria-hidden="true" />
            <span>Zero-Trust Enterprise Vault</span>
          </div>

          <h1 className="auth-hero-title">
            Secure Document Collaboration & Auditable Access Control
          </h1>

          <p className="auth-hero-desc">
            TrustVault safeguards confidential organizational records with per-document ACL permissions, zero-lag immediate revocation, and an append-only audit trail.
          </p>

          <div className="auth-features-list">
            <div className="auth-feature-item">
              <div className="feature-icon-box">
                <Lock size={18} aria-hidden="true" />
              </div>
              <div className="feature-text">
                <span className="feature-title">Isolated Private Storage</span>
                <span className="feature-desc">Document binaries are quarantined outside public web roots with randomized UUID storage keys.</span>
              </div>
            </div>

            <div className="auth-feature-item">
              <div className="feature-icon-box">
                <FileText size={18} aria-hidden="true" />
              </div>
              <div className="feature-text">
                <span className="feature-title">Granular Per-Document ACLs</span>
                <span className="feature-desc">Owners grant explicit Read or Edit access to named collaborators with live database-level validation.</span>
              </div>
            </div>

            <div className="auth-feature-item">
              <div className="feature-icon-box">
                <Activity size={18} aria-hidden="true" />
              </div>
              <div className="feature-text">
                <span className="feature-title">Immutable Audit Trail</span>
                <span className="feature-desc">Append-only compliance logging records every read, stream download, modification, and refused attempt.</span>
              </div>
            </div>
          </div>

          <div className="auth-compliance-footer">
            <Shield size={14} className="compliance-shield" aria-hidden="true" />
            <span>Snovasys Fresher Challenge 2026 • Verified Zero-Trust Protocol</span>
          </div>
        </div>

        {/* Right Column: Public Sign-In / Registration Form */}
        <div className="auth-portal-form-container">
          <div className="auth-card">
            <div className="auth-card-header">
              <div className="auth-card-brand">
                <ShieldCheck size={20} className="auth-card-logo" aria-hidden="true" />
                <span className="auth-card-brand-name">TrustVault</span>
              </div>
              <h2 className="auth-card-title">
                {mode === 'login' ? 'Sign in to your vault' : 'Create corporate account'}
              </h2>
              <p className="auth-card-subtitle">
                {mode === 'login'
                  ? 'Enter your corporate credentials to access confidential documents.'
                  : 'New accounts are provisioned with Viewer privileges under organizational security policy.'}
              </p>
            </div>

            {error && (
              <div className="auth-error-banner" role="alert">
                <AlertCircle size={16} className="error-icon" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              {mode === 'register' && (
                <div className="form-group">
                  <label htmlFor="portal-name" className="form-label">
                    Full Name <span className="required-star">*</span>
                  </label>
                  <div className="input-with-icon">
                    <User size={16} className="field-icon" aria-hidden="true" />
                    <input
                      id="portal-name"
                      type="text"
                      required
                      placeholder="e.g. Alex Mercer"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="form-input"
                      disabled={loading}
                      autoComplete="name"
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="portal-email" className="form-label">
                  Work Email Address <span className="required-star">*</span>
                </label>
                <div className="input-with-icon">
                  <Mail size={16} className="field-icon" aria-hidden="true" />
                  <input
                    id="portal-email"
                    type="email"
                    required
                    placeholder="name@trustvault.internal"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input"
                    disabled={loading}
                    autoComplete="email"
                    autoFocus={mode === 'login'}
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="label-row">
                  <label htmlFor="portal-password" className="form-label">
                    Password <span className="required-star">*</span>
                  </label>
                  {mode === 'register' && (
                    <span className="label-hint">Min 8 chars (letters & numbers)</span>
                  )}
                </div>
                <div className="input-with-icon">
                  <Lock size={16} className="field-icon" aria-hidden="true" />
                  <input
                    id="portal-password"
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                    disabled={loading}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="auth-submit-button"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spinner" aria-hidden="true" />
                    <span>{mode === 'login' ? 'Authenticating...' : 'Provisioning account...'}</span>
                  </>
                ) : (
                  <>
                    <span>{mode === 'login' ? 'Sign In to Vault' : 'Create Account'}</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </>
                )}
              </Button>
            </form>

            {mode === 'login' && (
              <div className="demo-accounts-container" aria-label="Quick Demo Accounts Selection">
                <div className="demo-divider-row">
                  <span className="demo-divider-text">Or evaluate with verified demo roles</span>
                </div>
                <div className="demo-cards-stack">
                  {/* Administrator Demo */}
                  <button
                    type="button"
                    className="demo-account-card demo-card-admin"
                    onClick={() => {
                      setEmail('admin@trustvault.internal');
                      setPassword('TrustVault2026!');
                      setError('');
                    }}
                    title="Fill Administrator demo credentials"
                  >
                    <div className="demo-card-header">
                      <span className="demo-badge demo-badge-admin">Administrator</span>
                      <span className="demo-email-text">admin@trustvault.internal</span>
                    </div>
                    <div className="demo-card-capabilities">
                      Identity governance, tenant role assignment, system analytics, and tamper-resistant audit logs.
                    </div>
                  </button>

                  {/* Document Owner Demo */}
                  <button
                    type="button"
                    className="demo-account-card demo-card-owner"
                    onClick={() => {
                      setEmail('sarah.lead@trustvault.internal');
                      setPassword('TrustVault2026!');
                      setError('');
                    }}
                    title="Fill Document Owner demo credentials"
                  >
                    <div className="demo-card-header">
                      <span className="demo-badge demo-badge-owner">Document Owner</span>
                      <span className="demo-email-text">sarah.lead@trustvault.internal</span>
                    </div>
                    <div className="demo-card-capabilities">
                      Upload and manage files, delegate Read/Edit ACL permissions to named peers, and revoke access instantly.
                    </div>
                  </button>

                  {/* Viewer Demo */}
                  <button
                    type="button"
                    className="demo-account-card demo-card-viewer"
                    onClick={() => {
                      setEmail('alex.dev@trustvault.internal');
                      setPassword('TrustVault2026!');
                      setError('');
                    }}
                    title="Fill Viewer demo credentials"
                  >
                    <div className="demo-card-header">
                      <span className="demo-badge demo-badge-viewer">Viewer</span>
                      <span className="demo-email-text">alex.dev@trustvault.internal</span>
                    </div>
                    <div className="demo-card-capabilities">
                      Collaborate and inspect files shared with you. Restricted from uploading or deleting files.
                    </div>
                  </button>
                </div>
                <p className="demo-helper-note">
                  Selecting a role fills credentials into the form. Click &quot;Sign In to Vault&quot; to verify with the backend.
                </p>
              </div>
            )}

            <div className="auth-card-footer">
              {mode === 'login' ? (
                <p className="auth-switch-text">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    className="auth-switch-link"
                    onClick={() => switchMode('register')}
                  >
                    Create account
                  </button>
                </p>
              ) : (
                <p className="auth-switch-text">
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="auth-switch-link"
                    onClick={() => switchMode('login')}
                  >
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
