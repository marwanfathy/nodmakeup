// lib/flags.ts
// Operational feature flags, persisted to .runtime/flags.json. Each flag is a
// boolean with a description; the UI toggles them here and every change is
// audit-logged. Direct TS port. The persisted cache stores {title,description,
// value} per key — the `key` is added when the list is surfaced.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RUNTIME_DIR } from './config';
import { globalState } from './state';
import type { FlagDef } from './types';

const FILE = resolve(RUNTIME_DIR, 'flags.json');

type StoredFlag = Omit<FlagDef, 'key'>;
type FlagStore = Record<string, StoredFlag>;

const DEFAULTS: Record<string, StoredFlag> = {
  autoRefresh: { title: 'Auto-refresh dashboards', description: 'Sampler + live tail keep running while the dashboard is open.', value: true },
  showDebugLogs: { title: 'Show debug log lines', description: 'Include debug/trace-level lines in the log viewers.', value: false },
  maintenanceBanner: { title: 'Maintenance banner', description: 'Displays a banner across the control center header (informational).', value: false },
  pauseOnTabHidden: { title: 'Pause when hidden', description: "Stops background polling when the control center tab isn't visible.", value: true },
};

function load(): FlagStore {
  if (!existsSync(FILE)) return structuredClone(DEFAULTS);
  try {
    const stored = JSON.parse(readFileSync(FILE, 'utf8')) as Partial<FlagStore>;
    const merged: FlagStore = structuredClone(DEFAULTS);
    for (const [key, def] of Object.entries(stored)) {
      if (key in merged && def) merged[key] = { ...merged[key], ...def };
    }
    return merged;
  } catch {
    return structuredClone(DEFAULTS);
  }
}

// globalThis: a setFlag from any graph must be visible to every other copy.
const cache: FlagStore = globalState('flags', () => load());

export function listFlags(): FlagDef[] {
  return Object.entries(cache).map(([key, def]) => ({ key, title: def.title, description: def.description, value: def.value }));
}

export function setFlag(key: string, value: boolean): FlagDef {
  if (!(key in DEFAULTS)) throw new Error(`unknown flag: ${key}`);
  const bool = Boolean(value);
  const stored: StoredFlag = { ...DEFAULTS[key], value: bool };
  cache[key] = stored;
  if (!existsSync(RUNTIME_DIR)) mkdirSync(RUNTIME_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(cache, null, 2));
  return { key, title: stored.title, description: stored.description, value: stored.value };
}

export function getFlag(key: string): boolean {
  return cache[key]?.value ?? DEFAULTS[key]?.value ?? false;
}