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
  Key,
  Send,
  HelpCircle,
  UserCog
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import './AuthLandingPortal.css';

export function AuthLandingPortal({ initialMode = 'login' }) {
  const { login, register, verifyEmailToken } = useAuth();
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'forgot' | 'reset' | 'resend' | 'verify-pending'
  const [recoveryOption, setRecoveryOption] = useState('email'); // 'email' (Option B) | 'admin' (Option A)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [requestedRole, setRequestedRole] = useState('viewer'); // 'viewer' | 'owner'
  const [error, setError] = useState('');
  const [errorAction, setErrorAction] = useState(null);
  const [resetSuccess, setResetSuccess] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotNotice, setForgotNotice] = useState('');
  const [resendNotice, setResendNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [devVerifyUrl, setDevVerifyUrl] = useState('');
  const [devResetUrl, setDevResetUrl] = useState('');

  // Check URL parameters on mount for ?verifyToken=... or ?resetToken=...
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const verifyTokenParam = params.get('verifyToken') || (params.get('mode') === 'verify' ? params.get('token') : null);
      const resetTokenParam = params.get('resetToken') || params.get('token');

      if (verifyTokenParam) {
        setVerifyingEmail(true);
        verifyEmailToken(verifyTokenParam, false)
          .then((res) => {
            setResetSuccess('Email address verified successfully! Your account is active. Please sign in with your credentials.');
            if (res.user?.email) {
              setEmail(res.user.email);
            }
            setMode('login');
          })
          .catch((err) => {
            setError(err.message || 'Verification link is invalid or has expired.');
            setMode('resend');
          })
          .finally(() => {
            setVerifyingEmail(false);
            // Clean URL without page reload
            window.history.replaceState({}, document.title, window.location.pathname);
          });
      } else if (resetTokenParam) {
        setResetToken(resetTokenParam);
        setMode('reset');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setErrorAction(null);
    setResetSuccess('');
    setForgotNotice('');
    setResendNotice('');

    // ── Resend Verification Email ───────────────────────────────────────────
    if (mode === 'resend') {
      if (!email.trim()) {
        setError('Please provide your registered work email address.');
        return;
      }
      setLoading(true);
      try {
        const response = await fetch('http://localhost:5000/api/auth/resend-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = await response.json();
        setResendNotice(
          data.message || 'If an unverified account exists with this email address, a new verification link has been sent.'
        );
        if (data.devVerifyUrl) {
          setDevVerifyUrl(data.devVerifyUrl);
        }
      } catch {
        setError('Network error submitting resend request. Please verify your connection.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Forgot Password (Dual-Option) ───────────────────────────────────────
    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Please provide your registered work email address.');
        return;
      }
      setLoading(true);
      try {
        const endpoint = recoveryOption === 'email'
          ? 'http://localhost:5000/api/auth/forgot-password-email'
          : 'http://localhost:5000/api/auth/forgot-password';

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = await response.json();
        setForgotSubmitted(true);
        if (data.devResetUrl) {
          setDevResetUrl(data.devResetUrl);
        }
        setForgotNotice(
          data.message ||
            (recoveryOption === 'email'
              ? 'If an account exists with this email address, a password reset link has been sent to your inbox.'
              : 'If this email address is registered, your password reset request has been submitted to an Administrator for review.')
        );
      } catch {
        setError('Network error submitting recovery request. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Reset Password with Single-Use Token ────────────────────────────────
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

    // ── Login and Registration ──────────────────────────────────────────────
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
        const regResult = await register(name.trim(), email.trim(), password, requestedRole);
        if (regResult.isEmailVerified === false) {
          setUnverifiedEmail(email.trim());
          if (regResult.devVerifyUrl) {
            setDevVerifyUrl(regResult.devVerifyUrl);
          }
          setForgotNotice(
            regResult.message ||
              'Account registered! Please check your inbox to verify your email address before signing in.'
          );
          setMode('verify-pending');
        }
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED' || /verify your email/i.test(err.message)) {
        setError('Your email address is not yet verified. Please check your inbox or request a new verification link.');
        setErrorAction({
          label: 'Resend Verification Email',
          onClick: () => {
            switchMode('resend');
          },
        });
      } else {
        setError(err.message || 'Authentication failed. Please verify your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setErrorAction(null);
    setResetSuccess('');
    setForgotSubmitted(false);
    setForgotNotice('');
    setResendNotice('');
    setDevVerifyUrl('');
    setDevResetUrl('');
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
            <span>Enterprise Document Management • Verified Zero-Trust Protocol</span>
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
                {verifyingEmail
                  ? 'Verifying Email Address...'
                  : mode === 'login'
                    ? 'Sign in to your vault'
                    : mode === 'register'
                      ? 'Create corporate account'
                      : mode === 'verify-pending'
                        ? 'Verify Your Email'
                        : mode === 'resend'
                          ? 'Resend Verification Link'
                          : mode === 'forgot'
                            ? 'Recover Account Access'
                            : 'Reset Account Password'}
              </h2>
              <p className="auth-card-subtitle">
                {verifyingEmail
                  ? 'Connecting to security server to validate your single-use verification token...'
                  : mode === 'login'
                    ? 'Enter your corporate credentials to access confidential documents.'
                    : mode === 'register'
                      ? 'New accounts are provisioned with Viewer privileges under organizational security policy.'
                      : mode === 'verify-pending'
                        ? 'Please verify your work email address to activate your vault access.'
                        : mode === 'resend'
                          ? 'Enter your registered work email to receive a fresh verification link.'
                          : mode === 'forgot'
                            ? 'Choose your preferred recovery method below.'
                            : 'Enter your single-use recovery token and set a new password.'}
              </p>
            </div>

            {verifyingEmail && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <Loader2 size={32} className="spinner text-primary" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Validating email token...</p>
              </div>
            )}

            {error && (
              <div className="auth-error-banner" role="alert" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} className="error-icon" aria-hidden="true" />
                  <span>{error}</span>
                </div>
                {errorAction && (
                  <button
                    type="button"
                    onClick={errorAction.onClick}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary-700, #1d4ed8)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline',
                      marginTop: '4px',
                    }}
                  >
                    {errorAction.label} &rarr;
                  </button>
                )}
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

            {/* ── Mode: Verification Pending Notice ─────────────────────────── */}
            {mode === 'verify-pending' && (
              <div className="verify-pending-card" role="status">
                <div className="verify-pending-title">
                  <Mail size={18} className="text-success" />
                  <span>Verification Email Dispatched</span>
                </div>
                <p className="verify-pending-body">
                  We sent an email verification link to <span className="verify-email-highlight">{unverifiedEmail || email}</span>.
                </p>
                <p className="verify-pending-body" style={{ fontSize: '12px', color: '#15803d' }}>
                  Please check your inbox (and spam or junk folder) and click the link to activate your account.
                </p>



                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    className="resend-box-link"
                    onClick={() => switchMode('resend')}
                  >
                    Didn&apos;t receive the email? Resend verification link &rarr;
                  </button>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => switchMode('login')}
                    style={{ width: '100%' }}
                  >
                    Return to Sign In
                  </Button>
                </div>
              </div>
            )}

            {/* ── Mode: Resend Verification Confirmation ───────────────────── */}
            {mode === 'resend' && resendNotice && (
              <div className="auth-success-box verify-pending-card" role="status">
                <div className="verify-pending-title">
                  <CheckCircle2 size={18} className="text-success" />
                  <span>Verification Link Sent</span>
                </div>
                <p className="verify-pending-body">{resendNotice}</p>



                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => switchMode('login')}
                  style={{ width: '100%', marginTop: '6px' }}
                >
                  Back to Sign In
                </Button>
              </div>
            )}

            {/* ── Form Render ─────────────────────────────────────────────── */}
            {!verifyingEmail && mode !== 'verify-pending' && !(mode === 'resend' && resendNotice) && !(mode === 'forgot' && forgotSubmitted) && (
              <form onSubmit={handleSubmit} className="auth-form" noValidate>
                {/* Dual-Option Tabs on Forgot Password Screen */}
                {mode === 'forgot' && (
                  <>
                    <div className="recovery-options-tabs" role="tablist" aria-label="Password Recovery Options">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={recoveryOption === 'email'}
                        className={`recovery-tab-btn ${recoveryOption === 'email' ? 'active' : ''}`}
                        onClick={() => setRecoveryOption('email')}
                      >
                        <Mail size={14} />
                        <span>Email Reset Link</span>
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={recoveryOption === 'admin'}
                        className={`recovery-tab-btn ${recoveryOption === 'admin' ? 'active' : ''}`}
                        onClick={() => setRecoveryOption('admin')}
                      >
                        <UserCog size={14} />
                        <span>Admin Assisted</span>
                      </button>
                    </div>

                    <div className="recovery-info-callout">
                      {recoveryOption === 'email' ? (
                        <>
                          <strong>Option B — Self-Service Email Link:</strong> We will send a single-use password reset link to your email. You can choose a new password directly (link valid for 15 minutes).
                        </>
                      ) : (
                        <>
                          <strong>Option A — Administrator Reset:</strong> An Administrator will review your account and assign a temporary password (<code>Password@123</code>). You will be required to change it on next login.
                        </>
                      )}
                    </div>
                  </>
                )}

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
                          autoFocus={mode === 'login' || mode === 'forgot' || mode === 'resend'}
                        />
                      </div>
                    </div>

                    {mode !== 'forgot' && mode !== 'resend' && (
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
                              onClick={() => switchMode('resend')}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted, #94a3b8)',
                                fontSize: '11px',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              Verify email / Resend?
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
                                <span className="type-card-badge badge-viewer">Standard Access</span>
                              </div>
                              <p className="type-card-desc">
                                Read documents shared with you. Ready upon email verification.
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
                                Upload confidential files and manage collaborator ACLs. Requires Admin approval.
                              </p>
                            </div>
                          </label>
                        </div>
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
                          : mode === 'resend'
                            ? 'Sending verification...'
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
                          : mode === 'resend'
                            ? 'Send Verification Email'
                            : mode === 'forgot'
                              ? (recoveryOption === 'email' ? 'Send Password Reset Link' : 'Request Reset from Admin')
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

            {/* ── Mode Switching Links ────────────────────────────────────── */}
            <div className="auth-switch-container">
              {mode === 'forgot' || mode === 'resend' || mode === 'reset' ? (
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

            {/* ── Evaluator Demo Roles Stack ──────────────────────────────── */}
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
