// Staging hygiene: purge raw files that were uploaded but never moved to
// uploads/ (processing failed, client disconnected). Runs on an interval
// from the composition root as a fire-and-forget sweep.
import fs from 'node:fs';
import path from 'node:path';
import { STAGING_DIR } from './storage.js';

const LEGACY_STAGING_DIR = path.join(import.meta.dirname, '../../temp');
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function purgeDir(dir, maxAgeMs) {
  if (!fs.existsSync(dir)) return 0;
  const now = Date.now();
  let removed = 0;

  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    try {
      const stat = fs.statSync(full);
      if (stat.isFile() && now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(full);
        removed += 1;
      }
    } catch {
      // Unreadable/racing entries are skipped; the sweep reruns hourly.
    }
  }
  return removed;
}

/** Purge stale staging files; returns the number removed. */
export function purgeStaging(maxAgeMs = DEFAULT_MAX_AGE_MS) {
  let removed = purgeDir(STAGING_DIR, maxAgeMs);
  if (removed > 0) console.log(`🧹 Staging purge removed ${removed} stale file(s).`);
  return removed;
}

/** One-shot removal of the legacy audio staging dir (pre-restructure). */
export function clearLegacyStaging() {
  if (fs.existsSync(LEGACY_STAGING_DIR)) {
    fs.rmSync(LEGACY_STAGING_DIR, { recursive: true, force: true });
    console.log('🧹 Removed legacy media-server/temp staging dir.');
  }
}