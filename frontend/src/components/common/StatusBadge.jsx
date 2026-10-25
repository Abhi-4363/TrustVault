import React from 'react';
import { UserCheck, Eye, Edit3, Lock, Users, Clock, AlertCircle } from 'lucide-react';
import './StatusBadge.css';

/**
 * Accessible Status Badge
 * Crucial Rule: Never relies on color alone — always pairs color with clear text and icon.
 */
export function StatusBadge({ status, variant }) {
  // Normalize status text
  const cleanStatus = status || 'Unknown';
  
  // Resolve icon and variant
  let icon = null;
  let resolvedVariant = variant || 'default';

  switch (cleanStatus.toLowerCase()) {
    case 'owner':
    case 'document owner':
      icon = <UserCheck size={12} aria-hidden="true" />;
      resolvedVariant = 'owner';
      break;
    case 'can edit':
    case 'edit':
      icon = <Edit3 size={12} aria-hidden="true" />;
      resolvedVariant = 'edit';
      break;
    case 'can read':
    case 'read':
    case 'viewer':
      icon = <Eye size={12} aria-hidden="true" />;
      resolvedVariant = 'read';
      break;
    case 'confidential':
    case 'restricted':
      icon = <Lock size={12} aria-hidden="true" />;
      resolvedVariant = 'confidential';
      break;
    case 'shared':
      icon = <Users size={12} aria-hidden="true" />;
      resolvedVariant = 'shared';
      break;
    case 'revoked':
      icon = <AlertCircle size={12} aria-hidden="true" />;
      resolvedVariant = 'danger';
      break;
    default:
      icon = <Clock size={12} aria-hidden="true" />;
      resolvedVariant = 'default';
  }

  return (
    <span className={`status-badge badge-${resolvedVariant}`} role="status">
      <span className="badge-icon">{icon}</span>
      <span className="badge-text">{cleanStatus}</span>
    </span>
  );
}
