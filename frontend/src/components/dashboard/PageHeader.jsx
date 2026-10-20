import React from 'react';
import { Upload, Users, ShieldCheck } from 'lucide-react';
import { Button } from '../common/Button';
import './PageHeader.css';

/**
 * PageHeader Component
 * Welcomes the user, explains key capabilities, and hosts primary workflow triggers.
 */
export function PageHeader({
  title = 'Document overview',
  description = 'Manage, share, and track confidential enterprise documents with fine-grained access policies.',
  onUploadClick,
  onViewSharedClick,
}) {
  return (
    <section className="page-header" aria-labelledby="page-title">
      <div className="page-header-text">
        <div className="page-header-badge">
          <ShieldCheck size={14} className="badge-icon" aria-hidden="true" />
          <span>Zero-Trust Document Vault</span>
        </div>
        <h1 id="page-title" className="page-header-title">{title}</h1>
        <p className="page-header-description">{description}</p>
      </div>

      <div className="page-header-actions">
        <Button
          variant="secondary"
          icon={Users}
          onClick={onViewSharedClick}
          title="Filter documents shared with you or your teams"
        >
          View shared documents
        </Button>
        <Button
          variant="primary"
          icon={Upload}
          onClick={onUploadClick}
          title="Upload a new confidential file to TrustVault"
        >
          Upload document
        </Button>
      </div>
    </section>
  );
}
