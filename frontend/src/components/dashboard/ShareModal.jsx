import React, { useState, useEffect } from 'react';
import { 
  Share2, 
  UserPlus, 
  Trash2, 
  ShieldCheck, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Users, 
  Lock,
  Globe,
  Save,
  RefreshCw
} from 'lucide-react';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { buildApiUrl } from '../../config/api';
import './ShareModal.css';

export function ShareModal({ isOpen, onClose, document, onPermissionsUpdated }) {
  const { user, token } = useAuth();

  const [currentVisibility, setCurrentVisibility] = useState('private');
  const [selectedVisibility, setSelectedVisibility] = useState('private');
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [permissionLevel, setPermissionLevel] = useState('read');
  const [loading, setLoading] = useState(false);
  const [granting, setGranting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Fetch permissions, live visibility, and directory when modal opens
  useEffect(() => {
    if (!isOpen || !document || !token) return;

    setError(null);
    setSuccessMsg(null);

    const docVis = document.visibility || 'private';
    const normalizedVis = docVis === 'specific_users' ? 'selected_users' : docVis;
    setCurrentVisibility(normalizedVis);
    setSelectedVisibility(normalizedVis);

    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch directory users
        const dirRes = await fetch(buildApiUrl('/documents/users/directory'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (dirRes.ok) {
          const dirData = await dirRes.json();
          setDirectoryUsers(dirData.users || []);
        }

        // If this is a real document, fetch its live ACL and visibility
        if (document.isReal) {
          const permRes = await fetch(buildApiUrl(`/documents/${document.id}/permissions`), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (permRes.ok) {
            const permData = await permRes.json();
            setPermissions(permData.acl || []);
            if (permData.visibility) {
              const liveVis = permData.visibility === 'specific_users' ? 'selected_users' : permData.visibility;
              setCurrentVisibility(liveVis);
              setSelectedVisibility(liveVis);
            }
          }
        } else {
          // For demonstration items, use mock initial collaborators
          setPermissions([
            {
              userId: 'demo_user_1',
              name: 'Sarah Connor',
              email: 'sarah.c@company.internal',
              permissionLevel: 'read',
              grantedAt: new Date(),
            },
            {
              userId: 'demo_user_2',
              name: 'David Vance',
              email: 'david.v@company.internal',
              permissionLevel: 'edit',
              grantedAt: new Date(),
            },
          ]);
        }
      } catch (err) {
        console.error('[ShareModal Error]', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, document, token]);

  if (!isOpen || !document) return null;

  const isOwner = document.isReal
    ? document.accessLevel === 'Owner' || user?.role === 'admin'
    : true; // In demo preview allow trying

  const getVisibilityLabel = (vis) => {
    switch (vis) {
      case 'selected_users':
      case 'specific_users':
        return 'Share with Specific Users';
      case 'all_authenticated_users':
        return 'Share with All Registered Users';
      case 'private':
      default:
        return 'Private — Only Me';
    }
  };

  // Persist visibility changes through PATCH /api/documents/:id/visibility
  const handleSaveVisibility = async () => {
    if (selectedVisibility === currentVisibility) return;

    setSavingVisibility(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (document.isReal) {
        const response = await fetch(buildApiUrl(`/documents/${document.id}/visibility`), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ visibility: selectedVisibility }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to update document visibility.');
        }

        setCurrentVisibility(selectedVisibility);

        if (selectedVisibility === 'private') {
          setPermissions([]);
          setSuccessMsg("Document visibility updated to 'Private — Only Me'. Collaborator access has been revoked.");
        } else if (selectedVisibility === 'all_authenticated_users') {
          setSuccessMsg("Document visibility updated to 'Share with All Registered Users' (Read-Only access for authenticated users).");
        } else {
          setSuccessMsg("Document visibility updated to 'Share with Specific Users'. You can manage individual collaborator permissions below.");
        }

        if (onPermissionsUpdated) {
          onPermissionsUpdated();
        }
      } else {
        // Demo simulation
        setCurrentVisibility(selectedVisibility);
        if (selectedVisibility === 'private') {
          setPermissions([]);
        }
        setSuccessMsg(`[Simulation] Visibility updated to ${getVisibilityLabel(selectedVisibility)}.`);
      }
    } catch (err) {
      setError(err.message || 'Error updating document visibility.');
    } finally {
      setSavingVisibility(false);
    }
  };

  const handleGrant = async (e) => {
    e.preventDefault();
    if (!selectedEmail.trim()) {
      setError('Please select or enter a collaborator email.');
      return;
    }

    setGranting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (document.isReal) {
        const response = await fetch(buildApiUrl(`/documents/${document.id}/permissions`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: selectedEmail.trim(),
            permissionLevel,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to grant permission.');
        }

        const label = permissionLevel === 'edit' ? 'Can Edit' : 'Can Read';
        setSuccessMsg(`Successfully granted '${label}' access to ${selectedEmail}.`);
        setSelectedEmail('');
        setPermissions(data.acl || []);

        if (currentVisibility === 'private') {
          setCurrentVisibility('selected_users');
          setSelectedVisibility('selected_users');
        }

        if (onPermissionsUpdated) onPermissionsUpdated();
      } else {
        // Demo simulation
        const newEntry = {
          userId: `sim_${Date.now()}`,
          name: selectedEmail.split('@')[0],
          email: selectedEmail.trim(),
          permissionLevel,
          grantedAt: new Date(),
        };
        setPermissions((prev) => [...prev, newEntry]);
        if (currentVisibility === 'private') {
          setCurrentVisibility('selected_users');
          setSelectedVisibility('selected_users');
        }
        setSuccessMsg(`[Simulation] Granted '${permissionLevel}' access to ${selectedEmail}.`);
        setSelectedEmail('');
      }
    } catch (err) {
      setError(err.message || 'Error updating access control.');
    } finally {
      setGranting(false);
    }
  };

  const handleRevoke = async (targetUserId, targetEmail) => {
    setError(null);
    setSuccessMsg(null);

    try {
      if (document.isReal) {
        const response = await fetch(
          buildApiUrl(`/documents/${document.id}/permissions/${targetUserId}`),
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to revoke access.');
        }

        setPermissions(data.acl || []);
        setSuccessMsg(`Immediately revoked access for ${targetEmail}.`);
        if (onPermissionsUpdated) onPermissionsUpdated();
      } else {
        // Demo simulation
        setPermissions((prev) => prev.filter((p) => p.userId !== targetUserId));
        setSuccessMsg(`[Simulation] Revoked access for ${targetEmail}.`);
      }
    } catch (err) {
      setError(err.message || 'Failed to revoke access.');
    }
  };

  return (
    <div className="share-modal-overlay" onClick={onClose} role="presentation">
      <div 
        className="share-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="share-modal-header">
          <div className="share-modal-title-area">
            <span className="share-badge">
              <Share2 size={13} />
              Manage Access
            </span>
            <h2 id="share-modal-title" className="share-modal-title">
              Manage Access: {document.name || document.title}
            </h2>
            <p className="share-modal-subtitle">
              Configure visibility boundaries and grant granular Read or Edit privileges.
            </p>
          </div>
          <button 
            type="button" 
            className="share-modal-close" 
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="share-modal-body">
          {error && (
            <div className="share-alert-banner alert-error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="share-alert-banner alert-success" role="status">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Visibility Selection Section (Same 3 options as Upload) */}
          <div className="share-visibility-section">
            <label className="share-section-label">
              Who can access this document? <span className="required">*</span>
            </label>
            <div className="visibility-options-grid">
              {/* Option 1: Private — Only Me */}
              <div 
                className={`visibility-card ${selectedVisibility === 'private' ? 'active' : ''}`}
                onClick={() => setSelectedVisibility('private')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedVisibility('private'); }}
              >
                <div className="visibility-card-header">
                  <div className="visibility-card-radio">
                    <input 
                      type="radio" 
                      id="share-vis-private" 
                      name="share-document-visibility" 
                      value="private" 
                      checked={selectedVisibility === 'private'} 
                      onChange={() => setSelectedVisibility('private')} 
                    />
                  </div>
                  <div className="visibility-card-icon">
                    <Lock size={16} />
                  </div>
                  <span className="visibility-card-title">Private — Only Me</span>
                </div>
                <p className="visibility-card-desc">
                  Only the owner can access the document, subject to explicitly authorized application policies.
                </p>
              </div>

              {/* Option 2: Share with Specific Users */}
              <div 
                className={`visibility-card ${selectedVisibility === 'selected_users' ? 'active' : ''}`}
                onClick={() => setSelectedVisibility('selected_users')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedVisibility('selected_users'); }}
              >
                <div className="visibility-card-header">
                  <div className="visibility-card-radio">
                    <input 
                      type="radio" 
                      id="share-vis-selected" 
                      name="share-document-visibility" 
                      value="selected_users" 
                      checked={selectedVisibility === 'selected_users'} 
                      onChange={() => setSelectedVisibility('selected_users')} 
                    />
                  </div>
                  <div className="visibility-card-icon">
                    <Users size={16} />
                  </div>
                  <span className="visibility-card-title">Share with Specific Users</span>
                </div>
                <p className="visibility-card-desc">
                  Select registered users by name or email. Assign Read or Edit permissions individually.
                </p>
              </div>

              {/* Option 3: Share with All Registered Users */}
              <div 
                className={`visibility-card ${selectedVisibility === 'all_authenticated_users' ? 'active' : ''}`}
                onClick={() => setSelectedVisibility('all_authenticated_users')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedVisibility('all_authenticated_users'); }}
              >
                <div className="visibility-card-header">
                  <div className="visibility-card-radio">
                    <input 
                      type="radio" 
                      id="share-vis-all" 
                      name="share-document-visibility" 
                      value="all_authenticated_users" 
                      checked={selectedVisibility === 'all_authenticated_users'} 
                      onChange={() => setSelectedVisibility('all_authenticated_users')} 
                    />
                  </div>
                  <div className="visibility-card-icon">
                    <Globe size={16} />
                  </div>
                  <span className="visibility-card-title">Share with All Registered Users</span>
                </div>
                <p className="visibility-card-desc">
                  Available to all authenticated TrustVault accounts (Read-Only). Protected from unauthenticated public access.
                </p>
              </div>
            </div>

            {/* Unsaved Visibility Changes Action Bar */}
            {selectedVisibility !== currentVisibility && isOwner && (
              <div className="visibility-change-alert">
                <div className="change-alert-content">
                  <strong>Pending Visibility Policy Change</strong>
                  <span>
                    Switch access policy from <em>{getVisibilityLabel(currentVisibility)}</em> to <em>{getVisibilityLabel(selectedVisibility)}</em>.
                    {selectedVisibility === 'private' && ' This will immediately revoke all current collaborator grants.'}
                  </span>
                </div>
                <div className="change-alert-actions">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => setSelectedVisibility(currentVisibility)}
                    disabled={savingVisibility}
                  >
                    Discard
                  </Button>
                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={handleSaveVisibility}
                    disabled={savingVisibility}
                  >
                    {savingVisibility ? 'Applying Change...' : 'Save Visibility'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Contextual Body Content Based on Visibility */}
          {selectedVisibility === 'private' ? (
            <div className="share-info-card share-card-private">
              <div className="info-card-header">
                <Lock size={18} className="info-card-icon" />
                <h5 className="info-card-title">Strictly Private Document</h5>
              </div>
              <p className="info-card-text">
                Only you (the document owner) and platform administrators have access to view, search, or stream-download this document.
                To collaborate, select <strong>Share with Specific Users</strong> or <strong>Share with All Registered Users</strong> above and click Save Visibility.
              </p>
            </div>
          ) : selectedVisibility === 'all_authenticated_users' ? (
            <>
              <div className="share-info-card share-card-all-users">
                <div className="info-card-header">
                  <Globe size={18} className="info-card-icon" />
                  <h5 className="info-card-title">Platform-Wide Authenticated Access (Read-Only)</h5>
                </div>
                <p className="info-card-text">
                  All authenticated TrustVault accounts have Read permissions to search, view, and stream this document.
                  Unauthenticated public access is strictly forbidden. You can also assign explicit Edit permissions to named team members below.
                </p>
              </div>

              {isOwner && (
                <form onSubmit={handleGrant} className="share-grant-form">
                  <h4 className="share-section-title">
                    <UserPlus size={16} />
                    Assign Named Collaborator / Editor
                  </h4>

                  <div className="share-input-row">
                    <div className="share-input-wrapper">
                      <input 
                        type="email"
                        list="directory-emails"
                        placeholder="Enter colleague email (e.g. bob@company.com)..."
                        value={selectedEmail}
                        onChange={(e) => setSelectedEmail(e.target.value)}
                        className="share-email-input"
                        disabled={granting}
                      />
                      <datalist id="directory-emails">
                        {directoryUsers.map((u) => {
                          const roleLabel = u.role === 'admin' ? 'Admin' : (u.role === 'viewer' || u.role === 'member') ? 'Viewer' : 'Document Owner';
                          return (
                            <option key={u.id} value={u.email}>
                              {u.name} ({roleLabel})
                            </option>
                          );
                        })}
                      </datalist>
                    </div>

                    <select 
                      value={permissionLevel}
                      onChange={(e) => setPermissionLevel(e.target.value)}
                      className="share-level-select"
                      disabled={granting}
                    >
                      <option value="edit">Can Edit (Editor)</option>
                      <option value="read">Can Read (Viewer)</option>
                    </select>

                    <Button variant="primary" type="submit" disabled={!selectedEmail.trim() || granting}>
                      {granting ? 'Granting...' : 'Grant Access'}
                    </Button>
                  </div>
                </form>
              )}

              {/* Named Collaborators List */}
              <div className="share-list-section">
                <h4 className="share-section-title">
                  <Users size={16} />
                  Explicit Collaborators & Editors ({permissions.length})
                </h4>

                {loading ? (
                  <p className="share-loading-text">Loading access control rules...</p>
                ) : permissions.length === 0 ? (
                  <div className="share-empty-box">
                    <Users size={24} className="share-empty-icon" />
                    <p>No individual editor grants.</p>
                    <span>All authenticated users have default Read-only access.</span>
                  </div>
                ) : (
                  <ul className="share-collaborator-list">
                    {permissions.map((perm) => (
                      <li key={perm.userId || perm.email} className="share-collaborator-item">
                        <div className="collab-info">
                          <span className="collab-avatar">
                            {(perm.name || perm.email || 'U')[0].toUpperCase()}
                          </span>
                          <div className="collab-text">
                            <span className="collab-name">{perm.name || perm.email.split('@')[0]}</span>
                            <span className="collab-email">{perm.email}</span>
                          </div>
                        </div>

                        <div className="collab-actions">
                          <span className={`collab-pill pill-${perm.permissionLevel}`}>
                            {perm.permissionLevel === 'edit' ? 'Can Edit' : 'Can Read'}
                          </span>

                          {isOwner && (
                            <button
                              type="button"
                              className="revoke-btn"
                              onClick={() => handleRevoke(perm.userId, perm.email)}
                              title={`Revoke access for ${perm.email}`}
                              aria-label={`Revoke access for ${perm.email}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Add Collaborator Form for Specific Users */}
              {isOwner && (
                <form onSubmit={handleGrant} className="share-grant-form">
                  <h4 className="share-section-title">
                    <UserPlus size={16} />
                    Add Named Collaborator
                  </h4>

                  <div className="share-input-row">
                    <div className="share-input-wrapper">
                      <input 
                        type="email"
                        list="directory-emails"
                        placeholder="Enter colleague email (e.g. bob@company.com)..."
                        value={selectedEmail}
                        onChange={(e) => setSelectedEmail(e.target.value)}
                        className="share-email-input"
                        disabled={granting}
                      />
                      <datalist id="directory-emails">
                        {directoryUsers.map((u) => {
                          const roleLabel = u.role === 'admin' ? 'Admin' : (u.role === 'viewer' || u.role === 'member') ? 'Viewer' : 'Document Owner';
                          return (
                            <option key={u.id} value={u.email}>
                              {u.name} ({roleLabel})
                            </option>
                          );
                        })}
                      </datalist>
                    </div>

                    <select 
                      value={permissionLevel}
                      onChange={(e) => setPermissionLevel(e.target.value)}
                      className="share-level-select"
                      disabled={granting}
                    >
                      <option value="read">Can Read (Viewer)</option>
                      <option value="edit">Can Edit (Editor)</option>
                    </select>

                    <Button variant="primary" type="submit" disabled={!selectedEmail.trim() || granting}>
                      {granting ? 'Granting...' : 'Grant Access'}
                    </Button>
                  </div>
                </form>
              )}

              {/* Current Collaborators List */}
              <div className="share-list-section">
                <h4 className="share-section-title">
                  <Users size={16} />
                  Authorized Collaborators ({permissions.length})
                </h4>

                {loading ? (
                  <p className="share-loading-text">Loading access control rules...</p>
                ) : permissions.length === 0 ? (
                  <div className="share-empty-box">
                    <Lock size={24} className="share-empty-icon" />
                    <p>No collaborators have been granted access yet.</p>
                    <span>Add registered users above to grant granular Read or Edit access.</span>
                  </div>
                ) : (
                  <ul className="share-collaborator-list">
                    {permissions.map((perm) => (
                      <li key={perm.userId || perm.email} className="share-collaborator-item">
                        <div className="collab-info">
                          <span className="collab-avatar">
                            {(perm.name || perm.email || 'U')[0].toUpperCase()}
                          </span>
                          <div className="collab-text">
                            <span className="collab-name">{perm.name || perm.email.split('@')[0]}</span>
                            <span className="collab-email">{perm.email}</span>
                          </div>
                        </div>

                        <div className="collab-actions">
                          <span className={`collab-pill pill-${perm.permissionLevel}`}>
                            {perm.permissionLevel === 'edit' ? 'Can Edit' : 'Can Read'}
                          </span>

                          {isOwner && (
                            <button
                              type="button"
                              className="revoke-btn"
                              onClick={() => handleRevoke(perm.userId, perm.email)}
                              title={`Revoke access for ${perm.email}`}
                              aria-label={`Revoke access for ${perm.email}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        <div className="share-modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
