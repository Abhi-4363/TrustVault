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
const ALLOWED_EXTENSIONS = [
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', 
  '.docx', '.xlsx', '.pptx', '.zip', 
  '.txt', '.csv', '.json', '.md', '.log'
];

const MIME_TO_EXTENSION = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/zip': '.zip',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/json': '.json',
  'text/markdown': '.md',
  'text/x-log': '.log',
};

export function UploadModal({ isOpen, onClose, onUploadSuccess, onOpenAuth }) {
  const { user, token } = useAuth();
  const fileInputRef = useRef(null);
  const allFilesInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState('private'); // 'private' | 'selected_users' | 'all_authenticated_users'
  const [recipients, setRecipients] = useState([]);
  const [collaboratorEmail, setCollaboratorEmail] = useState('');
  const [permissionLevel, setPermissionLevel] = useState('read');
  const [validatingCollaborator, setValidatingCollaborator] = useState(false);
  const [collaboratorError, setCollaboratorError] = useState(null);
  const [collaboratorSuccess, setCollaboratorSuccess] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleFileSelection = (rawFile) => {
    setError(null);
    if (!rawFile) return;

    let file = rawFile;
    let fileName = rawFile.name || 'document';

    // Decode URI component if Android provided a content URI or url-encoded name
    try {
      if (fileName.includes('%')) {
        fileName = decodeURIComponent(fileName);
      }
    } catch {
      // ignore
    }

    // Strip out path prefixes if present (e.g. content:// or /storage/emulated/0/...)
    if (fileName.includes('/') || fileName.includes('\\')) {
      fileName = fileName.split(/[/\\]/).pop() || fileName;
    }

    // Determine extension
    let ext = fileName.includes('.') ? ('.' + fileName.split('.').pop().toLowerCase()) : '';

    // Mobile camera/picker fallback: deduce extension if filename lacks one
    if (!ext && file.type && MIME_TO_EXTENSION[file.type]) {
      ext = MIME_TO_EXTENSION[file.type];
      const baseName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'document';
      fileName = `${baseName}${ext}`;
      try {
        file = new File([rawFile], fileName, { type: rawFile.type, lastModified: rawFile.lastModified || Date.now() });
      } catch {
        file = rawFile;
      }
    } else if (fileName !== rawFile.name) {
      try {
        file = new File([rawFile], fileName, { type: rawFile.type, lastModified: rawFile.lastModified || Date.now() });
      } catch {
        file = rawFile;
      }
    }

    // Check size limit (25MB)
    if (file.size > MAX_SIZE_BYTES) {
      setError(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 25 MB private storage limit.`);
      return;
    }

    // Check prohibited extensions
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      setError(`Files with extension ${ext} are restricted for organizational security.`);
      return;
    }

    // Check supported backend extensions
    if (ext && !ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file format '${ext}'. Supported formats: PDF, Word (.docx), Excel (.xlsx), Images (.png, .jpg), Text, and ZIP.`);
      return;
    }

    setSelectedFile(file);
    if (!title) {
      // Pre-fill title without extension
      const baseName = fileName.includes('.')
        ? fileName.substring(0, fileName.lastIndexOf('.'))
        : fileName;
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

  const handleAddRecipient = async () => {
    setCollaboratorError(null);
    setCollaboratorSuccess(null);

    const email = (collaboratorEmail || '').trim();

    // 1. Email format check
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
    if (!email || !emailRegex.test(email) || email.includes('..') || email.endsWith('.')) {
      setCollaboratorError('Please enter a valid email address.');
      return;
    }

    // 2. Prevent adding own email
    if (user?.email && email.toLowerCase() === user.email.toLowerCase().trim()) {
      setCollaboratorError('You cannot add yourself as a collaborator.');
      return;
    }

    // 3. Prevent duplicate collaborator
    const alreadyAdded = recipients.some(
      (r) => r.email.toLowerCase() === email.toLowerCase()
    );
    if (alreadyAdded) {
      setCollaboratorError('This collaborator has already been added.');
      return;
    }

    // 4. Backend validation against registered users in database
    setValidatingCollaborator(true);
    try {
      const response = await fetch(
        buildApiUrl(`/documents/users/lookup?email=${encodeURIComponent(email)}`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setCollaboratorError(data.error?.message || 'This email address is not registered with TrustVault.');
        } else if (response.status === 400) {
          setCollaboratorError(data.error?.message || 'Please enter a valid email address.');
        } else if (response.status === 403) {
          setCollaboratorError(data.error?.message || 'You are not authorized to assign collaborators.');
        } else {
          setCollaboratorError(data.error?.message || 'Unable to verify collaborator email.');
        }
        return;
      }

      if (!data.user) {
        setCollaboratorError('This email address is not registered with TrustVault.');
        return;
      }

      const newRecipient = {
        userId: data.user.id || data.user._id,
        name: data.user.name || email.split('@')[0],
        email: data.user.email.toLowerCase().trim(),
        permissionLevel: permissionLevel,
      };

      setRecipients((prev) => [...prev, newRecipient]);
      setCollaboratorEmail('');
      setCollaboratorError(null);
      setCollaboratorSuccess(`Added ${data.user.name} (${data.user.email}) as ${permissionLevel === 'edit' ? 'Read & Edit' : 'Read Only'}.`);
      setTimeout(() => setCollaboratorSuccess(null), 3500);
    } catch (err) {
      console.error('[UploadModal] Collaborator lookup network error:', err);
      setCollaboratorError('Network error connecting to TrustVault API. Please try again.');
    } finally {
      setValidatingCollaborator(false);
    }
  };

  const handleRemoveRecipient = (emailToRemove) => {
    setRecipients((prev) => prev.filter((r) => r.email.toLowerCase() !== emailToRemove.toLowerCase()));
    if (collaboratorSuccess) setCollaboratorSuccess(null);
  };

  const handleReset = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (allFilesInputRef.current) allFilesInputRef.current.value = '';
    setTitle('');
    setDescription('');
    setTags('');
    setVisibility('private');
    setRecipients([]);
    setCollaboratorEmail('');
    setPermissionLevel('read');
    setValidatingCollaborator(false);
    setCollaboratorError(null);
    setCollaboratorSuccess(null);
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // Prevent duplicate submission on mobile tap
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
              onClick={() => {
                if (!selectedFile) fileInputRef.current?.click();
              }}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                accept=".pdf,.docx,.xlsx,.pptx,.zip,.txt,.csv,.json,.md,.log,.png,.jpg,.jpeg,.gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,text/plain,text/csv,application/json,text/markdown,image/png,image/jpeg,image/gif"
                className="upload-dropzone-input"
                disabled={loading}
                aria-label="Select document to upload"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelection(e.target.files[0]);
                  }
                }}
              />

              {/* Secondary fallback input for unrestricted system file browser */}
              <input
                type="file"
                ref={allFilesInputRef}
                accept="*/*"
                style={{ display: 'none' }}
                disabled={loading}
                aria-label="Browse device storage"
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
                      if (allFilesInputRef.current) allFilesInputRef.current.value = '';
                    }}
                    title="Remove selected file"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="dropzone-empty-prompt">
                  <UploadCloud size={42} className="upload-icon" />
                  <p className="prompt-primary">
                    Drag and drop file here, or <span>browse local files</span>
                  </p>
                  <p className="prompt-secondary">
                    Supports PDF, DOCX, XLSX, Images, and Text up to 25 MB
                  </p>
                  <div className="dropzone-actions">
                    <button
                      type="button"
                      className="btn-browse-docs"
                      onClick={(e) => {
                        e.stopPropagation();
                        allFilesInputRef.current?.click();
                      }}
                    >
                      Browse Device Storage
                    </button>
                  </div>
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
                      <input
                        type="email"
                        id="collaborator-email-input"
                        className="form-input recipient-email-input"
                        placeholder="Enter collaborator's email address"
                        value={collaboratorEmail}
                        onChange={(e) => {
                          setCollaboratorEmail(e.target.value);
                          if (collaboratorError) setCollaboratorError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddRecipient();
                          }
                        }}
                        disabled={loading || validatingCollaborator}
                        autoComplete="off"
                        aria-label="Collaborator's email address"
                      />

                      <select 
                        id="collaborator-perm-select"
                        className="form-select recipient-perm-dropdown"
                        value={permissionLevel}
                        onChange={(e) => setPermissionLevel(e.target.value)}
                        disabled={loading || validatingCollaborator}
                        aria-label="Collaborator permission level"
                      >
                        <option value="read">Read Only</option>
                        <option value="edit">Read & Edit</option>
                      </select>

                      <Button 
                        type="button" 
                        variant="secondary" 
                        onClick={handleAddRecipient}
                        disabled={!collaboratorEmail.trim() || loading || validatingCollaborator}
                        className="btn-add-collaborator"
                      >
                        {validatingCollaborator ? (
                          'Checking...'
                        ) : (
                          <>
                            <Plus size={14} /> Add
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Inline Error and Success Feedback */}
                    {collaboratorError && (
                      <div className="collaborator-inline-feedback error" role="alert">
                        <AlertCircle size={14} />
                        <span>{collaboratorError}</span>
                      </div>
                    )}

                    {collaboratorSuccess && (
                      <div className="collaborator-inline-feedback success" role="status">
                        <CheckCircle2 size={14} />
                        <span>{collaboratorSuccess}</span>
                      </div>
                    )}

                    {recipients.length > 0 && (
                      <div className="recipients-list-chips">
                        {recipients.map((rec) => (
                          <div key={rec.email} className="recipient-chip">
                            <div className="recipient-chip-info">
                              <span className="recipient-chip-name">{rec.name || rec.email.split('@')[0]}</span>
                              <span className="recipient-chip-email">({rec.email})</span>
                            </div>
                            <span className={`recipient-chip-badge badge-${rec.permissionLevel}`}>
                              {rec.permissionLevel === 'edit' ? 'Read & Edit' : 'Read Only'}
                            </span>
                            <button 
                              type="button" 
                              className="recipient-chip-remove"
                              onClick={() => handleRemoveRecipient(rec.email)}
                              title={`Remove ${rec.email}`}
                              aria-label={`Remove ${rec.email}`}
                              disabled={loading}
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
