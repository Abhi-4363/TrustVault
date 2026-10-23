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
  UserCog,
  Calendar,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import TermsAndPrivacyModals from '../legal/TermsAndPrivacyModals';
import { buildApiUrl } from '../../config/api';
import './AuthLandingPortal.css';

export function AuthLandingPortal({ initialMode = 'login', onModeChange }) {
  const { login, register, verifyEmailToken } = useAuth();
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'forgot' | 'reset' | 'resend' | 'verify-pending'
  const [recoveryOption, setRecoveryOption] = useState('email'); // 'email' (Option B) | 'admin' (Option A)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalType, setLegalModalType] = useState('terms'); // 'terms' | 'privacy'
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
  const [emailDeliveryFailed, setEmailDeliveryFailed] = useState(false);

  // Synchronize internal mode whenever initialMode prop updates
  useEffect(() => {
    if (initialMode && (initialMode === 'login' || initialMode === 'register')) {
      setMode(initialMode);
      setError('');
      setErrorAction(null);
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [initialMode]);

  const getTodayMaxDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const calculateAge = (dobString) => {
    if (!dobString) return null;
    const parts = dobString.split('-').map(Number);
    if (parts.length !== 3) return null;
    const [year, month, day] = parts;
    const birthDate = new Date(year, month - 1, day);
    if (
      birthDate.getFullYear() !== year ||
      birthDate.getMonth() !== month - 1 ||
      birthDate.getDate() !== day
    ) {
      return null;
    }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (birthDate > today) return -1;
    let age = now.getFullYear() - year;
    const m = now.getMonth() - (month - 1);
    if (m < 0 || (m === 0 && now.getDate() < day)) {
      age--;
    }
    return age;
  };

  const openLegalModal = (type) => {
    setLegalModalType(type);
    setLegalModalOpen(true);
  };

  // Check URL parameters on mount for ?verifyToken=..., ?resetToken=..., or ?mode=...
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const verifyTokenParam = params.get('verifyToken') || (params.get('mode') === 'verify' ? params.get('token') : null);
      const resetTokenParam = params.get('resetToken') || params.get('token');
      const modeParam = params.get('mode');

      if (verifyTokenParam) {
        setVerifyingEmail(true);
        verifyEmailToken(verifyTokenParam, false)
          .then((res) => {
            setResetSuccess('Email address verified successfully! Your account is active. Please sign in with your credentials.');
            if (res.user?.email) {
              setEmail(res.user.email);
            }
            setMode('login');
            onModeChange?.('login');
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
      } else if (modeParam === 'register' || window.location.hash === '#register') {
        setMode('register');
        onModeChange?.('register');
      } else if (modeParam === 'login' || window.location.hash === '#login') {
        setMode('login');
        onModeChange?.('login');
      }
    } catch {
      // Ignore URL parsing errors
    }

    const handleUrlChange = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const modeParam = params.get('mode');
        if (modeParam === 'register' || window.location.hash === '#register') {
          setMode('register');
          onModeChange?.('register');
        } else if (modeParam === 'login' || window.location.hash === '#login') {
          setMode('login');
          onModeChange?.('login');
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
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
        const response = await fetch(buildApiUrl('/auth/resend-verification'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error?.message || data.message || 'Failed to submit resend verification request.');
        }
        setResendNotice(
          data.message || 'If an unverified account exists with this email address, a new verification link has been sent.'
        );
        if (data.devVerifyUrl) {
          setDevVerifyUrl(data.devVerifyUrl);
        }
      } catch (err) {
        setError(err.message || 'Network error submitting resend request. Please verify your connection.');
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
          ? buildApiUrl('/auth/forgot-password-email')
          : buildApiUrl('/auth/forgot-password');

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error?.message || data.message || 'Failed to submit recovery request.');
        }
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
      } catch (err) {
        setError(err.message || 'Network error submitting recovery request. Please try again.');
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
        const response = await fetch(buildApiUrl('/auth/reset-password'), {
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
      if (name.trim().length > 50) {
        setError('Full name cannot exceed 50 characters.');
        return;
      }
      if (/[<>]/.test(name.trim())) {
        setError('Full name contains invalid characters.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError('Please provide a valid work email address.');
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
      if (password !== confirmPassword) {
        setError('Password and confirmation password do not match.');
        return;
      }
      if (!dateOfBirth) {
        setError('Date of birth is required.');
        return;
      }
      const age = calculateAge(dateOfBirth);
      if (age === -1) {
        setError('Date of birth cannot be in the future.');
        return;
      }
      if (age === null || isNaN(age)) {
        setError('Please provide a valid calendar date of birth.');
        return;
      }
      if (age < 13) {
        setError('You must be at least 13 years old to register for TrustVault.');
        return;
      }
      if (!termsAccepted) {
        setError('You must agree to the Terms & Conditions and acknowledge the Privacy Policy to create an account.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const regResult = await register({
          name: name.trim(),
          email: email.trim(),
          password,
          confirmPassword,
          dateOfBirth,
          termsAccepted: true,
          requestedRole,
        });
        if (regResult.isEmailVerified === false) {
          setUnverifiedEmail(email.trim());
          if (regResult.devVerifyUrl) {
            setDevVerifyUrl(regResult.devVerifyUrl);
          }
          const deliveryFailed = Boolean(regResult.emailDelivery && regResult.emailDelivery.sent === false);
          setEmailDeliveryFailed(deliveryFailed);
          setForgotNotice(
            regResult.message ||
              (deliveryFailed
                ? 'Account created, but verification email could not be delivered to your inbox (host blocked outbound SMTP). Please check your email configuration on Render or use Resend Verification.'
                : 'Account registered! Please check your inbox to verify your email address before signing in.')
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
    setEmailDeliveryFailed(false);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);

    if (onModeChange && (newMode === 'login' || newMode === 'register')) {
      onModeChange(newMode);
    }

    try {
      const url = new URL(window.location.href);
      if (newMode === 'register') {
        url.searchParams.set('mode', 'register');
      } else if (newMode === 'login') {
        url.searchParams.delete('mode');
      }
      window.history.replaceState({}, document.title, url.toString());
    } catch {
      // ignore
    }
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
                  {emailDeliveryFailed ? (
                    <AlertCircle size={18} style={{ color: '#d97706' }} />
                  ) : (
                    <Mail size={18} className="text-success" />
                  )}
                  <span>{emailDeliveryFailed ? 'Account Created — Email Delivery Blocked' : 'Verification Email Dispatched'}</span>
                </div>
                
                {emailDeliveryFailed ? (
                  <div style={{ background: 'rgba(217, 119, 6, 0.1)', border: '1px solid rgba(217, 119, 6, 0.3)', borderRadius: '8px', padding: '12px', margin: '8px 0' }}>
                    <p className="verify-pending-body" style={{ color: '#b45309', margin: 0, fontWeight: 500 }}>
                      Your TrustVault account was registered successfully, but outbound mail on port 587/465 is blocked by Render.
                    </p>
                    <p style={{ fontSize: '12px', color: '#92400e', marginTop: '6px', lineHeight: 1.4 }}>
                      To send verification emails on Render, add a <strong>RESEND_API_KEY</strong> or <strong>BREVO_API_KEY</strong> in your Render dashboard (transactional HTTPS over port 443).
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="verify-pending-body">
                      We sent an email verification link to <span className="verify-email-highlight">{unverifiedEmail || email}</span>.
                    </p>
                    <p className="verify-pending-body" style={{ fontSize: '12px', color: '#15803d' }}>
                      Please check your inbox (and spam or junk folder) and click the link to activate your account.
                    </p>
                  </>
                )}

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

            {/* ── Mode: Forgot Password Confirmation ──────────────────────── */}
            {mode === 'forgot' && forgotSubmitted && (
              <div className="auth-success-box verify-pending-card" role="status">
                <div className="verify-pending-title">
                  <CheckCircle2 size={18} className="text-success" />
                  <span>
                    {recoveryOption === 'email'
                      ? 'Password Reset Link Dispatched'
                      : 'Admin Recovery Request Submitted'}
                  </span>
                </div>
                <p className="verify-pending-body">{forgotNotice}</p>

                {devResetUrl && (
                  <div className="dev-verify-banner" style={{ marginTop: '8px', marginBottom: '8px' }}>
                    <div className="dev-verify-badge">Developer Local Testing Reset Link</div>
                    <a
                      href={devResetUrl}
                      className="dev-verify-link"
                      onClick={(e) => {
                        e.preventDefault();
                        try {
                          const urlObj = new URL(devResetUrl);
                          const tok = urlObj.searchParams.get('resetToken') || urlObj.searchParams.get('token');
                          if (tok) {
                            setResetToken(tok);
                            setMode('reset');
                            setForgotSubmitted(false);
                          }
                        } catch {
                          // fallback
                        }
                      }}
                    >
                      {devResetUrl}
                    </a>
                  </div>
                )}

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
                {/* Dual-Option Recovery Method Selector on Forgot Password Screen */}
                {mode === 'forgot' && (
                  <div className="recovery-selection-section" aria-label="Available Account Recovery Options">
                    <span className="recovery-section-label">Select Recovery Method</span>
                    
                    <div className="recovery-cards-grid" role="radiogroup" aria-label="Password Recovery Options">
                      <div
                        role="radio"
                        tabIndex={0}
                        aria-checked={recoveryOption === 'email'}
                        className={`recovery-choice-card ${recoveryOption === 'email' ? 'selected' : ''}`}
                        onClick={() => setRecoveryOption('email')}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            setRecoveryOption('email');
                          }
                        }}
                      >
                        <div className="recovery-card-radio">
                          <span className={`radio-dot ${recoveryOption === 'email' ? 'active' : ''}`} />
                        </div>
                        <div className="recovery-card-body">
                          <div className="recovery-card-header">
                            <div className="recovery-card-icon-box icon-email">
                              <Mail size={15} />
                            </div>
                            <div className="recovery-card-title-group">
                              <span className="recovery-card-title">Email Reset Link</span>
                              <span className="recovery-card-badge badge-instant">Instant • 15 Mins</span>
                            </div>
                          </div>
                          <p className="recovery-card-desc">
                            Direct self-service recovery. A single-use link is dispatched to your registered email to immediately set a new password.
                          </p>
                        </div>
                      </div>

                      <div
                        role="radio"
                        tabIndex={0}
                        aria-checked={recoveryOption === 'admin'}
                        className={`recovery-choice-card ${recoveryOption === 'admin' ? 'selected' : ''}`}
                        onClick={() => setRecoveryOption('admin')}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            setRecoveryOption('admin');
                          }
                        }}
                      >
                        <div className="recovery-card-radio">
                          <span className={`radio-dot ${recoveryOption === 'admin' ? 'active' : ''}`} />
                        </div>
                        <div className="recovery-card-body">
                          <div className="recovery-card-header">
                            <div className="recovery-card-icon-box icon-admin">
                              <UserCog size={15} />
                            </div>
                            <div className="recovery-card-title-group">
                              <span className="recovery-card-title">Admin Assisted</span>
                              <span className="recovery-card-badge badge-admin">Managed Reset</span>
                            </div>
                          </div>
                          <p className="recovery-card-desc">
                            Governance reset. An Administrator reviews your account identity and provisions a temporary password requiring change on first login.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
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

                    {mode === 'register' && (
                      <div className="form-group">
                        <div className="label-row">
                          <label htmlFor="portal-dob" className="form-label">
                            Date of Birth <span className="required-star">*</span>
                          </label>
                          <span className="label-hint">Minimum age: 13</span>
                        </div>
                        <div className="input-with-icon">
                          <Calendar size={16} className="field-icon" aria-hidden="true" />
                          <input
                            id="portal-dob"
                            type="date"
                            required
                            max={getTodayMaxDate()}
                            value={dateOfBirth}
                            onChange={(e) => setDateOfBirth(e.target.value)}
                            className="form-input"
                            disabled={loading}
                          />
                        </div>
                        <p className="field-subtext">
                          TrustVault requires users to be at least 13 years old to register.
                        </p>
                      </div>
                    )}

                    {mode !== 'forgot' && mode !== 'resend' && (
                      <>
                        <div className="form-group">
                          <div className="label-row">
                            <label htmlFor="portal-password" className="form-label">
                              Password <span className="required-star">*</span>
                            </label>
                            {mode === 'register' && (
                              <span className="label-hint">Min 8 chars (letters & numbers)</span>
                            )}
                          </div>
                          <div className="input-with-icon password-input-wrapper">
                            <Lock size={16} className="field-icon" aria-hidden="true" />
                            <input
                              id="portal-password"
                              type={showPassword ? 'text' : 'password'}
                              required
                              placeholder="••••••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="form-input"
                              disabled={loading}
                              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            />
                            <button
                              type="button"
                              className="password-toggle-btn"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                              tabIndex={-1}
                            >
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
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

                        {mode === 'register' && (
                          <>
                            <div className="form-group">
                              <label htmlFor="portal-confirm-password" className="form-label">
                                Confirm Password <span className="required-star">*</span>
                              </label>
                              <div className="input-with-icon password-input-wrapper">
                                <Lock size={16} className="field-icon" aria-hidden="true" />
                                <input
                                  id="portal-confirm-password"
                                  type={showConfirmPassword ? 'text' : 'password'}
                                  required
                                  placeholder="Re-enter your password..."
                                  value={confirmPassword}
                                  onChange={(e) => setConfirmPassword(e.target.value)}
                                  className="form-input"
                                  disabled={loading}
                                  autoComplete="new-password"
                                />
                                <button
                                  type="button"
                                  className="password-toggle-btn"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                                  tabIndex={-1}
                                >
                                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                              </div>
                            </div>

                            <div className="password-rules-callout" aria-live="polite">
                              <span className="password-rules-title">Password requirements:</span>
                              <div className="password-rules-grid">
                                <span className={`rule-chip ${password.length >= 8 ? 'met' : ''}`}>
                                  {password.length >= 8 ? '✓' : '•'} 8+ characters
                                </span>
                                <span className={`rule-chip ${/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password) ? 'met' : ''}`}>
                                  {/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password) ? '✓' : '•'} Letters &amp; numbers
                                </span>
                                <span className={`rule-chip ${confirmPassword && password === confirmPassword ? 'met' : ''}`}>
                                  {confirmPassword && password === confirmPassword ? '✓' : '•'} Passwords match
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {mode === 'register' && (
                      <>
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

                        <div className="form-group terms-checkbox-group">
                          <label className="terms-checkbox-label" htmlFor="portal-terms-checkbox">
                            <input
                              id="portal-terms-checkbox"
                              type="checkbox"
                              checked={termsAccepted}
                              onChange={(e) => setTermsAccepted(e.target.checked)}
                              className="terms-checkbox-input"
                              disabled={loading}
                              required
                            />
                            <span className="terms-checkbox-text">
                              I agree to the{' '}
                              <button
                                type="button"
                                className="legal-link-btn"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openLegalModal('terms');
                                }}
                              >
                                Terms &amp; Conditions
                              </button>{' '}
                              and acknowledge the{' '}
                              <button
                                type="button"
                                className="legal-link-btn"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openLegalModal('privacy');
                                }}
                              >
                                Privacy Policy
                              </button>
                              . <span className="required-star">*</span>
                            </span>
                          </label>
                        </div>
                      </>
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

      {/* Terms & Conditions and Privacy Policy Dialog */}
      <TermsAndPrivacyModals
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        type={legalModalType}
        onSwitchType={setLegalModalType}
      />
    </div>
  );
}
