import React, { useState, useEffect } from 'react';
import { 
  Edit3, 
  X, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  Tag 
} from 'lucide-react';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { buildApiUrl } from '../../config/api';
import './EditModal.css';

export function EditModal({ isOpen, onClose, document, onUpdateSuccess }) {
  const { user, token } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!isOpen || !document) return;

    setTitle(document.name || document.title || '');
    setDescription(document.description || '');
    setTags(Array.isArray(document.tags) ? document.tags.join(', ') : '');
    setError(null);
    setSuccess(null);
    setSaving(false);
  }, [isOpen, document]);

  if (!isOpen || !document) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Document title is required.');
      return;
    }

    if (!token) {
      setError('Authentication token expired. Please sign in again.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (document.isReal) {
        const response = await fetch(buildApiUrl(`/documents/${document.id}`), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            tags: parsedTags,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to update document metadata.');
        }

        setSuccess('Document metadata successfully updated.');
        if (onUpdateSuccess) onUpdateSuccess();
        setTimeout(() => {
          onClose();
        }, 900);
      } else {
        // Simulation for mock records
        setSuccess('[Simulation] Document metadata updated successfully.');
        setTimeout(() => {
          onClose();
        }, 900);
      }
    } catch (err) {
      setError(err.message || 'Error saving changes to document.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="edit-modal-overlay" onClick={onClose} role="presentation">
      <div 
        className="edit-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="edit-modal-header">
          <div className="edit-modal-title-area">
            <span className="edit-badge">
              <Edit3 size={13} />
              Metadata Editor
            </span>
            <h2 id="edit-modal-title" className="edit-modal-title">
              Edit Document: {document.name}
            </h2>
            <p className="edit-modal-subtitle">
              Modify classification title, operational description, and discoverability tags.
            </p>
          </div>
          <button 
            type="button" 
            className="edit-modal-close" 
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-modal-body">
          {error && (
            <div className="edit-alert-banner alert-error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="edit-alert-banner alert-success" role="status">
              <CheckCircle2 size={16} />
              <span>{success}</span>
            </div>
          )}

          {/* Immutable Document Properties Info Strip */}
          <div className="edit-info-strip">
            <div className="info-strip-item">
              <span className="info-strip-label">Original File:</span>
              <span className="info-strip-val" title={document.originalName || document.name}>
                {document.originalName || document.name}
              </span>
            </div>
            <div className="info-strip-item">
              <span className="info-strip-label">Format / Size:</span>
              <span className="info-strip-val">
                {document.fileType} • {document.fileSize}
              </span>
            </div>
            <div className="info-strip-item">
              <span className="info-strip-label">Owner:</span>
              <span className="info-strip-val">
                {document.owner?.name || 'Document Owner'}
              </span>
            </div>
            <div className="info-strip-item">
              <span className="info-strip-label">Your Access:</span>
              <span className="info-strip-val">
                <StatusBadge status={document.accessLevel} />
              </span>
            </div>
          </div>

          <div className="edit-form-field">
            <label htmlFor="edit-doc-title" className="edit-field-label">
              Document Title <span className="required-star">*</span>
            </label>
            <input 
              id="edit-doc-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter descriptive title..."
              className="edit-text-input"
              maxLength={255}
              required
              disabled={saving}
            />
            <span className="edit-field-hint">Max 255 characters. HTML and script tags will be sanitized.</span>
          </div>

          <div className="edit-form-field">
            <label htmlFor="edit-doc-description" className="edit-field-label">
              Description / Executive Summary
            </label>
            <textarea 
              id="edit-doc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context, purpose, or classification instructions..."
              className="edit-textarea-input"
              rows={3}
              maxLength={2000}
              disabled={saving}
            />
          </div>

          <div className="edit-form-field">
            <label htmlFor="edit-doc-tags" className="edit-field-label">
              Tags <Tag size={13} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '4px' }} />
            </label>
            <input 
              id="edit-doc-tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. strategy, audit, confidential, 2026 (comma separated)"
              className="edit-text-input"
              disabled={saving}
            />
            <span className="edit-field-hint">Separate multiple keywords with commas.</span>
          </div>

          <div className="edit-modal-footer">
            <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving || !title.trim()}>
              {saving ? 'Saving changes...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
