import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  File, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  ShieldCheck,
  Tag,
  Users,
  Globe,
  Plus
} from 'lucide-react';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { buildApiUrl } from '../../config/api';
import './UploadModal.css';

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.bin', '.msi', '.vbs', '.ps1'];

export function UploadModal({ isOpen, onClose, onUploadSuccess, onOpenAuth }) {
  const { user, token } = useAuth();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState('private'); // 'private' | 'selected_users' | 'all_authenticated_users'
  const [recipients, setRecipients] = useState([]);
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [selectedUserEmail, setSelectedUserEmail] = useState('');
  const [permissionLevel, setPermissionLevel] = useState('read');
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Fetch directory users for recipient selection
  useEffect(() => {
    if (!isOpen || !token) return;
    const fetchDirectory = async () => {
      try {
        const res = await fetch(buildApiUrl('/documents/users/directory'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setDirectoryUsers(data.users || []);
        }
      } catch (err) {
        console.error('[UploadModal] Failed to fetch users directory:', err);
      }
    };
    fetchDirectory();
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleFileSelection = (file) => {
    setError(null);
    if (!file) return;

    // Check size limit (25MB)
    if (file.size > MAX_SIZE_BYTES) {
      setError(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 25 MB private storage limit.`);
      return;
    }

    // Check prohibited extensions
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      setError(`Files with extension ${ext} are restricted for organizational security.`);
      return;
    }

    setSelectedFile(file);
    if (!title) {
      // Pre-fill title without extension
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setTitle(baseName);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleAddRecipient = () => {
    if (!selectedUserEmail) return;
    const existing = recipients.find(
      (r) => r.email.toLowerCase() === selectedUserEmail.toLowerCase()
    );
    if (existing) {
      setError('This user is already added to the recipient list.');
      return;
    }
    const dirUser = directoryUsers.find(
      (u) => u.email.toLowerCase() === selectedUserEmail.toLowerCase()
    );
    const newRecipient = {
      email: selectedUserEmail,
      name: dirUser ? dirUser.name : selectedUserEmail.split('@')[0],
      permissionLevel: permissionLevel,
    };
    setRecipients([...recipients, newRecipient]);
    setSelectedUserEmail('');
    setPermissionLevel('read');
    setError(null);
  };

  const handleRemoveRecipient = (emailToRemove) => {
    setRecipients(recipients.filter((r) => r.email.toLowerCase() !== emailToRemove.toLowerCase()));
  };

  const handleReset = () => {
    setSelectedFile(null);
    setTitle('');
    setDescription('');
    setTags('');
    setVisibility('private');
    setRecipients([]);
    setSelectedUserEmail('');
    setPermissionLevel('read');
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a document to upload.');
      return;
    }

    if (!user || !token) {
      setError('You must be signed in to upload documents to the vault.');
      return;
    }

    if (visibility === 'selected_users' && recipients.length === 0) {
      setError('Please select and add at least one recipient collaborator, or change visibility to Private.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', title.trim() || selectedFile.name);
      formData.append('description', description.trim());
      if (tags.trim()) {
        formData.append('tags', tags.trim());
      }
      formData.append('visibility', visibility);
      if (visibility === 'selected_users' && recipients.length > 0) {
        formData.append('recipients', JSON.stringify(recipients));
      }

      const response = await fetch(buildApiUrl('/documents'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to upload document.');
      }

      setSuccess(true);
      setTimeout(() => {
        if (onUploadSuccess) {
          onUploadSuccess(data.document);
        }
        handleClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Network error connecting to TrustVault API.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-modal-overlay" onClick={handleClose} role="presentation">
      <div 
        className="upload-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="upload-modal-header">
          <div className="upload-modal-title-area">
            <span className="upload-badge">
              <ShieldCheck size={13} />
              Private Storage Ingestion
            </span>
            <h2 id="upload-modal-title" className="upload-modal-title">Upload Confidential Document</h2>
            <p className="upload-modal-subtitle">
              Files are stored outside public web roots with UUID isolation and forced attachment download.
            </p>
          </div>
          <button 
            type="button" 
            className="upload-modal-close" 
            onClick={handleClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {!user ? (
          <div className="upload-unauth-box">
            <Lock size={32} className="unauth-icon" />
            <h3>Authentication Required</h3>
            <p>You must be authenticated with an active session to upload private documents.</p>
            <div className="unauth-actions">
              <Button 
                variant="primary" 
                onClick={() => {
                  handleClose();
                  if (onOpenAuth) onOpenAuth();
                }}
              >
                Sign In to Vault
              </Button>
            </div>
          </div>
        ) : success ? (
          <div className="upload-success-box">
            <CheckCircle2 size={48} className="success-icon" />
            <h3>Document Ingested Successfully</h3>
            <p>Metadata has been indexed in the database and binary quarantined in private storage.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="upload-modal-form">
            {error && (
              <div className="upload-error-banner" role="alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Dropzone */}
            <div 
              className={`upload-dropzone ${dragOver ? 'dropzone-active' : ''} ${selectedFile ? 'dropzone-has-file' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelection(e.target.files[0]);
                  }
                }}
              />

              {selectedFile ? (
                <div className="selected-file-preview">
                  <div className="file-avatar">
                    <File size={28} />
                  </div>
                  <div className="file-meta">
                    <span className="file-name">{selectedFile.name}</span>
                    <span className="file-size">
                      {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'Binary Document'}
                    </span>
                  </div>
                  <button 
                    type="button" 
                    className="remove-file-btn" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    title="Remove selected file"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="dropzone-empty-prompt">
                  <UploadCloud size={40} className="upload-icon" />
                  <p className="prompt-primary">
                    Drag and drop file here, or <span>browse local files</span>
                  </p>
                  <p className="prompt-secondary">
                    Supports PDF, DOCX, XLSX, Images, and Text up to 25 MB
                  </p>
                </div>
              )}
            </div>

            {/* Form Fields */}
            <div className="upload-fields-grid">
              <div className="form-group">
                <label htmlFor="doc-title" className="form-label">
                  Document Title <span className="required">*</span>
                </label>
                <input 
                  id="doc-title"
                  type="text"
                  required
                  placeholder="e.g. Q3 Financial Statement"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="form-input"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="doc-tags" className="form-label">
                  Tags (comma separated)
                </label>
                <div className="input-with-icon">
                  <Tag size={15} className="input-icon" />
                  <input 
                    id="doc-tags"
                    type="text"
                    placeholder="e.g. finance, audit, compliance"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="form-input"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label htmlFor="doc-description" className="form-label">
                  Description / Classification Notes
                </label>
                <textarea 
                  id="doc-description"
                  rows={2}
                  placeholder="Optional internal context or handling classification..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-textarea"
                  disabled={loading}
                />
              </div>

              {/* Phase 5: Who can access this document? */}
              <div className="form-group full-width visibility-section">
                <label className="form-label">
                  Who can access this document? <span className="required">*</span>
                </label>
                <div className="visibility-options-grid">
                  {/* Option 1: Private — Only Me */}
                  <div 
                    className={`visibility-card ${visibility === 'private' ? 'active' : ''}`}
                    onClick={() => setVisibility('private')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setVisibility('private'); }}
                  >
                    <div className="visibility-card-header">
                      <div className="visibility-card-radio">
                        <input 
                          type="radio" 
                          id="vis-private" 
                          name="document-visibility" 
                          value="private" 
                          checked={visibility === 'private'} 
                          onChange={() => setVisibility('private')} 
                        />
                      </div>
                      <div className="visibility-card-icon">
                        <Lock size={16} />
                      </div>
                      <span className="visibility-card-title">Private — Only Me</span>
                    </div>
                    <p className="visibility-card-desc">
                      Default option. Strictly restricted to you as the document owner. Inaccessible to all other users.
                    </p>
                  </div>

                  {/* Option 2: Share with Specific Users */}
                  <div 
                    className={`visibility-card ${visibility === 'selected_users' ? 'active' : ''}`}
                    onClick={() => setVisibility('selected_users')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setVisibility('selected_users'); }}
                  >
                    <div className="visibility-card-header">
                      <div className="visibility-card-radio">
                        <input 
                          type="radio" 
                          id="vis-selected" 
                          name="document-visibility" 
                          value="selected_users" 
                          checked={visibility === 'selected_users'} 
                          onChange={() => setVisibility('selected_users')} 
                        />
                      </div>
                      <div className="visibility-card-icon">
                        <Users size={16} />
                      </div>
                      <span className="visibility-card-title">Share with Specific Users</span>
                    </div>
                    <p className="visibility-card-desc">
                      Select registered team members and assign explicit Read or Edit permissions on this document.
                    </p>
                  </div>

                  {/* Option 3: Share with All Registered Users */}
                  <div 
                    className={`visibility-card ${visibility === 'all_authenticated_users' ? 'active' : ''}`}
                    onClick={() => setVisibility('all_authenticated_users')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setVisibility('all_authenticated_users'); }}
                  >
                    <div className="visibility-card-header">
                      <div className="visibility-card-radio">
                        <input 
                          type="radio" 
                          id="vis-all" 
                          name="document-visibility" 
                          value="all_authenticated_users" 
                          checked={visibility === 'all_authenticated_users'} 
                          onChange={() => setVisibility('all_authenticated_users')} 
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

                {/* Recipient Picker if Share with Specific Users is selected */}
                {visibility === 'selected_users' && (
                  <div className="recipient-selector-area">
                    <div className="recipient-picker-header">
                      <span>Add Collaborators</span>
                      <span className="recipient-count-badge">{recipients.length} added</span>
                    </div>
                    <div className="recipient-selector-row">
                      <select 
                        id="recipient-user-select"
                        className="form-select recipient-user-dropdown"
                        value={selectedUserEmail}
                        onChange={(e) => setSelectedUserEmail(e.target.value)}
                        disabled={loading}
                      >
                        <option value="">Select registered user...</option>
                        {directoryUsers
                          .filter((u) => !recipients.some((r) => r.email.toLowerCase() === u.email.toLowerCase()))
                          .map((u) => (
                            <option key={u.id || u.email} value={u.email}>
                              {u.name} ({u.email}) — {u.role}
                            </option>
                          ))}
                      </select>

                      <select 
                        className="form-select recipient-perm-dropdown"
                        value={permissionLevel}
                        onChange={(e) => setPermissionLevel(e.target.value)}
                        disabled={loading}
                      >
                        <option value="read">Read Only</option>
                        <option value="edit">Can Edit</option>
                      </select>

                      <Button 
                        type="button" 
                        variant="secondary" 
                        onClick={handleAddRecipient}
                        disabled={!selectedUserEmail || loading}
                      >
                        <Plus size={14} /> Add
                      </Button>
                    </div>

                    {recipients.length > 0 && (
                      <div className="recipients-list-chips">
                        {recipients.map((rec) => (
                          <div key={rec.email} className="recipient-chip">
                            <span className="recipient-chip-name">{rec.name || rec.email}</span>
                            <span className={`recipient-chip-badge badge-${rec.permissionLevel}`}>
                              {rec.permissionLevel === 'edit' ? 'Can Edit' : 'Read'}
                            </span>
                            <button 
                              type="button" 
                              className="recipient-chip-remove"
                              onClick={() => handleRemoveRecipient(rec.email)}
                              title={`Remove ${rec.email}`}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="upload-modal-footer">
              <Button variant="secondary" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button 
                variant="primary" 
                type="submit" 
                disabled={!selectedFile || !title.trim() || loading}
              >
                {loading ? 'Uploading & Encrypting...' : 'Upload to Vault'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
