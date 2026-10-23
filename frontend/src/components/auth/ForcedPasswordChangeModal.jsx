import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ArrowRight, 
  LogOut, 
  Loader2 
} from 'lucide-react';
import { Button } from '../common/Button';
import { buildApiUrl } from '../../config/api';
import './ForcedPasswordChangeModal.css';

export function ForcedPasswordChangeModal({ user, token, onPasswordChanged, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState('Password@123');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Password validation checks
  const isMinLength = newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const isNotDefaultTemp = newPassword !== 'Password@123';
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid = isMinLength && hasLetter && hasNumber && isNotDefaultTemp && passwordsMatch;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!currentPassword) {
      setErrorMsg('Please provide your current temporary password.');
      return;
    }

    if (!isFormValid) {
      setErrorMsg('Please ensure all password requirements are satisfied before proceeding.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(buildApiUrl('/auth/change-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to update password.');
      }

      setSuccessMsg('Your password has been successfully updated! Unlocking your vault...');
      setTimeout(() => {
        onPasswordChanged();
      }, 1200);
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred while updating your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forced-password-overlay" role="dialog" aria-modal="true" aria-labelledby="forced-pwd-title">
      <div className="forced-password-card">
        {/* Header with Security Badge */}
        <div className="forced-pwd-header">
          <div className="forced-pwd-icon-box">
            <ShieldAlert size={26} className="text-warning" />
          </div>
          <h2 id="forced-pwd-title" className="forced-pwd-title">
            Temporary Password Detected
          </h2>
          <p className="forced-pwd-subtitle">
            Your account was reset by an Administrator to the temporary password{' '}
            <code className="temp-pwd-pill">Password@123</code>.
            Under TrustVault security policy, you must set a new permanent password before accessing protected files.
          </p>
        </div>

        {/* Notice Banner */}
        <div className="forced-pwd-banner">
          <span className="banner-note-bold">Challenge Demonstration Note:</span>{' '}
          <code>Password@123</code> is a shared temporary password for evaluator testing. It cannot remain your permanent account password.
        </div>

        {errorMsg && (
          <div className="forced-pwd-error-alert" role="alert">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="forced-pwd-success-alert" role="status">
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="forced-pwd-form" noValidate>
          {/* Current Password Field */}
          <div className="form-group">
            <label className="form-label" htmlFor="temp-current-pwd">
              Current Temporary Password <span className="text-danger">*</span>
            </label>
            <div className="pwd-input-wrap">
              <input
                id="temp-current-pwd"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="form-input"
                placeholder="Password@123"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="pwd-toggle-btn"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                tabIndex="-1"
                aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
              >
                {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* New Password Field */}
          <div className="form-group">
            <label className="form-label" htmlFor="temp-new-pwd">
              New Permanent Password <span className="text-danger">*</span>
            </label>
            <div className="pwd-input-wrap">
              <input
                id="temp-new-pwd"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="form-input"
                placeholder="Minimum 8 characters"
                required
                disabled={loading}
                autoFocus
              />
              <button
                type="button"
                className="pwd-toggle-btn"
                onClick={() => setShowNewPassword(!showNewPassword)}
                tabIndex="-1"
                aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
              >
                {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Confirm New Password Field */}
          <div className="form-group">
            <label className="form-label" htmlFor="temp-confirm-pwd">
              Confirm New Password <span className="text-danger">*</span>
            </label>
            <div className="pwd-input-wrap">
              <input
                id="temp-confirm-pwd"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
                placeholder="Re-enter new password"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="pwd-toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex="-1"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Requirements Checklist */}
          <div className="forced-pwd-reqs">
            <div className="req-item">
              {isMinLength ? <CheckCircle2 size={13} className="text-success" /> : <XCircle size={13} className="text-muted" />}
              <span className={isMinLength ? 'req-met' : ''}>At least 8 characters</span>
            </div>
            <div className="req-item">
              {hasLetter && hasNumber ? <CheckCircle2 size={13} className="text-success" /> : <XCircle size={13} className="text-muted" />}
              <span className={hasLetter && hasNumber ? 'req-met' : ''}>Contains both letters and numbers</span>
            </div>
            <div className="req-item">
              {isNotDefaultTemp ? <CheckCircle2 size={13} className="text-success" /> : <XCircle size={13} className="text-muted" />}
              <span className={isNotDefaultTemp ? 'req-met' : ''}>Cannot be identical to temporary password</span>
            </div>
            <div className="req-item">
              {passwordsMatch ? <CheckCircle2 size={13} className="text-success" /> : <XCircle size={13} className="text-muted" />}
              <span className={passwordsMatch ? 'req-met' : ''}>Passwords match</span>
            </div>
          </div>

          {/* Form Actions */}
          <div className="forced-pwd-actions">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="forced-pwd-submit-btn"
              disabled={loading || !isFormValid}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spinner" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <span>Set New Password & Unlock</span>
                  <ArrowRight size={16} />
                </>
              )}
            </Button>

            <button
              type="button"
              className="forced-pwd-logout-link"
              onClick={onLogout}
              disabled={loading}
            >
              <LogOut size={14} />
              <span>Sign Out Instead</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
