import React from 'react';
import { Upload, Users, FileCheck, UserPlus, Clock } from 'lucide-react';
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
  isViewer = false,
  onRequestOwnerAccess,
  ownerApprovalStatus = 'not_required',
  ownerApprovalRequestedAt = null,
  isSubmittingOwnerRequest = false,
}) {
  return (
    <section className="page-header" aria-labelledby="page-title">
      <div className="page-header-text">
        <div className="page-header-badge">
          <FileCheck size={14} className="badge-icon" aria-hidden="true" />
          <span>Every Access. Verified.</span>
        </div>
        <h1 id="page-title" className="page-header-title">{title}</h1>
        <p className="page-header-description">{description}</p>
        {isViewer && (
          <p className="page-header-supporting-text" id="viewer-owner-request-prompt">
            <span className="supporting-icon-wrapper" aria-hidden="true">
              <UserPlus size={14} />
            </span>
            <span>Need to upload and manage your own documents? Request Document Owner access from your administrator.</span>
          </p>
        )}
      </div>

      <div className="page-header-actions">
        <Button
          variant="secondary"
          icon={Users}
          onClick={onViewSharedClick}
          title="Filter documents shared with you or your teams"
          id="btn-view-shared-documents"
        >
          View shared documents
        </Button>
        {!isViewer && (
          <Button
            variant="primary"
            icon={Upload}
            onClick={onUploadClick}
            title="Upload a new confidential file to TrustVault"
            id="btn-upload-document"
          >
            Upload document
          </Button>
        )}
        {isViewer && (
          ownerApprovalStatus === 'pending' ? (
            <div
              className="owner-request-status-pill pending"
              id="owner-request-status-badge"
              role="status"
              title={`Owner access request pending administrator approval${
                ownerApprovalRequestedAt ? ` (Submitted ${new Date(ownerApprovalRequestedAt).toLocaleDateString()})` : ''
              }`}
            >
              <Clock size={14} className="status-icon" aria-hidden="true" />
              <span>Owner access pending</span>
            </div>
          ) : (
            <Button
              variant="primary"
              icon={UserPlus}
              onClick={onRequestOwnerAccess}
              disabled={isSubmittingOwnerRequest}
              title="Request Document Owner access from your administrator"
              id="btn-request-owner-access"
            >
              {isSubmittingOwnerRequest
                ? 'Submitting...'
                : ownerApprovalStatus === 'rejected'
                ? 'Request Owner Access Again'
                : 'Request Owner Access'}
            </Button>
          )
        )}
      </div>
    </section>
  );
}
