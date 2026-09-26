import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Single source of truth: the root `.env`. Fall back to the surrounding env
// (Docker / worker injection) when it is absent.
const rootEnv = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config();
}

import { loadEnv, isOriginAllowed as checkOriginAllowed } from '@nod/shared/dist/config/env';

/**
 * Fail-fast environment. Import FIRST in the server entrypoint so dotenv has
 * loaded and required values are validated before any other module starts.
 */
export const env = loadEnv();

/**
 * Origin allowlist check. Strict explicit SAFE_ORIGINS matching — no implicit
 * LAN trust. Implementation lives in @nod/shared/runtime/config (one source).
 */
export const isOriginAllowed = checkOriginAllowed;