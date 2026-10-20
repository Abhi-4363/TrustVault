import React from 'react';
import './SummaryCard.css';

/**
 * SummaryCard Component
 * Displays an aggregated metric with an explicit DEMO watermark to prevent user confusion.
 */
export function SummaryCard({
  title,
  value,
  description,
  trend,
  icon: Icon,
  variant = 'default',
  isDemo = true,
}) {
  return (
    <article className={`summary-card card-${variant}`} aria-labelledby={`metric-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <div className="summary-card-header">
        <div className="summary-card-icon-wrapper" aria-hidden="true">
          {Icon && <Icon size={20} />}
        </div>
        {isDemo && (
          <span className="summary-card-demo-badge" title="Fictional demonstration metric">
            Demo
          </span>
        )}
      </div>

      <div className="summary-card-body">
        <h3 id={`metric-${title.replace(/\s+/g, '-').toLowerCase()}`} className="summary-card-title">
          {title}
        </h3>
        <div className="summary-card-value-row">
          <span className="summary-card-value">{value}</span>
          {trend && <span className="summary-card-trend">{trend}</span>}
        </div>
        {description && <p className="summary-card-description">{description}</p>}
      </div>
    </article>
  );
}
