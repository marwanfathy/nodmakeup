// Path validation for client-supplied file locations (the delete endpoint).
// Pure functions — no I/O. Confines any input under an allow-listed prefix so
// callers can never address anything outside the public media tree.
import path from 'node:path';

// Only URL-safe relative components are accepted; blocks absolute paths,
// backslashes/encoded traversal and any `..` segments.
const SAFE_RELATIVE = /^[\w.\-/]+$/;

/**
 * Normalise + confine a client-supplied media path (e.g. "uploads/products/x.webp").
 * Returns the normalised relative path when safe, otherwise null.
 *
 * @param {string} input - client-supplied path
 * @param {string} prefix - allow-listed root segment (e.g. "uploads")
 */
export function sanitizeRelPath(input, prefix = '') {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim().replace(/^\/+/, '');
  if (!trimmed || trimmed.includes('\0')) return null;
  if (path.isAbsolute(trimmed)) return null;
  if (trimmed.includes('\\')) return null;
  if (!SAFE_RELATIVE.test(trimmed)) return null;

  const normalized = path.normalize(trimmed);
  if (normalized === '..' || normalized.startsWith(`..${path.sep}`) || normalized.includes(`${path.sep}..${path.sep}`)) {
    return null;
  }
  if (prefix && !(normalized === prefix || normalized.startsWith(`${prefix}${path.sep}`))) {
    return null;
  }

  return normalized;
}