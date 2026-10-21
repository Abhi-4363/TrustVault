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
  Lock 
} from 'lucide-react';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import './ShareModal.css';

export function ShareModal({ isOpen, onClose, document, onPermissionsUpdated }) {
  const { user, token } = useAuth();

  const [permissions, setPermissions] = useState([]);
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [permissionLevel, setPermissionLevel] = useState('read');
  const [loading, setLoading] = useState(false);
  const [granting, setGranting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Fetch permissions and directory when modal opens
  useEffect(() => {
    if (!isOpen || !document || !token) return;

    setError(null);
    setSuccessMsg(null);

    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch directory users
        const dirRes = await fetch('http://localhost:5000/api/documents/users/directory', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (dirRes.ok) {
          const dirData = await dirRes.json();
          setDirectoryUsers(dirData.users || []);
        }

        // If this is a real document, fetch its live ACL
        if (document.isReal) {
          const permRes = await fetch(`http://localhost:5000/api/documents/${document.id}/permissions`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (permRes.ok) {
            const permData = await permRes.json();
            setPermissions(permData.acl || []);
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
    ? document.accessLevel === 'Owner'
    : true; // In demo preview allow trying

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
        const response = await fetch(`http://localhost:5000/api/documents/${document.id}/permissions`, {
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

        setPermissions(data.acl || []);
        setSuccessMsg(`Granted '${permissionLevel}' access to ${selectedEmail}.`);
        setSelectedEmail('');
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
          `http://localhost:5000/api/documents/${document.id}/permissions/${targetUserId}`,
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
              Stage 4 Access Control
            </span>
            <h2 id="share-modal-title" className="share-modal-title">
              Manage Access: {document.name}
            </h2>
            <p className="share-modal-subtitle">
              Grant granular Read or Edit privileges and enforce real-time revocation boundaries.
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

          {/* Add Collaborator Form */}
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
                <span>This document is strictly private to the owner.</span>
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
