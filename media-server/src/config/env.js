// Fail-fast env loader. Single source of truth: the root `.env` (repo root)
// in the repo; falls back to the injected process env in the container / Docker
// where values are provided by compose. Required-key checks enforce the same
// contract as the shared @nod/shared runtime loader used by the backend.
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const rootEnv = resolve(import.meta.dirname, '../../..', '.env');
if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config();
}

const REQUIRED = ['MEDIA_BASE_URL', 'SAFE_ORIGINS', 'MEDIA_API_KEY'];

for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required env var "${key}".`);
    process.exit(1);
  }
}

export default process.env;