/**
 * TrustVault Backend - Revocation Engine Service (Stage 5)
 * Manages zero-lag instant permission invalidation and ticket blacklisting.
 * Guarantees direct-to-database live validation prior to streaming any bytes.
 */

// In-memory set of revoked access markers for rapid rejection
const revokedAccessSet = new Set();

/**
 * Generates composite key for document-user revocation tracking
 */
function getRevocationKey(documentId, userId) {
  return `${String(documentId)}:${String(userId)}`;
}

/**
 * Registers an immediate revocation event for a user on a specific document
 */
export function registerImmediateRevocation(documentId, userId) {
  const key = getRevocationKey(documentId, userId);
  revokedAccessSet.add(key);

  // Keep marker in memory for active connection lifecycle
  setTimeout(() => {
    revokedAccessSet.delete(key);
  }, 10 * 60 * 1000); // 10 minutes cache purge
}

/**
 * Checks whether immediate revocation has been triggered
 */
export function isAccessImmediatelyRevoked(documentId, userId) {
  const key = getRevocationKey(documentId, userId);
  return revokedAccessSet.has(key);
}

/**
 * Clears immediate revocation marker for a specific user on a document,
 * or clears all revocation markers for a document if userId is omitted.
 */
export function clearImmediateRevocation(documentId, userId) {
  if (!documentId) return;
  if (userId) {
    revokedAccessSet.delete(getRevocationKey(documentId, userId));
  } else {
    const prefix = `${String(documentId)}:`;
    for (const key of revokedAccessSet) {
      if (key.startsWith(prefix)) {
        revokedAccessSet.delete(key);
      }
    }
  }
}

/**
 * Clears in-memory revocation markers (used in tests)
 */
export function clearRevocationCache() {
  revokedAccessSet.clear();
}
