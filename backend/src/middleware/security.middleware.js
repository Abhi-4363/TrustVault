/**
 * TrustVault Backend - Production Security & Hardening Middleware (Stage 10)
 * 1. Security Headers (Defensive HTTP header enforcement)
 * 2. Sliding Window Rate Limiting (DoS and brute-force mitigation)
 */

/**
 * Standard enterprise defensive security headers
 * Emulates Helmet protections without requiring external native dependencies.
 */
export function securityHeaders(req, res, next) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking / frame embedding
  res.setHeader('X-Frame-Options', 'DENY');

  // Enable browser XSS filtering
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Strict Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict sensitive browser features
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Baseline Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none';"
  );

  // Remove Express footprint header
  res.removeHeader('X-Powered-By');

  next();
}

/**
 * In-memory sliding window rate limiter
 * Tracks request timestamps per client IP.
 */
class InMemoryRateLimiter {
  constructor(windowMs = 60000, maxRequests = 300) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map();

    // Periodic cleanup of stale entries every 2 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [ip, timestamps] of this.requests.entries()) {
        const recent = timestamps.filter((t) => now - t < this.windowMs);
        if (recent.length === 0) {
          this.requests.delete(ip);
        } else {
          this.requests.set(ip, recent);
        }
      }
    }, 120000);

    // Unref interval to allow clean process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  middleware() {
    return (req, res, next) => {
      // Skip rate limiting in test environments
      if (process.env.NODE_ENV === 'test') {
        return next();
      }

      const clientIp =
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket.remoteAddress ||
        '127.0.0.1';

      const now = Date.now();
      const clientTimestamps = (this.requests.get(clientIp) || []).filter(
        (t) => now - t < this.windowMs
      );

      if (clientTimestamps.length >= this.maxRequests) {
        res.setHeader('Retry-After', Math.ceil(this.windowMs / 1000));
        return res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please slow down and try again later.',
          },
        });
      }

      clientTimestamps.push(now);
      this.requests.set(clientIp, clientTimestamps);
      next();
    };
  }
}

export const generalRateLimiter = new InMemoryRateLimiter(60000, 300).middleware();
export const authRateLimiter = new InMemoryRateLimiter(60000, 60).middleware();
