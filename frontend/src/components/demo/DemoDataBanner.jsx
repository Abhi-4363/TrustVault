import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, CheckCircle, ExternalLink } from 'lucide-react';
import './DemoDataBanner.css';

/**
 * DemoDataBanner Component
 * Explicitly identifies all displayed information as demonstration data,
 * preventing any ambiguity regarding backend persistence.
 */
export function DemoDataBanner({ onCheckHealth, healthStatus }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside className="demo-banner" aria-label="Demonstration Notice">
      <div className="demo-banner-content">
        <div className="demo-banner-title-area">
          <span className="demo-pill">DEMO DATA</span>
          <p className="demo-summary-text">
            <strong>Stage 1 Demonstration Mode:</strong> All statistics, documents, and audit logs are simulated demo records. No database is connected.
          </p>
        </div>

        <div className="demo-banner-actions">
          <button
            type="button"
            className="demo-toggle-btn"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls="demo-details"
          >
            <span>{expanded ? 'Hide Stage Info' : 'Why Demo Data?'}</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div id="demo-details" className="demo-details-body">
          <div className="demo-details-grid">
            <div className="demo-detail-col">
              <h4>Current Stage: Stage 1 (Foundation & UI)</h4>
              <p>
                In Stage 1, the platform strictly establishes UI ergonomics, design tokens, and the Express health-check service.
                Actions like document uploading, database persistence, and authorization enforcement are scheduled for Stages 2 through 6.
              </p>
            </div>
            <div className="demo-detail-col">
              <h4>Live Backend Health Status</h4>
              <div className="health-check-box">
                {healthStatus ? (
                  <div className="health-live-status">
                    <CheckCircle size={16} className="text-success" />
                    <span>Backend reachable at <code>/api/health</code> (Uptime: {healthStatus.uptime}s)</span>
                  </div>
                ) : (
                  <button type="button" className="health-query-btn" onClick={onCheckHealth}>
                    Test Live Connection to <code>/api/health</code>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
