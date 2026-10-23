/**
 * TrustVault Frontend - Central API Configuration & Safe URL Builder
 * Normalises VITE_API_BASE_URL to avoid /api omissions or accidental duplications.
 */

export function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
  let clean = String(envUrl).trim().replace(/\/+$/, '');
  if (!clean.endsWith('/api')) {
    clean = `${clean}/api`;
  }
  return clean;
}

export const API_BASE_URL = getApiBaseUrl();

/**
 * Builds a clean, fully-qualified API URL
 * @param {string} path - e.g. '/auth/login', '/health', or '/api/documents'
 * @returns {string} - e.g. 'https://trustvault-wkaj.onrender.com/api/auth/login'
 */
export function buildApiUrl(path) {
  const base = getApiBaseUrl();
  let cleanPath = String(path || '').trim();

  // Strip accidental redundant leading /api or api/
  if (cleanPath.startsWith('/api/')) {
    cleanPath = cleanPath.slice(4);
  } else if (cleanPath.startsWith('api/')) {
    cleanPath = cleanPath.slice(3);
  } else if (cleanPath === '/api' || cleanPath === 'api') {
    cleanPath = '';
  }

  if (cleanPath && !cleanPath.startsWith('/')) {
    cleanPath = `/${cleanPath}`;
  }

  return `${base}${cleanPath}`;
}
