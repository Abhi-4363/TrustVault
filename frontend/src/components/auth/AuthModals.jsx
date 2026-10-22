import React, { useState } from 'react';
import { X, Lock, Mail, User, ShieldCheck, AlertCircle, Loader2, Calendar, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { TermsAndPrivacyModals } from '../legal/TermsAndPrivacyModals';
import './AuthModals.css';

export function AuthModals({ isOpen, onClose, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [requestedRole, setRequestedRole] = useState('viewer');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotNotice, setForgotNotice] = useState('');
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalType, setLegalModalType] = useState('terms');

  const { login, register } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Please enter your work email address');
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch('http://localhost:5000/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = await res.json();
        setForgotSubmitted(true);
        setForgotNotice(
          data.message ||
            'If this email address is registered, your password reset request has been submitted to an Administrator for review.'
        );
      } catch {
        setError('Network error submitting password reset request');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'register') {
        if (!name.trim()) throw new Error('Please enter your full name');
        if (!dateOfBirth) throw new Error('Date of birth is required');

        // Age check: minimum 13
        const birthDate = new Date(dateOfBirth + 'T00:00:00Z');
        const today = new Date();
        let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
        const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birthDate.getUTCDate())) {
          age--;
        }
        if (age < 13) {
          throw new Error('TrustVault requires users to be at least 13 years old to register.');
        }

        if (password.length < 8) throw new Error('Password must be at least 8 characters long');
        if (password !== confirmPassword) throw new Error('Passwords do not match');
        if (!termsAccepted) throw new Error('You must accept the Terms & Conditions and acknowledge the Privacy Policy');

        await register(name, email, password, requestedRole, dateOfBirth, termsAccepted, confirmPassword);
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setForgotSubmitted(false);
    setForgotNotice('');
  };

  return (
    <div className="auth-overlay" onClick={onClose} role="presentation">
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="auth-header">
          <div className="auth-brand-badge">
            <ShieldCheck size={16} className="text-primary" />
            <span>TrustVault Secure Identity</span>
          </div>
          <button
            type="button"
            className="auth-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="auth-body">
          <h2 id="auth-modal-title" className="auth-title">
            {mode === 'forgot'
              ? 'Forgot Password?'
              : mode === 'login'
                ? 'Sign in to TrustVault'
                : 'Create your account'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'forgot'
              ? 'Submit a request to an Administrator to reset your vault credentials.'
              : mode === 'login'
                ? 'Access confidential documents and organizational audit records.'
                : 'Join your organization vault with secure bcrypt encryption.'}
          </p>

          {error && (
            <div className="auth-error-banner" role="alert">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'forgot' && forgotSubmitted ? (
            <div 
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
                color: '#166534',
                fontSize: '13px',
              }}
              role="status"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                <ShieldCheck size={18} className="text-success" />
                <span>Request Submitted to Administrator</span>
              </div>
              <p style={{ margin: 0, lineHeight: 1.5 }}>{forgotNotice}</p>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => switchMode('login')}
                style={{ width: '100%', marginTop: '4px' }}
              >
                Back to Sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              {mode === 'register' && (
                <div className="form-group">
                  <label htmlFor="reg-name" className="form-label">
                    Full Name
                  </label>
                  <div className="input-wrapper">
                    <User size={16} className="input-icon" aria-hidden="true" />
                    <input
                      id="reg-name"
                      type="text"
                      required
                      placeholder="e.g. Sarah Jenkins"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="form-input"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="auth-email" className="form-label">
                  Work Email Address
                </label>
                <div className="input-wrapper">
                  <Mail size={16} className="input-icon" aria-hidden="true" />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    placeholder="name@company.internal"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input"
                    disabled={isLoading}
                    autoFocus={mode === 'forgot'}
                  />
                </div>
              </div>

              {mode === 'register' && (
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label htmlFor="auth-dob" className="form-label" style={{ margin: 0 }}>
                      Date of Birth <span style={{ color: 'var(--color-danger-500, #ef4444)' }}>*</span>
                    </label>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>Min age: 13</span>
                  </div>
                  <div className="input-wrapper">
                    <Calendar size={16} className="input-icon" aria-hidden="true" />
                    <input
                      id="auth-dob"
                      type="date"
                      required
                      max={new Date().toISOString().split('T')[0]}
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="form-input"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}

              {mode !== 'forgot' && (
                <>
                  <div className="form-group">
                    <label htmlFor="auth-password" className="form-label">
                      Password {mode === 'register' && <span className="label-hint">(min 8 chars, 1 letter, 1 number)</span>}
                    </label>
                    <div className="input-wrapper" style={{ position: 'relative' }}>
                      <Lock size={16} className="input-icon" aria-hidden="true" />
                      <input
                        id="auth-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="form-input"
                        disabled={isLoading}
                        style={{ paddingRight: '36px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted, #94a3b8)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0
                        }}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {mode === 'login' && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                        <button
                          type="button"
                          onClick={() => switchMode('forgot')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-primary-600, #2563eb)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          Forgot Password?
                        </button>
                      </div>
                    )}
                  </div>

                  {mode === 'register' && (
                    <div className="form-group">
                      <label htmlFor="auth-confirm-password" className="form-label">
                        Confirm Password <span style={{ color: 'var(--color-danger-500, #ef4444)' }}>*</span>
                      </label>
                      <div className="input-wrapper" style={{ position: 'relative' }}>
                        <Lock size={16} className="input-icon" aria-hidden="true" />
                        <input
                          id="auth-confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          placeholder="Re-enter your password..."
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="form-input"
                          disabled={isLoading}
                          style={{ paddingRight: '36px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted, #94a3b8)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: 0
                          }}
                          aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {mode === 'register' && (
                <>
                  <div className="form-group" style={{ marginTop: '8px' }}>
                    <label className="form-label">
                      Requested Account Role
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setRequestedRole('viewer')}
                        style={{
                          padding: '8px',
                          borderRadius: '8px',
                          border: requestedRole === 'viewer' ? '1.5px solid var(--color-primary-600, #2563eb)' : '1px solid var(--border-light, #e2e8f0)',
                          backgroundColor: requestedRole === 'viewer' ? '#eff6ff' : 'transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '11.5px'
                        }}
                      >
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>Viewer</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Immediate read access</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRequestedRole('owner')}
                        style={{
                          padding: '8px',
                          borderRadius: '8px',
                          border: requestedRole === 'owner' ? '1.5px solid var(--color-primary-600, #2563eb)' : '1px solid var(--border-light, #e2e8f0)',
                          backgroundColor: requestedRole === 'owner' ? '#eff6ff' : 'transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '11.5px'
                        }}
                      >
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>Document Owner</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Requires Admin approval</div>
                      </button>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                      {requestedRole === 'owner'
                        ? 'Owner requests are reviewed by an Administrator. You will gain Viewer privileges immediately while waiting.'
                        : 'Standard read-only account with access to shared files.'}
                    </p>
                  </div>

                  <div className="form-group" style={{ marginTop: '12px', marginBottom: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        style={{ marginTop: '2px', cursor: 'pointer' }}
                        required
                        disabled={isLoading}
                      />
                      <span>
                        I agree to the{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setLegalModalType('terms');
                            setLegalModalOpen(true);
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--color-primary-600, #2563eb)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                        >
                          Terms &amp; Conditions
                        </button>{' '}
                        and acknowledge the{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setLegalModalType('privacy');
                            setLegalModalOpen(true);
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--color-primary-600, #2563eb)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                        >
                          Privacy Policy
                        </button>
                        . <span style={{ color: 'var(--color-danger-500, #ef4444)' }}>*</span>
                      </span>
                    </label>
                  </div>
                </>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="auth-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="spinner" />
                    <span>
                      {mode === 'forgot'
                        ? 'Submitting request...'
                        : mode === 'login'
                          ? 'Signing in...'
                          : 'Creating account...'}
                    </span>
                  </>
                ) : (
                  mode === 'forgot'
                    ? 'Send Request to Admin'
                    : mode === 'login'
                      ? 'Sign in'
                      : 'Create account'
                )}
              </Button>
            </form>
          )}

          <div className="auth-switch-footer">
            {mode === 'forgot' ? (
              <p>
                Remember your credentials?{' '}
                <button
                  type="button"
                  className="switch-link"
                  onClick={() => switchMode('login')}
                >
                  Sign in
                </button>
              </p>
            ) : mode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button
                  type="button"
                  className="switch-link"
                  onClick={() => switchMode('register')}
                >
                  Create one now
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  className="switch-link"
                  onClick={() => switchMode('login')}
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      <TermsAndPrivacyModals
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        type={legalModalType}
        onSwitchType={setLegalModalType}
      />
    </div>
  );
}
