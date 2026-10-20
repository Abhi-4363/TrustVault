import React from 'react';
import { Button } from './Button';
import './EmptyState.css';

/**
 * EmptyState Component
 * Displays an intuitive icon, explanatory heading, helpful description,
 * and an optional primary action to guide first-time users.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
}) {
  return (
    <div className="empty-state" role="region" aria-label={title}>
      {Icon && (
        <div className="empty-state-icon" aria-hidden="true">
          <Icon size={32} />
        </div>
      )}
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {actionLabel && onAction && (
        <div className="empty-state-action">
          <Button variant="secondary" icon={actionIcon} onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
