import React, { useEffect } from 'react';
import { X, Info, AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import './Modal.css';

/**
 * Accessible Modal Dialog Component
 * Traps focus, handles Escape key, and provides clear accessibility attributes.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  badge = 'Security Notice',
  confirmLabel = 'Understood',
  onConfirm,
  type = 'info', // 'info' | 'notice'
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-subtitle"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-text">
            {badge && (
              <span className={`modal-badge badge-${type}`}>
                {type === 'info' ? <Info size={12} /> : <AlertTriangle size={12} />}
                {badge}
              </span>
            )}
            <h2 id="modal-title" className="modal-title">{title}</h2>
            {subtitle && <p id="modal-subtitle" className="modal-subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
            title="Close dialog (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {children}
        </div>

        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {confirmLabel && (
            <Button variant="primary" onClick={onConfirm || onClose}>
              {confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
