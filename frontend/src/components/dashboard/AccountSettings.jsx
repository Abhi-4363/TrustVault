import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Key, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Mail, 
  Shield, 
  Clock, 
  Check, 
  X,
  RefreshCw
} from 'lucide-react';
import { Button } from '../common/Button';
import './AccountSettings.css';

export function AccountSettings({ user, token, onLogout, onCheckApprovalStatus, refreshingStatus, approvalNotice }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password rules checks
  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const isFormValid = hasMinLength && hasLetter && hasNumber && passwordsMatch && currentPassword.length > 0;

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (!isFormValid) {
      setError('Please satisfy all password complexity rules before submitting.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password cannot be identical to your current password.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/change-password', {
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to update password.');
      }

      setSuccess('Your password has been changed successfully. Use your new password for future sign-ins.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Error updating password. Please verify current credentials.');
    } finally {
      setLoading(false);
    }
  };

  const roleLabel = user?.role === 'admin'
    ? 'Administrator'
    : user?.role === 'owner'
      ? 'Document Owner'
      : 'Viewer';

  const roleClass = user?.role === 'admin'
    ? 'role-admin'
    : user?.role === 'owner'
      ? 'role-owner'
      : 'role-viewer';

  return (
    <div className="account-settings-container">
      {/* Section 1: User Identity & Profile */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="header-icon-box">
            <User size={20} className="header-icon" />
          </div>
          <div>
            <h2 className="settings-card-title">User Identity & Access Governance</h2>
            <p className="settings-card-subtitle">
              Verified identity parameters and tenant authorization credentials
            </p>
          </div>
        </div>

        <div className="settings-card-body">
          <div className="profile-details-grid">
            <div className="profile-field">
              <span className="field-label">Full Name</span>
              <span className="field-value"><strong>{user?.name}</strong></span>
            </div>

            <div className="profile-field">
              <span className="field-label">Email Address</span>
              <span className="field-value"><code>{user?.email}</code></span>
            </div>

            <div className="profile-field">
              <span className="field-label">Effective Global Role</span>
              <span className="field-value">
                <span className={`user-role-badge ${roleClass}`}>{roleLabel}</span>
              </span>
            </div>

            <div className="profile-field">
              <span className="field-label">Requested Account Type</span>
              <span className="field-value">
                {user?.requestedRole === 'owner' ? 'Document Owner' : 'Viewer'}
              </span>
            </div>

            <div className="profile-field">
              <span className="field-label">Owner Approval Status</span>
              <span className="field-value">
                {user?.ownerApprovalStatus === 'pending' ? (
                  <span className="status-badge-pending">
                    <Clock size={12} /> Pending Admin Review
                  </span>
                ) : user?.ownerApprovalStatus === 'approved' ? (
                  <span className="status-badge-approved">
                    <Check size={12} /> Approved
                  </span>
                ) : user?.ownerApprovalStatus === 'rejected' ? (
                  <span className="status-badge-rejected">
                    <X size={12} /> Declined
                  </span>
                ) : (
                  <span className="status-badge-neutral">Standard</span>
                )}
              </span>
            </div>

            <div className="profile-field">
              <span className="field-label">Account Status</span>
              <span className="field-value">
                <span className="status-badge-active">Active</span>
              </span>
            </div>
          </div>

          {approvalNotice && (
            <div className="approval-notice-banner" role="status">
              <CheckCircle2 size={16} />
              <span>{approvalNotice}</span>
            </div>
          )}

          {user?.ownerApprovalStatus === 'pending' && onCheckApprovalStatus && (
            <div className="approval-check-action">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={onCheckApprovalStatus}
                disabled={refreshingStatus}
              >
                <RefreshCw size={13} className={refreshingStatus ? 'spinning' : ''} />
                <span>{refreshingStatus ? 'Checking Status...' : 'Check Approval Status'}</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Change Password */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="header-icon-box">
            <Key size={20} className="header-icon" />
          </div>
          <div>
            <h2 className="settings-card-title">Change Account Password</h2>
            <p className="settings-card-subtitle">
              Update your corporate credentials. Password hashes are generated using bcrypt (12 rounds).
            </p>
          </div>
        </div>

        <div className="settings-card-body">
          {error && (
            <div className="settings-error-banner" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="settings-success-banner" role="status">
              <CheckCircle2 size={16} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="change-password-form">
            {/* Current Password */}
            <div className="form-group">
              <label htmlFor="settings-current-pwd" className="form-label">
                Current Password <span className="required">*</span>
              </label>
              <div className="password-input-wrapper">
                <input
                  id="settings-current-pwd"
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter current password..."
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="form-input"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="pwd-toggle-btn"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="form-group">
              <label htmlFor="settings-new-pwd" className="form-label">
                New Password <span className="required">*</span>
              </label>
              <div className="password-input-wrapper">
                <input
                  id="settings-new-pwd"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter new password (min. 8 characters)..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="form-input"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="pwd-toggle-btn"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="form-group">
              <label htmlFor="settings-confirm-pwd" className="form-label">
                Confirm New Password <span className="required">*</span>
              </label>
              <div className="password-input-wrapper">
                <input
                  id="settings-confirm-pwd"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Re-enter new password to confirm..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="pwd-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Password Policy Feedback */}
            <div className="password-rules-checklist">
              <span className="checklist-title">Password Requirements:</span>
              <div className="rules-grid">
                <div className={`rule-item ${hasMinLength ? 'rule-passed' : ''}`}>
                  {hasMinLength ? <Check size={13} className="rule-icon" /> : <span className="rule-dot" />}
                  <span>Minimum 8 characters</span>
                </div>
                <div className={`rule-item ${hasLetter ? 'rule-passed' : ''}`}>
                  {hasLetter ? <Check size={13} className="rule-icon" /> : <span className="rule-dot" />}
                  <span>At least one letter (a-z)</span>
                </div>
                <div className={`rule-item ${hasNumber ? 'rule-passed' : ''}`}>
                  {hasNumber ? <Check size={13} className="rule-icon" /> : <span className="rule-dot" />}
                  <span>At least one number (0-9)</span>
                </div>
                <div className={`rule-item ${passwordsMatch ? 'rule-passed' : ''}`}>
                  {passwordsMatch ? <Check size={13} className="rule-icon" /> : <span className="rule-dot" />}
                  <span>Passwords match</span>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <Button
                type="submit"
                variant="primary"
                disabled={!isFormValid || loading}
              >
                {loading ? 'Updating Password...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
