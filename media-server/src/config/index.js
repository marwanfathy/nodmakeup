// Env + origin/URL contract comes from the ONE shared source (@nod/shared
// runtime) — the same implementation the backend uses. The relative import
// works in the repo (media-server/src/ -> ../../shared) and in the media
// container (where the Dockerfile copies shared/ to /wd/shared).
import runtime from '../../../shared/dist/runtime/config.js';
import env from './env.js';

const safeOrigins = runtime.parseOriginList(env.SAFE_ORIGINS);

// Strict explicit allowlist (exact origins / *.subdomain wildcards). No
// implicit private-subnet trust. No-origin (non-browser) clients allowed.
export const isAllowedOrigin = (origin) => runtime.allowOrigin(origin, safeOrigins);

export const port = env.MEDIA_PORT || env.PORT
  ? Number.parseInt(env.MEDIA_PORT || env.PORT, 10)
  : runtime.defaultPortOf('media');

export const mediaBaseUrl = env.MEDIA_BASE_URL;

export const safeOriginsList = safeOrigins;

export const mediaApiKey = env.MEDIA_API_KEY;