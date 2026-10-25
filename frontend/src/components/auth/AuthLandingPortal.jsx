import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  User,
  FileText,
  Activity,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Key,
  UserCog,
  Calendar,
  Eye,
  EyeOff,
  Upload,
  Users,
  Sun,
  Moon,
  Monitor,
  HelpCircle,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { Logo } from '../common/Logo';
import TermsAndPrivacyModals from '../legal/TermsAndPrivacyModals';
import { buildApiUrl } from '../../config/api';
import './AuthLandingPortal.css';

export function AuthLandingPortal({
  initialMode = 'login',
  onModeChange,
  backendConnected = false,
  onHelpClick,
}) {
  const { login, register, verifyEmailToken } = useAuth();
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'forgot' | 'reset' | 'resend' | 'verify-pending'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [recoveryOption, setRecoveryOption] = useState('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalType, setLegalModalType] = useState('terms');
  const [resetToken, setResetToken] = useState('');
  const [requestedRole, setRequestedRole] = useState('viewer');
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

  // Theme state (for landing page nav only)
  const [theme, setTheme] = useState(() => localStorage.getItem('trustvault_theme') || 'system');
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
    try { localStorage.setItem('trustvault_theme', theme); } catch { /* ignore */ }
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const h = (e) => document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      mq.addEventListener('change', h);
      return () => mq.removeEventListener('change', h);
    }
  }, [theme]);

  const nextTheme = () => {
    const currentActive = document.documentElement.getAttribute('data-theme') || 'light';
    const next = currentActive === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };
  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  // Synchronize mode with prop
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

  const getTodayMaxDate = () => new Date().toISOString().split('T')[0];

  const calculateAge = (dobString) => {
    if (!dobString) return null;
    const parts = dobString.split('-').map(Number);
    if (parts.length !== 3) return null;
    const [year, month, day] = parts;
    const birthDate = new Date(year, month - 1, day);
    if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (birthDate > today) return -1;
    let age = now.getFullYear() - year;
    const m = now.getMonth() - (month - 1);
    if (m < 0 || (m === 0 && now.getDate() < day)) age--;
    return age;
  };

  const openLegalModal = (type) => { setLegalModalType(type); setLegalModalOpen(true); };

  // URL param handling
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
            if (res.user?.email) setEmail(res.user.email);
            setMode('login');
            onModeChange?.('login');
          })
          .catch((err) => {
            setError(err.message || 'Verification link is invalid or has expired.');
            setMode('resend');
          })
          .finally(() => {
            setVerifyingEmail(false);
            window.history.replaceState({}, document.title, window.location.pathname);
          });
      } else if (resetTokenParam) {
        setResetToken(resetTokenParam);
        setMode('reset');
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (modeParam === 'register' || window.location.hash === '#register') {
        setMode('register'); onModeChange?.('register');
      } else if (modeParam === 'login' || window.location.hash === '#login') {
        setMode('login'); onModeChange?.('login');
      }
    } catch { /* ignore */ }

    const handleUrlChange = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const modeParam = params.get('mode');
        if (modeParam === 'register' || window.location.hash === '#register') {
          setMode('register'); onModeChange?.('register');
        } else if (modeParam === 'login' || window.location.hash === '#login') {
          setMode('login'); onModeChange?.('login');
        }
      } catch { /* ignore */ }
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
    setError(''); setErrorAction(null); setResetSuccess(''); setForgotNotice(''); setResendNotice('');

    if (mode === 'resend') {
      if (!email.trim()) { setError('Please provide your registered work email address.'); return; }
      setLoading(true);
      try {
        const response = await fetch(buildApiUrl('/auth/resend-verification'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || data.message || 'Failed to submit resend verification request.');
        setResendNotice(data.message || 'If an unverified account exists with this email address, a new verification link has been sent.');
        if (data.devVerifyUrl) setDevVerifyUrl(data.devVerifyUrl);
      } catch (err) {
        setError(err.message || 'Network error. Please verify your connection.');
      } finally { setLoading(false); }
      return;
    }

    if (mode === 'forgot') {
      if (!email.trim()) { setError('Please provide your registered work email address.'); return; }
      setLoading(true);
      try {
        const endpoint = recoveryOption === 'email'
          ? buildApiUrl('/auth/forgot-password-email')
          : buildApiUrl('/auth/forgot-password');
        const response = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || data.message || 'Failed to submit recovery request.');
        setForgotSubmitted(true);
        if (data.devResetUrl) setDevResetUrl(data.devResetUrl);
        setForgotNotice(data.message || (recoveryOption === 'email'
          ? 'If an account exists with this email address, a password reset link has been sent to your inbox.'
          : 'If this email address is registered, your password reset request has been submitted to an Administrator for review.'));
      } catch (err) {
        setError(err.message || 'Network error submitting recovery request. Please try again.');
      } finally { setLoading(false); }
      return;
    }

    if (mode === 'reset') {
      if (!resetToken.trim()) { setError('Please provide your single-use recovery token.'); return; }
      if (!password || password.length < 8) { setError('New password must be at least 8 characters long.'); return; }
      if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) { setError('New password must contain at least one letter and one number.'); return; }
      if (password !== confirmPassword) { setError('New password and confirmation password do not match.'); return; }
      setLoading(true);
      try {
        const response = await fetch(buildApiUrl('/auth/reset-password'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken.trim(), newPassword: password, confirmPassword }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Failed to reset password.');
        setResetSuccess('Password successfully updated. You may now sign in with your new credentials.');
        setPassword(''); setConfirmPassword(''); setResetToken(''); setMode('login');
      } catch (err) {
        setError(err.message || 'Failed to reset password. Token may be invalid or expired.');
      } finally { setLoading(false); }
      return;
    }

    if (!email.trim() || !password) { setError('Please provide both your work email and password.'); return; }

    if (mode === 'register') {
      if (!name.trim() || name.trim().length < 2) { setError('Full name is required (minimum 2 characters).'); return; }
      if (name.trim().length > 50) { setError('Full name cannot exceed 50 characters.'); return; }
      if (/[<>]/.test(name.trim())) { setError('Full name contains invalid characters.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please provide a valid work email address.'); return; }
      if (password.length < 8) { setError('Password must be at least 8 characters long.'); return; }
      if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) { setError('Password must contain at least one letter and one number.'); return; }
      if (password !== confirmPassword) { setError('Password and confirmation password do not match.'); return; }
      if (!dateOfBirth) { setError('Date of birth is required.'); return; }
      const age = calculateAge(dateOfBirth);
      if (age === -1) { setError('Date of birth cannot be in the future.'); return; }
      if (age === null || isNaN(age)) { setError('Please provide a valid calendar date of birth.'); return; }
      if (age < 13) { setError('You must be at least 13 years old to register for TrustVault.'); return; }
      if (!termsAccepted) { setError('You must agree to the Terms & Conditions and acknowledge the Privacy Policy to create an account.'); return; }
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const regResult = await register({
          name: name.trim(), email: email.trim(), password, confirmPassword,
          dateOfBirth, termsAccepted: true, requestedRole,
        });
        if (regResult.isEmailVerified === false) {
          setUnverifiedEmail(email.trim());
          if (regResult.devVerifyUrl) setDevVerifyUrl(regResult.devVerifyUrl);
          const deliveryFailed = Boolean(regResult.emailDelivery && regResult.emailDelivery.sent === false);
          setEmailDeliveryFailed(deliveryFailed);
          setForgotNotice(regResult.message || (deliveryFailed
            ? 'Account created, but verification email could not be delivered to your inbox. Please check your email configuration.'
            : 'Account registered! Please check your inbox to verify your email address before signing in.'));
          setMode('verify-pending');
        }
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED' || /verify your email/i.test(err.message)) {
        setError('Your email address is not yet verified. Please check your inbox or request a new verification link.');
        setErrorAction({ label: 'Resend Verification Email', onClick: () => switchMode('resend') });
      } else {
        setError(err.message || 'Authentication failed. Please verify your credentials.');
      }
    } finally { setLoading(false); }
  };

  const switchMode = (newMode) => {
    setMode(newMode); setError(''); setErrorAction(null); setResetSuccess('');
    setForgotSubmitted(false); setForgotNotice(''); setResendNotice('');
    setDevVerifyUrl(''); setDevResetUrl(''); setEmailDeliveryFailed(false);
    setPassword(''); setConfirmPassword(''); setShowPassword(false); setShowConfirmPassword(false);
    if (onModeChange && (newMode === 'login' || newMode === 'register')) onModeChange(newMode);
    try {
      const url = new URL(window.location.href);
      if (newMode === 'register') { url.searchParams.set('mode', 'register'); }
      else if (newMode === 'login') { url.searchParams.delete('mode'); }
      window.history.replaceState({}, document.title, url.toString());
    } catch { /* ignore */ }
  };

  // Scroll to auth form
  const scrollToForm = () => {
    document.getElementById('auth-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Mode title helpers
  const getFormTitle = () => {
    if (verifyingEmail) return 'Verifying Email…';
    const titles = {
      login: 'Sign in to TrustVault',
      register: 'Create your account',
      'verify-pending': 'Verify Your Email',
      resend: 'Resend Verification',
      forgot: 'Recover Account Access',
      reset: 'Reset Your Password',
    };
    return titles[mode] || 'TrustVault';
  };

  const getFormSubtitle = () => {
    if (verifyingEmail) return 'Validating your verification token…';
    const subs = {
      login: 'Enter your credentials to access your documents.',
      register: 'New accounts start as Viewers. Owners require Admin approval.',
      'verify-pending': 'Please verify your work email to activate vault access.',
      resend: 'Enter your registered email to receive a fresh verification link.',
      forgot: 'Choose your preferred recovery method below.',
      reset: 'Enter your single-use recovery token and set a new password.',
    };
    return subs[mode] || '';
  };

  const isAuthMode = ['forgot', 'reset', 'resend', 'verify-pending', 'login', 'register'].includes(mode);
  const showFullLanding = !isAuthMode || mode === 'login' || mode === 'register';

  return (
    <div className="auth-portal-page" role="region" aria-label="TrustVault">

      {/* ── Navigation Bar ────────────────────────────────────────────── */}
      <nav className="auth-nav" aria-label="Main navigation">
        <div className="auth-nav-brand">
          <Logo
            variant="horizontal"
            size={26}
            className="auth-nav-logo"
            onClick={() => {
              switchMode('login');
              setMobileMenuOpen(false);
            }}
          />
        </div>

        {showFullLanding && (
          <div className="auth-nav-links" aria-label="Page sections">
            <button
              type="button"
              className="auth-nav-link"
              onClick={() => document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Features
            </button>
            <button
              type="button"
              className="auth-nav-link"
              onClick={() => document.getElementById('how-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              How It Works
            </button>
          </div>
        )}

        <div className="auth-nav-actions">
          {/* Backend API Health Status Indicator */}
          <div 
            className={`api-status-pill desktop-only ${backendConnected ? 'api-online' : 'api-standby'}`}
            title={backendConnected ? 'Backend service online at /api/health' : 'Backend in standby mode'}
          >
            <span className="api-dot" aria-hidden="true" />
            <span className="api-status-text">
              {backendConnected ? 'API Connected' : 'API Standby'}
            </span>
          </div>

          {/* Help Documentation Link */}
          {onHelpClick && (
            <button
              type="button"
              className="nav-icon-btn desktop-only"
              onClick={onHelpClick}
              title="TrustVault Architecture & Guide"
              aria-label="View documentation guide"
              id="landing-help-btn"
            >
              <HelpCircle size={17} />
            </button>
          )}

          {/* Theme Selector */}
          <button
            type="button"
            className="nav-theme-btn"
            onClick={nextTheme}
            aria-label={`Switch theme (current: ${theme})`}
            title={`Theme: ${theme}`}
            id="landing-theme-toggle-btn"
          >
            <ThemeIcon size={16} />
          </button>

          {showFullLanding && (
            <div className="auth-nav-desktop-cta">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { switchMode('login'); scrollToForm(); }}
                id="landing-signin-nav-btn"
              >
                Sign in
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => { switchMode('register'); scrollToForm(); }}
                id="landing-getstarted-nav-btn"
              >
                Get Started
              </Button>
            </div>
          )}

          {/* Mobile Navigation Toggle */}
          <button
            type="button"
            className="mobile-nav-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            id="landing-mobile-menu-toggle"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Dropdown / Drawer Menu */}
        {mobileMenuOpen && (
          <div className="auth-mobile-menu" role="menu">
            {showFullLanding && (
              <div className="mobile-menu-links">
                <button
                  type="button"
                  className="mobile-menu-link"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Features
                </button>
                <button
                  type="button"
                  className="mobile-menu-link"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    document.getElementById('how-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  How It Works
                </button>
              </div>
            )}

            <div className="mobile-menu-meta">
              <div 
                className={`api-status-pill ${backendConnected ? 'api-online' : 'api-standby'}`}
                title={backendConnected ? 'Backend service online at /api/health' : 'Backend in standby mode'}
              >
                <span className="api-dot" aria-hidden="true" />
                <span className="api-status-text">
                  {backendConnected ? 'API Connected' : 'API Standby'}
                </span>
              </div>

              {onHelpClick && (
                <button
                  type="button"
                  className="mobile-help-btn"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onHelpClick();
                  }}
                >
                  <HelpCircle size={15} />
                  <span>TrustVault Guide</span>
                </button>
              )}
            </div>

            {showFullLanding && (
              <div className="mobile-menu-cta">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    switchMode('login');
                    scrollToForm();
                  }}
                >
                  Sign in
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    switchMode('register');
                    scrollToForm();
                  }}
                >
                  Get Started
                </Button>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* ── Hero Section ──────────────────────────────────────────────── */}
      {(mode === 'login' || mode === 'register') && (
        <section className="auth-hero" aria-labelledby="hero-headline">
          {/* Left: headline + CTA */}
          <div className="auth-hero-content">
            <div className="auth-hero-eyebrow">
              <span className="eyebrow-dot" aria-hidden="true" />
              Document Security Platform
            </div>
            <h1 className="auth-hero-headline" id="hero-headline">
              Every Access.{' '}
              <span className="headline-accent">Verified.</span>
            </h1>
            <p className="auth-hero-description">
              Manage confidential documents, share files with the right people, control document-specific permissions, and maintain a transparent record of activity.
            </p>
            <div className="auth-hero-cta">
              <Button
                variant="primary"
                size="lg"
                onClick={() => { switchMode('register'); scrollToForm(); }}
                icon={ArrowRight}
                iconPosition="trailing"
              >
                Get Started Free
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Explore Features
              </Button>
            </div>
          </div>

          {/* Right: document workspace illustration */}
          <div className="auth-hero-visual" aria-hidden="true">
            <div className="auth-doc-illustration">
              <div className="doc-illus-header">
                <div className="doc-illus-avatar">SL</div>
                <div className="doc-illus-meta">
                  <div className="doc-illus-name">sarah.lead@trustvault.internal</div>
                  <div className="doc-illus-sub">Document Owner · 3 shared</div>
                </div>
                <span className="doc-illus-badge">Verified</span>
              </div>
              <div className="doc-illus-rows">
                {[
                  { initials: '📄', name: 'Q4 Financial Report.pdf', meta: 'Updated 2h ago · 2.4 MB', perm: 'Owner', permClass: 'perm-owner' },
                  { initials: '📑', name: 'Contract Draft v3.docx', meta: 'Updated yesterday · 890 KB', perm: 'Read Only', permClass: 'perm-read' },
                  { initials: '📊', name: 'Audit Log Export.xlsx', meta: 'Updated 3d ago · 1.1 MB', perm: 'Read & Edit', permClass: 'perm-edit' },
                ].map((doc, i) => (
                  <div className="doc-illus-row" key={i}>
                    <div className="doc-row-icon" aria-hidden="true">
                      <FileText size={16} />
                    </div>
                    <div className="doc-row-info">
                      <div className="doc-row-name">{doc.name}</div>
                      <div className="doc-row-meta">{doc.meta}</div>
                    </div>
                    <span className={`doc-row-perm ${doc.permClass}`}>{doc.perm}</span>
                  </div>
                ))}
              </div>
              <div className="doc-illus-footer">
                <span className="doc-illus-footer-dot" aria-hidden="true" />
                <span className="doc-illus-footer-text">Access controls active · Audit logging on</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Features Section ──────────────────────────────────────────── */}
      {(mode === 'login' || mode === 'register') && (
        <section className="auth-features-section" id="features-section" aria-labelledby="features-heading">
          <p className="auth-section-label">What TrustVault offers</p>
          <h2 className="auth-section-title" id="features-heading">Built for confidential document collaboration</h2>
          <p className="auth-section-desc">
            Every feature is designed to keep your documents accessible to the right people and protected from everyone else.
          </p>

          <div className="features-grid">
            {[
              {
                icon: Lock,
                title: 'Private Document Storage',
                desc: 'Files are stored outside public web roots with randomized UUID storage keys, preventing direct URL access.',
              },
              {
                icon: Users,
                title: 'Granular Access Control',
                desc: 'Grant Read Only or Read & Edit permission per document per collaborator. Revoke access instantly at any time.',
              },
              {
                icon: Activity,
                title: 'Auditable Activity Trail',
                desc: 'Every document access, download, permission change, and denied attempt is recorded in a persistent audit log.',
              },
              {
                icon: UserCog,
                title: 'Owner Approval Workflow',
                desc: 'Document Owner accounts require Administrator approval, ensuring governance over who can upload sensitive files.',
              },
              {
                icon: Mail,
                title: 'Email Verification',
                desc: 'All accounts require email verification before access is granted. Password recovery via secure single-use links.',
              },
              {
                icon: Upload,
                title: 'Flexible Visibility Settings',
                desc: 'Choose Private, Share with Specific Users, or Share with All Registered Users for each document individually.',
              },
            ].map((f, i) => (
              <div className="feature-card" key={i}>
                <div className="feature-card-icon" aria-hidden="true">
                  <f.icon size={20} />
                </div>
                <h3 className="feature-card-title">{f.title}</h3>
                <p className="feature-card-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── How It Works ──────────────────────────────────────────────── */}
      {(mode === 'login' || mode === 'register') && (
        <section className="auth-how-section" id="how-section" aria-labelledby="how-heading">
          <p className="auth-section-label">Simple by design</p>
          <h2 className="auth-section-title" id="how-heading">How It Works</h2>
          <p className="auth-section-desc">
            Three steps from sign-in to controlled, auditable document collaboration.
          </p>
          <div className="how-steps">
            {[
              { num: '1', title: 'Upload a document', desc: 'Choose a file, set its visibility, and assign document metadata. Files are stored securely outside public access.' },
              { num: '2', title: 'Assign permissions', desc: 'Add collaborators by email. Grant Read Only or Read & Edit access. Changes take effect immediately.' },
              { num: '3', title: 'Review activity', desc: 'Monitor the audit log for every access event. Revoke permissions or remove collaborators at any time.' },
            ].map((step) => (
              <div className="how-step" key={step.num}>
                <div className="how-step-num" aria-hidden="true">{step.num}</div>
                <h3 className="how-step-title">{step.title}</h3>
                <p className="how-step-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Auth Form ──────────────────────────────────────────────────── */}
      <section
        className="auth-form-section"
        id="auth-form-anchor"
        aria-labelledby="auth-form-heading"
        style={{
          background: (mode === 'forgot' || mode === 'reset' || mode === 'resend' || mode === 'verify-pending')
            ? 'var(--bg-app)'
            : undefined,
          paddingTop: (mode === 'login' || mode === 'register') ? undefined : '4rem',
        }}
      >
        <div className="auth-form-wrapper">
          <div className="auth-form-header">
            <div className="auth-form-logo">
              <Logo variant="icon" size={40} />
            </div>
            <h2 className="auth-form-title" id="auth-form-heading">{getFormTitle()}</h2>
            <p className="auth-form-subtitle">{getFormSubtitle()}</p>
          </div>

          {/* Sign In / Register Tab Switcher */}
          {(mode === 'login' || mode === 'register') && (
            <div className="auth-mode-tabs" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={`auth-mode-tab ${mode === 'login' ? 'active' : ''}`}
                onClick={() => switchMode('login')}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                className={`auth-mode-tab ${mode === 'register' ? 'active' : ''}`}
                onClick={() => switchMode('register')}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Loading state for email verification */}
          {verifyingEmail && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <Loader2 size={36} className="spinner" style={{ margin: '0 auto 12px', color: 'var(--color-primary)' }} />
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Validating email token…</p>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="auth-error-banner" role="alert">
              <AlertCircle size={16} className="error-icon" aria-hidden="true" />
              <div style={{ flex: 1 }}>
                <span>{error}</span>
                {errorAction && (
                  <button
                    type="button"
                    onClick={errorAction.onClick}
                    style={{
                      display: 'block', marginTop: '6px', background: 'none', border: 'none',
                      color: 'var(--color-error)', fontSize: 'var(--text-xs)', fontWeight: 600,
                      cursor: 'pointer', padding: 0, textDecoration: 'underline',
                    }}
                  >
                    {errorAction.label} →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Success banner */}
          {resetSuccess && (
            <div className="auth-success-banner" role="status">
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{resetSuccess}</span>
            </div>
          )}

          {/* ── Verify Pending ─────────────────────────────────────────── */}
          {mode === 'verify-pending' && (
            <div className="verify-pending-card" role="status">
              <div className="verify-pending-title">
                {emailDeliveryFailed
                  ? <AlertCircle size={18} style={{ color: 'var(--color-warning)' }} />
                  : <Mail size={18} style={{ color: 'var(--color-success)' }} />
                }
                <span>{emailDeliveryFailed ? 'Account Created — Email Delivery Blocked' : 'Verification Email Sent'}</span>
              </div>
              {emailDeliveryFailed ? (
                <p className="verify-pending-body" style={{ color: 'var(--color-warning-text)' }}>
                  Your account was registered, but outbound mail is blocked. Add a <strong>RESEND_API_KEY</strong> or <strong>BREVO_API_KEY</strong> in your deployment environment.
                </p>
              ) : (
                <p className="verify-pending-body">
                  We sent a verification link to <span className="verify-email-highlight">{unverifiedEmail || email}</span>. Please check your inbox and spam folder.
                </p>
              )}
              <button type="button" className="resend-box-link" onClick={() => switchMode('resend')}>
                Didn&apos;t receive the email? Resend verification link →
              </button>
              <Button type="button" variant="primary" size="md" onClick={() => switchMode('login')} style={{ width: '100%' }}>
                Return to Sign In
              </Button>
            </div>
          )}

          {/* ── Resend Confirmation ────────────────────────────────────── */}
          {mode === 'resend' && resendNotice && (
            <div className="verify-pending-card auth-success-box" role="status">
              <div className="verify-pending-title">
                <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />
                <span>Verification Link Sent</span>
              </div>
              <p className="verify-pending-body">{resendNotice}</p>
              <Button type="button" variant="primary" size="md" onClick={() => switchMode('login')} style={{ width: '100%', marginTop: '4px' }}>
                Back to Sign In
              </Button>
            </div>
          )}

          {/* ── Forgot Confirmation ────────────────────────────────────── */}
          {mode === 'forgot' && forgotSubmitted && (
            <div className="verify-pending-card auth-success-box" role="status">
              <div className="verify-pending-title">
                <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />
                <span>{recoveryOption === 'email' ? 'Reset Link Sent' : 'Admin Recovery Requested'}</span>
              </div>
              <p className="verify-pending-body">{forgotNotice}</p>
              {devResetUrl && (
                <div className="dev-verify-banner">
                  <div className="dev-verify-badge">Developer Testing Reset Link</div>
                  <a href={devResetUrl} className="dev-verify-link" onClick={(e) => {
                    e.preventDefault();
                    try {
                      const urlObj = new URL(devResetUrl);
                      const tok = urlObj.searchParams.get('resetToken') || urlObj.searchParams.get('token');
                      if (tok) { setResetToken(tok); setMode('reset'); setForgotSubmitted(false); }
                    } catch { /* fallback */ }
                  }}>
                    {devResetUrl}
                  </a>
                </div>
              )}
              <Button type="button" variant="primary" size="md" onClick={() => switchMode('login')} style={{ width: '100%', marginTop: '4px' }}>
                Back to Sign In
              </Button>
            </div>
          )}

          {/* ── Main Form ──────────────────────────────────────────────── */}
          {!verifyingEmail && mode !== 'verify-pending' && !(mode === 'resend' && resendNotice) && !(mode === 'forgot' && forgotSubmitted) && (
            <form onSubmit={handleSubmit} className="auth-form" noValidate>

              {/* Recovery method selector */}
              {mode === 'forgot' && (
                <div className="recovery-selection-section" aria-label="Account recovery options">
                  <span className="recovery-section-label">Select Recovery Method</span>
                  <div className="recovery-cards-grid" role="radiogroup" aria-label="Password Recovery Options">
                    {[
                      {
                        value: 'email',
                        icon: Mail,
                        iconClass: 'icon-email',
                        title: 'Email Reset Link',
                        badge: 'Instant · 15 Mins',
                        badgeClass: 'badge-instant',
                        desc: 'A single-use link is dispatched to your registered email to immediately set a new password.',
                      },
                      {
                        value: 'admin',
                        icon: UserCog,
                        iconClass: 'icon-admin',
                        title: 'Admin Assisted',
                        badge: 'Managed Reset',
                        badgeClass: 'badge-admin',
                        desc: 'An Administrator reviews your identity and provisions a temporary password requiring change on first login.',
                      },
                    ].map((opt) => (
                      <div
                        key={opt.value}
                        role="radio"
                        tabIndex={0}
                        aria-checked={recoveryOption === opt.value}
                        className={`recovery-choice-card ${recoveryOption === opt.value ? 'selected' : ''}`}
                        onClick={() => setRecoveryOption(opt.value)}
                        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setRecoveryOption(opt.value); } }}
                      >
                        <div className="recovery-card-radio">
                          <span className={`radio-dot ${recoveryOption === opt.value ? 'active' : ''}`} />
                        </div>
                        <div className="recovery-card-body">
                          <div className="recovery-card-header">
                            <div className={`recovery-card-icon-box ${opt.iconClass}`}><opt.icon size={15} /></div>
                            <div className="recovery-card-title-group">
                              <span className="recovery-card-title">{opt.title}</span>
                              <span className={`recovery-card-badge ${opt.badgeClass}`}>{opt.badge}</span>
                            </div>
                          </div>
                          <p className="recovery-card-desc">{opt.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reset mode fields */}
              {mode === 'reset' ? (
                <>
                  <div className="form-group">
                    <label htmlFor="portal-reset-token" className="form-label">
                      Single-Use Recovery Token <span className="required-star">*</span>
                    </label>
                    <div className="input-with-icon">
                      <Key size={16} className="field-icon" aria-hidden="true" />
                      <input
                        id="portal-reset-token" type="text" required
                        placeholder="Paste single-use recovery token…"
                        value={resetToken} onChange={(e) => setResetToken(e.target.value)}
                        className="form-input" disabled={loading} autoComplete="off"
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
                        id="portal-new-password" type="password" required
                        placeholder="Enter new password…" value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="form-input" disabled={loading} autoComplete="new-password"
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
                        id="portal-confirm-password" type="password" required
                        placeholder="Re-enter new password…" value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="form-input" disabled={loading} autoComplete="new-password"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Name field (register only) */}
                  {mode === 'register' && (
                    <div className="form-group">
                      <label htmlFor="portal-name" className="form-label">
                        Full Name <span className="required-star">*</span>
                      </label>
                      <div className="input-with-icon">
                        <User size={16} className="field-icon" aria-hidden="true" />
                        <input
                          id="portal-name" type="text" required
                          placeholder="e.g. Alex Mercer" value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="form-input" disabled={loading} autoComplete="name"
                        />
                      </div>
                    </div>
                  )}

                  {/* Email */}
                  <div className="form-group">
                    <label htmlFor="portal-email" className="form-label">
                      Work Email Address <span className="required-star">*</span>
                    </label>
                    <div className="input-with-icon">
                      <Mail size={16} className="field-icon" aria-hidden="true" />
                      <input
                        id="portal-email" type="email" required
                        placeholder="name@company.internal" value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="form-input" disabled={loading} autoComplete="email"
                        autoFocus={mode === 'login' || mode === 'forgot' || mode === 'resend'}
                      />
                    </div>
                  </div>

                  {/* Date of birth (register only) */}
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
                          id="portal-dob" type="date" required max={getTodayMaxDate()}
                          value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)}
                          className="form-input" disabled={loading}
                        />
                      </div>
                      <p className="field-subtext">TrustVault requires users to be at least 13 years old to register.</p>
                    </div>
                  )}

                  {/* Password */}
                  {mode !== 'forgot' && mode !== 'resend' && (
                    <>
                      <div className="form-group">
                        <div className="label-row">
                          <label htmlFor="portal-password" className="form-label">
                            Password <span className="required-star">*</span>
                          </label>
                          {mode === 'register' && <span className="label-hint">Min 8 chars (letters & numbers)</span>}
                        </div>
                        <div className="input-with-icon password-input-wrapper">
                          <Lock size={16} className="field-icon" aria-hidden="true" />
                          <input
                            id="portal-password"
                            type={showPassword ? 'text' : 'password'}
                            required placeholder="••••••••••••" value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="form-input" disabled={loading}
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                          />
                          <button
                            type="button" className="password-toggle-btn"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'} tabIndex={-1}
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        {mode === 'login' && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                            <button type="button" onClick={() => switchMode('forgot')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                              Forgot Password?
                            </button>
                            <button type="button" onClick={() => switchMode('resend')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', cursor: 'pointer', padding: 0 }}>
                              Resend verification?
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
                                required placeholder="Re-enter your password…" value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="form-input" disabled={loading} autoComplete="new-password"
                              />
                              <button
                                type="button" className="password-toggle-btn"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} tabIndex={-1}
                              >
                                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>
                          <div className="password-rules-callout" aria-live="polite">
                            <span className="password-rules-title">Password requirements:</span>
                            <div className="password-rules-grid">
                              <span className={`rule-chip ${password.length >= 8 ? 'met' : ''}`}>{password.length >= 8 ? '✓' : '·'} 8+ characters</span>
                              <span className={`rule-chip ${/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password) ? 'met' : ''}`}>{/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password) ? '✓' : '·'} Letters & numbers</span>
                              <span className={`rule-chip ${confirmPassword && password === confirmPassword ? 'met' : ''}`}>{confirmPassword && password === confirmPassword ? '✓' : '·'} Passwords match</span>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* Account type (register) */}
                  {mode === 'register' && (
                    <>
                      <div className="form-group role-selector-group">
                        <label className="form-label">
                          Requested Account Type <span className="required-star">*</span>
                        </label>
                        <div className="account-type-options" role="radiogroup" aria-label="Requested Account Type">
                          <label className={`account-type-card ${requestedRole === 'viewer' ? 'selected' : ''}`}>
                            <input type="radio" name="requestedRole" value="viewer" checked={requestedRole === 'viewer'} onChange={() => setRequestedRole('viewer')} className="sr-only" />
                            <div className="type-card-content">
                              <div className="type-card-header">
                                <span className="type-card-title">Viewer</span>
                                <span className="type-card-badge badge-viewer">Standard Access</span>
                              </div>
                              <p className="type-card-desc">Read documents shared with you. Ready upon email verification.</p>
                            </div>
                          </label>
                          <label className={`account-type-card ${requestedRole === 'owner' ? 'selected' : ''}`}>
                            <input type="radio" name="requestedRole" value="owner" checked={requestedRole === 'owner'} onChange={() => setRequestedRole('owner')} className="sr-only" />
                            <div className="type-card-content">
                              <div className="type-card-header">
                                <span className="type-card-title">Document Owner</span>
                                <span className="type-card-badge badge-owner">Requires Approval</span>
                              </div>
                              <p className="type-card-desc">Upload confidential files and manage collaborator permissions. Requires Admin approval.</p>
                            </div>
                          </label>
                        </div>
                      </div>

                      <div className="form-group terms-checkbox-group">
                        <label className="terms-checkbox-label" htmlFor="portal-terms-checkbox">
                          <input
                            id="portal-terms-checkbox" type="checkbox" checked={termsAccepted}
                            onChange={(e) => setTermsAccepted(e.target.checked)}
                            className="terms-checkbox-input" disabled={loading} required
                          />
                          <span className="terms-checkbox-text">
                            I agree to the{' '}
                            <button type="button" className="legal-link-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openLegalModal('terms'); }}>
                              Terms &amp; Conditions
                            </button>{' '}
                            and acknowledge the{' '}
                            <button type="button" className="legal-link-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openLegalModal('privacy'); }}>
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

              {/* Submit */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="auth-submit-button"
                disabled={loading}
                id="auth-submit-btn"
              >
                {loading ? (
                  <span className="btn-content-row">
                    <Loader2 size={16} className="spinner" aria-hidden="true" />
                    <span>
                      {mode === 'reset' ? 'Updating password…'
                        : mode === 'resend' ? 'Sending verification…'
                        : mode === 'forgot' ? 'Submitting request…'
                        : mode === 'login' ? 'Signing in…'
                        : 'Creating account…'}
                    </span>
                  </span>
                ) : (
                  <span className="btn-content-row">
                    <span>
                      {mode === 'reset' ? 'Set New Password'
                        : mode === 'resend' ? 'Send Verification Email'
                        : mode === 'forgot'
                          ? (recoveryOption === 'email' ? 'Send Password Reset Link' : 'Request Reset from Admin')
                          : mode === 'login' ? 'Sign In'
                          : 'Create Account'}
                    </span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </span>
                )}
              </Button>
            </form>
          )}

          {/* Mode switch link */}
          <div className="auth-switch-container">
            {mode === 'forgot' || mode === 'resend' || mode === 'reset' ? (
              <p className="auth-switch-text">
                Remember your credentials?{' '}
                <button type="button" className="auth-switch-link" onClick={() => switchMode('login')}>Back to Sign in</button>
              </p>
            ) : mode === 'login' ? (
              <p className="auth-switch-text">
                Don&apos;t have an account?{' '}
                <button type="button" className="auth-switch-link" onClick={() => switchMode('register')}>Create account</button>
              </p>
            ) : mode === 'register' ? (
              <p className="auth-switch-text">
                Already have an account?{' '}
                <button type="button" className="auth-switch-link" onClick={() => switchMode('login')}>Sign in</button>
              </p>
            ) : null}
          </div>

          {/* Demo credentials (login only) */}
          {mode === 'login' && (
            <div className="demo-accounts-container" aria-label="Quick Demo Accounts for Evaluators">
              <div className="demo-divider-row">
                <span className="demo-divider-text">Or evaluate with verified demo roles</span>
              </div>
              <div className="demo-cards-stack">
                {[
                  {
                    badge: 'Administrator', badgeClass: 'demo-badge-admin',
                    email: 'admin@trustvault.internal', password: 'TrustVault2026!',
                    desc: 'Identity governance, role assignment, system analytics, and audit logs.',
                  },
                  {
                    badge: 'Document Owner', badgeClass: 'demo-badge-owner',
                    email: 'sarah.lead@trustvault.internal', password: 'TrustVault2026!',
                    desc: 'Upload and manage files, delegate Read/Edit permissions, revoke access instantly.',
                  },
                  {
                    badge: 'Viewer', badgeClass: 'demo-badge-viewer',
                    email: 'alex.dev@trustvault.internal', password: 'TrustVault2026!',
                    desc: 'Collaborate on files shared with you. Restricted from uploading or deleting files.',
                  },
                  {
                    badge: 'Pending Owner Request', badgeClass: 'demo-badge-pending',
                    email: 'jordan.req@trustvault.internal', password: 'TrustVault2026!',
                    desc: 'Viewer with an active Owner approval request queued for Admin governance.',
                  },
                ].map((demo) => (
                  <button
                    key={demo.email}
                    type="button"
                    className="demo-account-card"
                    onClick={() => { setEmail(demo.email); setPassword(demo.password); setError(''); }}
                    title={`Fill ${demo.badge} demo credentials`}
                  >
                    <div className="demo-card-header">
                      <span className={`demo-badge ${demo.badgeClass}`}>{demo.badge}</span>
                      <span className="demo-email-text">{demo.email}</span>
                    </div>
                    <div className="demo-card-capabilities">{demo.desc}</div>
                  </button>
                ))}
              </div>
              <p className="demo-helper-note">
                Selecting a role fills credentials into the form. Click &ldquo;Sign In&rdquo; to authenticate with the backend.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── CTA Section ───────────────────────────────────────────────── */}
      {(mode === 'login' || mode === 'register') && (
        <section className="auth-cta-section" aria-labelledby="cta-heading">
          <h2 className="auth-cta-title" id="cta-heading">Ready to secure your documents?</h2>
          <p className="auth-cta-desc">
            Join TrustVault and take control of who accesses your confidential files.
          </p>
          <div className="auth-cta-actions">
            <Button
              variant="primary"
              size="lg"
              onClick={() => { switchMode('register'); scrollToForm(); }}
              style={{ background: 'white', color: 'var(--color-primary)' }}
            >
              Create Account
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => { switchMode('login'); scrollToForm(); }}
              style={{ color: 'rgba(168,216,200,0.85)', borderColor: 'rgba(168,216,200,0.30)' }}
            >
              Sign In
            </Button>
          </div>
        </section>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="auth-footer" aria-label="Site footer">
        <div className="auth-footer-left">
          <Logo variant="compact" size={20} />
          <span className="auth-footer-copy">© {new Date().getFullYear()} TrustVault</span>
        </div>
        <div className="auth-footer-links">
          {['Features', 'How It Works', 'Privacy', 'Terms'].map((link) => (
            <button
              key={link}
              type="button"
              className="auth-footer-link"
              onClick={() => {
                if (link === 'Privacy') openLegalModal('privacy');
                else if (link === 'Terms') openLegalModal('terms');
                else if (link === 'Features') document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' });
                else if (link === 'How It Works') document.getElementById('how-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              {link}
            </button>
          ))}
        </div>
      </footer>

      {/* Legal Modals */}
      <TermsAndPrivacyModals
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        type={legalModalType}
        onSwitchType={setLegalModalType}
      />
    </div>
  );
}
