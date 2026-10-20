import React from 'react';
import { 
  Upload, 
  UserPlus, 
  RefreshCw, 
  UserX, 
  ShieldCheck, 
  Clock 
} from 'lucide-react';
import './ActivityList.css';

/**
 * Returns an accessible icon according to the audit action type
 */
function getActivityIcon(type) {
  switch (type) {
    case 'upload':
      return <Upload size={14} className="icon-upload" aria-hidden="true" />;
    case 'grant':
      return <UserPlus size={14} className="icon-grant" aria-hidden="true" />;
    case 'update':
      return <RefreshCw size={14} className="icon-update" aria-hidden="true" />;
    case 'revoke':
      return <UserX size={14} className="icon-revoke" aria-hidden="true" />;
    default:
      return <Clock size={14} aria-hidden="true" />;
  }
}

/**
 * ActivityList Component
 * Displays a chronological demonstration audit trail with clear plain-English wording.
 */
export function ActivityList({ activities = [], onViewAllClick, isLive = false }) {
  return (
    <div className="activity-panel">
      <div className="activity-panel-header">
        <div className="activity-title-row">
          <ShieldCheck size={16} className="audit-shield-icon" aria-hidden="true" />
          <h2 className="activity-title">Recent security activity</h2>
        </div>
        <span 
          className={`demo-indicator-pill ${isLive ? 'live-ledger-pill' : ''}`} 
          title={isLive ? 'Immutable append-only audit trail' : 'Simulated audit events'}
        >
          {isLive ? 'Live Ledger' : 'Demo trail'}
        </span>
      </div>

      <div className="activity-panel-body">
        <ol className="activity-timeline" aria-label="Recent audit event history">
          {activities.map((item) => (
            <li key={item.id} className="activity-item">
              <div className={`activity-icon-container variant-${item.badgeVariant}`}>
                {getActivityIcon(item.type)}
              </div>

              <div className="activity-content">
                <p className="activity-description">
                  <strong className="actor-name">{item.actor.name}</strong>{' '}
                  <span className="action-text">{item.actionText}</span>{' '}
                  <span className="target-doc-name" title={item.documentName}>
                    {item.documentName}
                  </span>
                </p>

                <div className="activity-meta">
                  <time dateTime={item.formattedDate} className="activity-time" title={item.formattedDate}>
                    {item.timestamp}
                  </time>
                  <span className="meta-separator">•</span>
                  <span className="audit-logged-tag">Logged</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="activity-panel-footer">
        <button
          type="button"
          className="view-audit-link"
          onClick={onViewAllClick}
          aria-label="View complete audit logs preview"
        >
          View complete audit trail →
        </button>
      </div>
    </div>
  );
}
