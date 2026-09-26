// Media-server op-auth.
// Server-to-server calls (backend/admin) must send header `x-media-api-key: <MEDIA_API_KEY>`.
// Browser uploads are allowed only when the request carries an allowed Origin and is a
// write method (POST) — credentials (cookies) are not trusted here, Origin is.
import { mediaApiKey, isAllowedOrigin } from '../config/index.js';

const MAGIC = mediaApiKey;
if (!MAGIC) {
  // Fail-fast: refuse to boot without a key configured.
  throw new Error('FATAL: MEDIA_API_KEY is not set.');
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function apiKeyAuth(req, res, next) {
  if (req.path.startsWith('/api/')) {
    const method = req.method.toUpperCase();
    const providedKey = req.headers['x-media-api-key'];
    const origin = req.get('Origin');

    // 1. Server-to-server: valid API key wins.
    if (providedKey) {
      if (providedKey === MAGIC) return next();
      return res.status(401).json({ message: 'Invalid media API key.' });
    }

    // 2. Browser uploads from a trusted Origin.
    if (WRITE_METHODS.has(method) && origin && isAllowedOrigin(origin)) {
      return next();
    }

    // 3. Public reads are fine for browsers (no Origin present for some clients/
    //    curl) as long as it is a read method.
    if (READ_METHODS.has(method)) {
      return next();
    }

    // 4. Everything else is unauthorized.
    return res.status(401).json({ message: 'Unauthorized media request.' });
  }
  return next();
}