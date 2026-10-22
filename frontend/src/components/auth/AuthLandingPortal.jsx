import React, { useState, useEffect } from 'react';
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
  CheckCircle2,
  Key
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import './AuthLandingPortal.css';

export function AuthLandingPortal({ initialMode = 'login' }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'reset'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [requestedRole, setRequestedRole] = useState('viewer'); // 'viewer' | 'owner'
  const [error, setError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotNotice, setForgotNotice] = useState('');
  const [loading, setLoading] = useState(false);

  // Check URL parameters for single-use reset token (?token=...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tokenParam = params.get('token');
      if (tokenParam) {
        setResetToken(tokenParam);
        setMode('reset');
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResetSuccess('');

    // Handle Forgot Password mode (Requirement 2: Send Request to Admin)
    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Please provide your registered work email address.');
        return;
      }
      setLoading(true);
      try {
        const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = await response.json();
        setForgotSubmitted(true);
        setForgotNotice(
          data.message ||
            'If this email address is registered, your password reset request has been submitted to an Administrator for review.'
        );
      } catch {
        setError('Network error submitting password reset request to administrator.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Handle Reset Password mode
    if (mode === 'reset') {
      if (!resetToken.trim()) {
        setError('Please provide your single-use recovery token.');
        return;
      }
      if (!password || password.length < 8) {
        setError('New password must be at least 8 characters long.');
        return;
      }
      if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) {
        setError('New password must contain at least one letter and one number.');
        return;
      }
      if (password !== confirmPassword) {
        setError('New password and confirmation password do not match.');
        return;
      }

      setLoading(true);
      try {
        const response = await fetch('http://localhost:5000/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: resetToken.trim(),
            newPassword: password,
            confirmPassword: confirmPassword,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to reset password.');
        }

        setResetSuccess('Password successfully updated. You may now sign in with your new credentials.');
        setPassword('');
        setConfirmPassword('');
        setResetToken('');
        setMode('login');
      } catch (err) {
        setError(err.message || 'Failed to reset password. Token may be invalid or expired.');
      } finally {
        setLoading(false);
      }
      return;
    }

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
        await register(name.trim(), email.trim(), password, requestedRole);
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
    setResetSuccess('');
    setForgotSubmitted(false);
    setForgotNotice('');
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
                {mode === 'login'
                  ? 'Sign in to your vault'
                  : mode === 'register'
                    ? 'Create corporate account'
                    : mode === 'forgot'
                      ? 'Forgot Password?'
                      : 'Reset Account Password'}
              </h2>
              <p className="auth-card-subtitle">
                {mode === 'login'
                  ? 'Enter your corporate credentials to access confidential documents.'
                  : mode === 'register'
                    ? 'New accounts are provisioned with Viewer privileges under organizational security policy.'
                    : mode === 'forgot'
                      ? 'Enter your registered work email to request a password reset from an Administrator.'
                      : 'Enter your single-use recovery token and set a new password.'}
              </p>
            </div>

            {error && (
              <div className="auth-error-banner" role="alert">
                <AlertCircle size={16} className="error-icon" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {resetSuccess && (
              <div 
                className="auth-success-banner" 
                role="status" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '10px 14px', 
                  backgroundColor: '#f0fdf4', 
                  border: '1px solid #bbf7d0', 
                  color: '#166534', 
                  borderRadius: '6px', 
                  fontSize: '13px', 
                  marginBottom: '14px' 
                }}
              >
                <CheckCircle2 size={16} />
                <span>{resetSuccess}</span>
              </div>
            )}

            {mode === 'forgot' && forgotSubmitted ? (
              <div 
                className="auth-success-box"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '10px',
                  padding: '18px',
                  marginBottom: '16px',
                  color: '#166534',
                }}
                role="status"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px' }}>
                  <CheckCircle2 size={18} className="text-success" />
                  <span>Request Submitted to Administrator</span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: '#14532d' }}>
                  {forgotNotice}
                </p>
                <div style={{ marginTop: '6px' }}>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => switchMode('login')}
                    style={{ width: '100%' }}
                  >
                    Back to Sign In
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="auth-form" noValidate>
              {mode === 'reset' ? (
                <>
                  <div className="form-group">
                    <label htmlFor="portal-reset-token" className="form-label">
                      Single-Use Recovery Token <span className="required-star">*</span>
                    </label>
                    <div className="input-with-icon">
                      <Key size={16} className="field-icon" aria-hidden="true" />
                      <input
                        id="portal-reset-token"
                        type="text"
                        required
                        placeholder="Paste single-use recovery token..."
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        className="form-input"
                        disabled={loading}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <div className="label-row">
                      <label htmlFor="portal-new-password" className="form-label">
                        New Password <span className="required-star">*</span>
                      </label>
                      <span className="label-hint">Min 8 chars (letters & numbers)</span>
                    </div>
                    <div className="input-with-icon">
                      <Lock size={16} className="field-icon" aria-hidden="true" />
                      <input
                        id="portal-new-password"
                        type="password"
                        required
                        placeholder="Enter new password..."
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="form-input"
                        disabled={loading}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="portal-confirm-password" className="form-label">
                      Confirm New Password <span className="required-star">*</span>
                    </label>
                    <div className="input-with-icon">
                      <Lock size={16} className="field-icon" aria-hidden="true" />
                      <input
                        id="portal-confirm-password"
                        type="password"
                        required
                        placeholder="Re-enter new password..."
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="form-input"
                        disabled={loading}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
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
                        autoFocus={mode === 'login' || mode === 'forgot'}
                      />
                    </div>
                  </div>

                  {mode !== 'forgot' && (
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
                      {mode === 'login' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                          <button
                            type="button"
                            onClick={() => switchMode('forgot')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-primary-600)',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            Forgot Password?
                          </button>
                          <button
                            type="button"
                            onClick={() => switchMode('reset')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted, #94a3b8)',
                              fontSize: '11px',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            Have recovery token?
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {mode === 'register' && (
                    <div className="form-group role-selector-group">
                      <label className="form-label">
                        Requested Account Type <span className="required-star">*</span>
                      </label>
                      <div className="account-type-options" role="radiogroup" aria-label="Requested Account Type">
                        <label className={`account-type-card ${requestedRole === 'viewer' ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name="requestedRole"
                            value="viewer"
                            checked={requestedRole === 'viewer'}
                            onChange={() => setRequestedRole('viewer')}
                            className="sr-only"
                          />
                          <div className="type-card-content">
                            <div className="type-card-header">
                              <span className="type-card-title">Viewer</span>
                              <span className="type-card-badge badge-viewer">Immediate Access</span>
                            </div>
                            <p className="type-card-desc">
                              Standard read-only access to documents shared with you. Ready immediately upon registration.
                            </p>
                          </div>
                        </label>

                        <label className={`account-type-card ${requestedRole === 'owner' ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name="requestedRole"
                            value="owner"
                            checked={requestedRole === 'owner'}
                            onChange={() => setRequestedRole('owner')}
                            className="sr-only"
                          />
                          <div className="type-card-content">
                            <div className="type-card-header">
                              <span className="type-card-title">Document Owner</span>
                              <span className="type-card-badge badge-owner">Requires Approval</span>
                            </div>
                            <p className="type-card-desc">
                              Upload confidential documents and manage collaborator ACLs. Requires Administrator approval before upload rights are activated.
                            </p>
                          </div>
                        </label>
                      </div>
                      <p className="account-type-notice">
                        <Shield size={12} className="notice-icon" aria-hidden="true" />
                        <span>
                          {requestedRole === 'owner'
                            ? 'Your account will be provisioned immediately as a Viewer while your Owner request is queued for Administrator review.'
                            : 'You can request Owner privileges at any time after registration through an Administrator.'}
                        </span>
                      </p>
                    </div>
                  )}
                </>
              )}

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
                    <span>
                      {mode === 'reset'
                        ? 'Updating password...'
                        : mode === 'forgot'
                          ? 'Submitting request...'
                          : mode === 'login'
                            ? 'Authenticating...'
                            : 'Provisioning account...'}
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      {mode === 'reset'
                        ? 'Set New Password'
                        : mode === 'forgot'
                          ? 'Send Request to Admin'
                          : mode === 'login'
                            ? 'Sign In to Vault'
                            : 'Create Account'}
                    </span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </>
                )}
              </Button>
            </form>
            )}

            <div className="auth-switch-container">
              {mode === 'forgot' ? (
                <p className="auth-switch-text">
                  Remember your password?{' '}
                  <button
                    type="button"
                    className="auth-switch-link"
                    onClick={() => switchMode('login')}
                  >
                    Back to Sign in
                  </button>
                </p>
              ) : mode === 'reset' ? (
                <p className="auth-switch-text">
                  Remember your credentials?{' '}
                  <button
                    type="button"
                    className="auth-switch-link"
                    onClick={() => switchMode('login')}
                  >
                    Back to Sign in
                  </button>
                </p>
              ) : mode === 'login' ? (
                <p className="auth-switch-text">
                  Don&apos;t have an account?{' '}
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

            {mode === 'login' && (
              <div className="demo-accounts-container" aria-label="Quick Demo Accounts Selection for Evaluators">
                <div className="demo-divider-row">
                  <span className="demo-divider-text">OR EVALUATE WITH VERIFIED DEMO ROLES</span>
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

                  {/* Pending Owner Request Demo */}
                  <button
                    type="button"
                    className="demo-account-card demo-card-pending"
                    onClick={() => {
                      setEmail('jordan.req@trustvault.internal');
                      setPassword('TrustVault2026!');
                      setError('');
                    }}
                    title="Fill Pending Owner Request demo credentials"
                  >
                    <div className="demo-card-header">
                      <span className="demo-badge demo-badge-pending">Pending Owner Request</span>
                      <span className="demo-email-text">jordan.req@trustvault.internal</span>
                    </div>
                    <div className="demo-card-capabilities">
                      Viewer account with an active Owner approval request queued for Admin governance.
                    </div>
                  </button>
                </div>
                <p className="demo-helper-note">
                  Selecting a role fills credentials into the form. Click &quot;Sign In to Vault&quot; to verify with the backend.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
