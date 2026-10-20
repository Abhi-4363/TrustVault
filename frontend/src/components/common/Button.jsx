import React from 'react';
import './Button.css';

/**
 * Accessible Button Component
 * Supports variants (primary, secondary, outline, ghost, danger) and sizes (sm, md, lg).
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'leading',
  disabled = false,
  onClick,
  type = 'button',
  ariaLabel,
  className = '',
  title,
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size} ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      title={title}
    >
      {Icon && iconPosition === 'leading' && <Icon className="btn-icon btn-icon-leading" size={size === 'sm' ? 14 : 16} aria-hidden="true" />}
      <span className="btn-text">{children}</span>
      {Icon && iconPosition === 'trailing' && <Icon className="btn-icon btn-icon-trailing" size={size === 'sm' ? 14 : 16} aria-hidden="true" />}
    </button>
  );
}
