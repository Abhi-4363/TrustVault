import React from 'react';

/**
 * TrustVault — "The Verified Document Mark"
 * Custom geometric brand mark: layered document silhouette with
 * a controlled-sharing notch and a subtle verification fold.
 *
 * Variants:
 *   horizontal  — icon + wordmark side-by-side (default)
 *   compact     — icon + short wordmark
 *   icon        — icon only (square, scalable)
 *
 * Themes:
 *   light  — forest green mark, charcoal text
 *   dark   — light mark, white text
 *   mono   — single-color (currentColor)
 */
export function Logo({
  variant = 'horizontal',
  theme = 'light',
  size = 32,
  className = '',
  showTagline = false,
}) {
  const isIcon = variant === 'icon';
  const isCompact = variant === 'compact';

  const markColor  = theme === 'dark' ? '#A8D8C8' : '#176B52';
  const accentColor= theme === 'dark' ? '#6BBFA5' : '#103D32';
  const textColor  = theme === 'dark' ? '#EDF2EE' : '#242A27';
  const tagColor   = theme === 'dark' ? '#6E8278' : '#68736D';

  return (
    <div
      className={`tv-logo tv-logo--${variant} ${className}`}
      aria-label="TrustVault"
      role="img"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isIcon ? 0 : Math.round(size * 0.35) + 'px',
        userSelect: 'none',
        flexDirection: isCompact && showTagline ? 'column' : 'row',
      }}
    >
      {/* ── SVG Mark ─────────────────────────────────────────────────────── */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        {/*
          The Verified Document Mark
          - Base document rectangle (rounded left, flat right with fold)
          - Corner fold triangle (top-right) representing a page turn
          - Sharing notch: a small geometric cutout on the right edge
          - Verification line cluster: three ruled lines indicating content
          - Tick: a clean geometric check confirming verified state
        */}

        {/* Document base */}
        <path
          d="M7 6C7 4.89543 7.89543 4 9 4H27L33 10V34C33 35.1046 32.1046 36 31 36H9C7.89543 36 7 35.1046 7 34V6Z"
          fill={markColor}
          opacity="0.12"
        />
        <path
          d="M7 6C7 4.89543 7.89543 4 9 4H27L33 10V34C33 35.1046 32.1046 36 31 36H9C7.89543 36 7 35.1046 7 34V6Z"
          stroke={markColor}
          strokeWidth="1.8"
          fill="none"
        />

        {/* Corner fold */}
        <path
          d="M27 4L33 10H29C27.8954 10 27 9.10457 27 8V4Z"
          fill={markColor}
          opacity="0.50"
        />
        <path
          d="M27 4L33 10H29C27.8954 10 27 9.10457 27 8V4Z"
          stroke={markColor}
          strokeWidth="1.2"
          fill="none"
        />

        {/* Document content lines */}
        <line x1="12" y1="16" x2="28" y2="16" stroke={markColor} strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
        <line x1="12" y1="20.5" x2="24" y2="20.5" stroke={markColor} strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
        <line x1="12" y1="25" x2="26" y2="25" stroke={markColor} strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />

        {/* Verification checkmark — bottom right of document */}
        <circle cx="28" cy="28" r="6" fill={markColor} />
        <path
          d="M25 28.2L27.2 30.4L31 26.5"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {/* ── Wordmark ──────────────────────────────────────────────────────── */}
      {!isIcon && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: isCompact ? Math.round(size * 0.48) + 'px' : Math.round(size * 0.52) + 'px',
              fontWeight: 700,
              color: textColor,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            Trust<span style={{ color: markColor }}>Vault</span>
          </span>
          {showTagline && (
            <span
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: Math.round(size * 0.28) + 'px',
                fontWeight: 500,
                color: tagColor,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginTop: '2px',
              }}
            >
              Every Access. Verified.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default Logo;
