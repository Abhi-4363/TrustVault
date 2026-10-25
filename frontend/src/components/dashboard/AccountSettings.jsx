import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Mail, 
  Clock, 
  Check, 
  X,
  RefreshCw,
  Edit2,
  Calendar,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { buildApiUrl } from '../../config/api';
import './AccountSettings.css';

export function AccountSettings({ 
  user, 
  token, 
  onLogout, 
  onCheckApprovalStatus, 
  refreshingStatus, 
  approvalNotice,
  activeNav = 'settings',
  onProfileUpdated,
}) {
  const { updateProfile } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Profile Edit States
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [isEditingDob, setIsEditingDob] = useState(false);
  const [editDob, setEditDob] = useState(user?.dateOfBirth || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  useEffect(() => {
    if (user?.name && !isEditingName) {
      setEditName(user.name);
    }
    if (user?.dateOfBirth && !isEditingDob) {
      setEditDob(user.dateOfBirth);
    }
  }, [user, isEditingName, isEditingDob]);

  const calculateAge = (dobString) => {
    if (!dobString) return null;
    const parts = dobString.split('-').map(Number);
    if (parts.length !== 3) return null;
    const [year, month, day] = parts;
    const birthDate = new Date(year, month - 1, day);
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

  const handleSaveName = async () => {
    setProfileError('');
    setProfileSuccess('');

    const trimmed = editName.trim();
    if (!trimmed || trimmed.length < 2) {
      setProfileError('Full name is required and must be at least 2 characters.');
      return;
    }
    if (trimmed.length > 50) {
      setProfileError('Full name cannot exceed 50 characters.');
      return;
    }
    if (/[<>]/.test(trimmed)) {
      setProfileError('Full name contains invalid characters.');
      return;
    }

    if (trimmed === user?.name) {
      setIsEditingName(false);
      return;
    }

    setProfileSaving(true);
    try {
      const updated = await updateProfile({ name: trimmed });
      setProfileSuccess('Profile name updated successfully.');
      setIsEditingName(false);
      onProfileUpdated?.(updated);
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile name.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCancelName = () => {
    setEditName(user?.name || '');
    setIsEditingName(false);
    setProfileError('');
  };

  const handleSaveDob = async () => {
    setProfileError('');
    setProfileSuccess('');

    if (!editDob) {
      setProfileError('Date of birth is required.');
      return;
    }

    const age = calculateAge(editDob);
    if (age === -1) {
      setProfileError('Date of birth cannot be in the future.');
      return;
    }
    if (age === null || isNaN(age)) {
      setProfileError('Please provide a valid calendar date of birth.');
      return;
    }
    if (age < 13) {
      setProfileError('You must be at least 13 years old.');
      return;
    }

    if (editDob === user?.dateOfBirth) {
      setIsEditingDob(false);
      return;
    }

    setProfileSaving(true);
    try {
      const updated = await updateProfile({ dateOfBirth: editDob });
      setProfileSuccess('Date of birth updated successfully.');
      setIsEditingDob(false);
      onProfileUpdated?.(updated);
    } catch (err) {
      setProfileError(err.message || 'Failed to update date of birth.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCancelDob = () => {
    setEditDob(user?.dateOfBirth || '');
    setIsEditingDob(false);
    setProfileError('');
  };

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
      const response = await fetch(buildApiUrl('/auth/change-password'), {
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

  const isProfileView = activeNav === 'profile';
  const isSettingsView = activeNav === 'settings';

  return (
    <div className="account-settings-container">
      {/* =====================================================================
          Profile View: User Profile & Identity Governance ONLY
          (Strict requirement: Change Password form, button, and shortcuts
          are completely excluded from Profile)
          ===================================================================== */}
      {isProfileView && (
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="header-icon-box">
              <User size={20} className="header-icon" />
            </div>
            <div>
              <h2 className="settings-card-title">User Profile & Identity Governance</h2>
              <p className="settings-card-subtitle">
                Verified account identity parameters, tenant authorization credentials, and status
              </p>
            </div>
          </div>

          <div className="settings-card-body">
            {profileSuccess && (
              <div className="profile-alert-banner success" role="alert">
                <CheckCircle2 size={16} />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="profile-alert-banner error" role="alert">
                <AlertCircle size={16} />
                <span>{profileError}</span>
              </div>
            )}

            <div className="profile-details-grid">
              {/* Full Name with Edit capability */}
              <div className="profile-field profile-field-editable">
                <span className="field-label">Full Name</span>
                {isEditingName ? (
                  <div className="profile-edit-inline-form">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Enter full name"
                      className="form-input profile-inline-input"
                      disabled={profileSaving}
                      maxLength={50}
                      autoFocus
                    />
                    <div className="profile-edit-actions">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSaveName}
                        disabled={profileSaving}
                        className="profile-save-btn"
                      >
                        {profileSaving ? <Loader2 size={13} className="spinning" /> : <Check size={13} />}
                        <span>Save</span>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCancelName}
                        disabled={profileSaving}
                        className="profile-cancel-btn"
                      >
                        <X size={13} />
                        <span>Cancel</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="profile-value-with-action">
                    <span className="field-value profile-name-highlight">
                      <strong>{user?.name}</strong>
                    </span>
                    <button
                      type="button"
                      className="profile-field-edit-btn"
                      onClick={() => {
                        setEditName(user?.name || '');
                        setIsEditingName(true);
                        setProfileError('');
                        setProfileSuccess('');
                      }}
                      title="Edit Full Name"
                      aria-label="Edit Full Name"
                    >
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Email Address (Read-only for security) */}
              <div className="profile-field">
                <span className="field-label">Email Address</span>
                <span className="field-value email-value-wrapper">
                  <code>{user?.email}</code>
                  <span className="field-pill-readonly" title="Email address cannot be changed directly for security reasons">
                    <Lock size={10} /> Read-only
                  </span>
                </span>
              </div>

              {/* Date of Birth with Edit capability */}
              <div className="profile-field profile-field-editable">
                <span className="field-label">Date of Birth</span>
                {isEditingDob ? (
                  <div className="profile-edit-inline-form">
                    <input
                      type="date"
                      value={editDob}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setEditDob(e.target.value)}
                      className="form-input profile-inline-input"
                      disabled={profileSaving}
                      autoFocus
                    />
                    <div className="profile-edit-actions">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSaveDob}
                        disabled={profileSaving}
                        className="profile-save-btn"
                      >
                        {profileSaving ? <Loader2 size={13} className="spinning" /> : <Check size={13} />}
                        <span>Save</span>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCancelDob}
                        disabled={profileSaving}
                        className="profile-cancel-btn"
                      >
                        <X size={13} />
                        <span>Cancel</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="profile-value-with-action">
                    <span className="field-value">
                      {user?.dateOfBirth ? (
                        <span>{user.dateOfBirth}</span>
                      ) : (
                        <span className="text-muted">Not specified</span>
                      )}
                    </span>
                    <button
                      type="button"
                      className="profile-field-edit-btn"
                      onClick={() => {
                        setEditDob(user?.dateOfBirth || '');
                        setIsEditingDob(true);
                        setProfileError('');
                        setProfileSuccess('');
                      }}
                      title="Edit Date of Birth"
                      aria-label="Edit Date of Birth"
                    >
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Effective Global Role */}
              <div className="profile-field">
                <span className="field-label">Effective Global Role</span>
                <span className="field-value">
                  <span className={`user-role-badge ${roleClass}`}>{roleLabel}</span>
                </span>
              </div>

              {/* Requested Account Type */}
              <div className="profile-field">
                <span className="field-label">Requested Account Type</span>
                <span className="field-value">
                  {user?.requestedRole === 'owner' ? 'Document Owner' : 'Viewer'}
                </span>
              </div>

              {/* Owner Approval Status */}
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

              {/* Account Status */}
              <div className="profile-field">
                <span className="field-label">Account Status</span>
                <span className="field-value">
                  <span className="status-badge-active">Active</span>
                </span>
              </div>

              {/* Email Verification Status */}
              <div className="profile-field">
                <span className="field-label">Email Verification</span>
                <span className="field-value">
                  {user?.isEmailVerified !== false ? (
                    <span className="status-badge-approved">
                      <Check size={12} /> Verified
                    </span>
                  ) : (
                    <span className="status-badge-pending">
                      <Clock size={12} /> Pending Verification
                    </span>
                  )}
                </span>
              </div>

              {/* Account Created Date */}
              <div className="profile-field">
                <span className="field-label">Account Created</span>
                <span className="field-value">
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </span>
              </div>

              {/* Terms Acceptance Record */}
              <div className="profile-field">
                <span className="field-label">Governance & Terms Policy</span>
                <span className="field-value terms-accepted-record">
                  <CheckCircle2 size={13} className="terms-icon" />
                  <span>
                    {user?.termsVersionAccepted ? `Terms v${user.termsVersionAccepted}` : 'Standard Policy'}
                    {user?.termsAcceptedAt &&
                      ` (Accepted ${new Date(user.termsAcceptedAt).toLocaleDateString()})`}
                  </span>
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
      )}

      {/* =====================================================================
          Settings View: Dedicated Single Location for Change Password
          (Available to Administrator, Document Owner, and Viewer roles)
          ===================================================================== */}
      {isSettingsView && (
        <>
          {/* Security Overview Card */}
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="header-icon-box">
                <Lock size={20} className="header-icon" />
              </div>
              <div>
                <h2 className="settings-card-title">Account Security Configuration</h2>
                <p className="settings-card-subtitle">
                  Corporate security policies, cryptographic encryption standards, and credential management
                </p>
              </div>
            </div>

            <div className="settings-card-body">
              <div className="profile-details-grid">
                <div className="profile-field">
                  <span className="field-label">Authentication Tier</span>
                  <span className="field-value"><strong>Verified Access Protocol (Active)</strong></span>
                </div>

                <div className="profile-field">
                  <span className="field-label">Password Hashing</span>
                  <span className="field-value"><code>Bcrypt (12 Rounds) & SHA-256</code></span>
                </div>

                <div className="profile-field">
                  <span className="field-label">Session Token Standard</span>
                  <span className="field-value"><code>Signed JWT Bearer Header</code></span>
                </div>

                <div className="profile-field">
                  <span className="field-label">Authorized Role</span>
                  <span className="field-value">
                    <span className={`user-role-badge ${roleClass}`}>{roleLabel}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Change Account Password Section */}
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="header-icon-box">
                <Key size={20} className="header-icon" />
              </div>
              <div>
                <h2 className="settings-card-title">Change Account Password</h2>
                <p className="settings-card-subtitle">
                  Update your corporate credentials. Password hashes are generated securely using bcrypt (12 rounds).
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
        </>
      )}
    </div>
  );
}
