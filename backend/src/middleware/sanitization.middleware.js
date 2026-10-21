/**
 * TrustVault Backend - Input Sanitization & Schema Validation Middleware (Stage 7)
 * Neutralizes XSS attack vectors, script injection, and validates schemas for document
 * metadata (titles, descriptions, tags) and search queries.
 */

/**
 * Strips HTML tags, dangerous attributes, and script protocols from a string
 */
export function sanitizeString(val) {
  if (typeof val !== 'string') return '';

  return val
    // Remove script tags and contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove style tags and contents
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove all HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove javascript: and data: protocols
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    // Remove dangerous inline event handlers like onerror=, onload=, onclick=
    .replace(/\bon\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\bon\w+\s*=\s*[^>\s]+/gi, '')
    .trim();
}

/**
 * Sanitizes and validates an array of tags
 */
export function sanitizeTags(rawTags) {
  let tagsList = [];

  if (Array.isArray(rawTags)) {
    tagsList = rawTags;
  } else if (typeof rawTags === 'string') {
    try {
      const parsed = JSON.parse(rawTags);
      tagsList = Array.isArray(parsed) ? parsed : [rawTags];
    } catch {
      tagsList = rawTags.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }

  // Sanitize each tag and enforce format
  const sanitized = tagsList
    .map((tag) => sanitizeString(String(tag)))
    .filter(Boolean)
    // Keep alphanumeric, hyphens, underscores, dots, spaces
    .map((tag) => tag.replace(/[^a-zA-Z0-9_\-\.\s]/g, '').trim())
    .filter((tag) => tag.length > 0 && tag.length <= 50)
    .slice(0, 20); // max 20 tags

  return Array.from(new Set(sanitized));
}

/**
 * Express middleware to validate and sanitize document input during upload & update
 */
export function validateAndSanitizeDocumentInput(req, res, next) {
  if (req.body) {
    if (req.body.title !== undefined) {
      const cleanedTitle = sanitizeString(String(req.body.title));
      if (req.body.title && cleanedTitle.length === 0) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Document title contains invalid or dangerous script tags.',
          },
        });
      }
      if (cleanedTitle.length > 255) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Document title cannot exceed 255 characters.',
          },
        });
      }
      req.body.title = cleanedTitle;
    }

    if (req.body.description !== undefined) {
      const cleanedDesc = sanitizeString(String(req.body.description));
      if (cleanedDesc.length > 2000) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Document description cannot exceed 2000 characters.',
          },
        });
      }
      req.body.description = cleanedDesc;
    }

    if (req.body.tags !== undefined) {
      req.body.tags = sanitizeTags(req.body.tags);
    }
  }

  next();
}

/**
 * Express middleware to validate and sanitize search queries
 */
export function validateAndSanitizeSearchInput(req, res, next) {
  if (req.query) {
    if (req.query.q !== undefined) {
      const cleanedQuery = sanitizeString(String(req.query.q));
      if (cleanedQuery.length > 200) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Search query cannot exceed 200 characters.',
          },
        });
      }
      req.query.q = cleanedQuery;
    } else {
      req.query.q = '';
    }

    if (req.query.tags !== undefined) {
      req.query.tags = sanitizeTags(req.query.tags);
    }

    if (req.query.owner !== undefined) {
      req.query.owner = sanitizeString(String(req.query.owner)).slice(0, 100);
    }

    if (req.query.category !== undefined) {
      req.query.category = sanitizeString(String(req.query.category)).slice(0, 50);
    }

    if (req.query.format !== undefined) {
      req.query.format = sanitizeString(String(req.query.format)).slice(0, 20);
    }

    if (req.query.date !== undefined) {
      req.query.date = sanitizeString(String(req.query.date)).slice(0, 30);
    }

    if (req.query.dateFrom !== undefined) {
      req.query.dateFrom = sanitizeString(String(req.query.dateFrom)).slice(0, 30);
    }

    if (req.query.dateTo !== undefined) {
      req.query.dateTo = sanitizeString(String(req.query.dateTo)).slice(0, 30);
    }
  }

  next();
}
