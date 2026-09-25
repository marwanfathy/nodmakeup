// lib/envEditor.ts
// Guarded root-.env editing. Validation rules per known key family (ports,
// urls, booleans, secrets); unknown keys are accepted as plain strings. Writes
// preserve the file's existing line order + comments, and every apply re-runs
// scripts/sync-env.mjs so per-service .env files stay in lockstep. Values of
// secret keys are never echoed back to the UI (masked) and never logged.
// Direct TS port.
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ROOT, ROOT_ENV_FILE, rootEnvValue } from './config';
import type { EnvApplyResult, EnvKeyInfo, EnvKeyType, EnvUpdate } from './types';

// ---------------------------------------------------------------------------
// key-family validation
// ---------------------------------------------------------------------------
const SECRET_KEYS = new Set([
  'MYSQL_ROOT_PASSWORD', 'MYSQL_PASSWORD', 'JWT_SECRET', 'MEDIA_API_KEY',
  'TELEGRAM_BOT_TOKEN', 'TELEGRAM_ADMIN_CHAT_ID', 'GRAFANA_ADMIN_PASSWORD',
  'MYSQL_EXPORTER_PASSWORD', 'BACKUP_PASSPHRASE', 'DATABASE_URL',
  'REDIS_URL', 'SESSION_SECRET', 'ENCRYPTION_KEY', 'RCLONE_REMOTE',
]);

const PORT_KEYS = new Set(['PORT', 'MEDIA_PORT', 'ADMIN_PORT', 'WEB_PORT', 'CC_PORT', 'BACKEND_PORT']);
const URL_KEYS = new Set([
  'GATEWAY_URL', 'MEDIA_BASE_URL', 'ADMIN_PANEL_URL', 'STORE_URL',
  'CLIENT_URL', 'PUBLIC_URL',
]);
const BOOL_KEYS = new Set([
  'AI_ENABLED', 'WHATSAPP_ENABLED', 'TELEGRAM_ENABLED', 'MAINTENANCE_MODE',
  'DEBUG', 'FEATURE_FLAG_SYNC',
]);

export function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(key) || /(_PASSWORD|_SECRET|_TOKEN|_KEY)$/.test(key);
}

function describeType(key: string): EnvKeyType {
  if (PORT_KEYS.has(key)) return 'port';
  if (URL_KEYS.has(key)) return 'url';
  if (BOOL_KEYS.has(key)) return 'bool';
  if (isSecretKey(key)) return 'secret';
  return 'string';
}

function validateValue(key: string, value: string): true {
  const type = describeType(key);
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`value for ${key} must be a non-empty string`);
  }
  if (/[\r\n\x00]/.test(value)) {
    throw new Error(`value for ${key} must be a single line (no newlines)`);
  }
  if (type === 'port') {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error(`${key} must be a port (1-65535)`);
  } else if (type === 'url') {
    try {
      const u = new URL(value);
      if (!/^https?:$/.test(u.protocol)) throw new Error('bad protocol');
    } catch {
      throw new Error(`${key} must be an absolute http(s) URL`);
    }
  } else if (type === 'bool') {
    if (!/^(true|false|1|0|yes|no)$/i.test(value)) throw new Error(`${key} must be a boolean (true/false)`);
  }
  return true;
}

// ---------------------------------------------------------------------------
// read / write / apply
// ---------------------------------------------------------------------------
interface EnvLine {
  raw: string;
  key: string | null;
  value: string | null;
}

function parseLines(text: string): EnvLine[] {
  return text.split(/\r?\n/).map((raw) => {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(raw);
    return m ? { raw, key: m[1], value: m[2].trim() } : { raw, key: null, value: null };
  });
}

/** Key/value list with secret masking (values replaced by `••••••` unless reveal). */
export function listKeys({ reveal = false }: { reveal?: boolean } = {}): EnvKeyInfo[] {
  if (!existsSync(ROOT_ENV_FILE)) return [];
  return parseLines(readFileSync(ROOT_ENV_FILE, 'utf8'))
    .filter((l): l is EnvLine & { key: string; value: string } => Boolean(l.key && l.value !== null))
    .map((l) => ({
      key: l.key,
      type: describeType(l.key),
      secret: isSecretKey(l.key),
      value: !isSecretKey(l.key) || reveal ? l.value : '••••••',
    }));
}

/**
 * Apply a set of {key, value} writes (value `null` deletes). Validates every
 * entry first (all-or-nothing), rewrites the file preserving order/comments,
 * then propagates via scripts/sync-env.mjs.
 */
export async function applyKeys(updates: EnvUpdate[], { skipSync = false }: { skipSync?: boolean } = {}): Promise<EnvApplyResult> {
  if (!Array.isArray(updates) || updates.length === 0) throw new Error('no updates provided');
  if (!existsSync(ROOT_ENV_FILE)) throw new Error(`root .env not found at ${ROOT_ENV_FILE}`);

  const plan = updates.map((u) => {
    if (!u || typeof u.key !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(u.key)) {
      throw new Error(`invalid env key: ${String(u?.key)}`);
    }
    if (u.value !== null && u.value !== undefined) validateValue(u.key, u.value);
    return { key: u.key, value: u.value ?? null };
  });

  const lines = parseLines(readFileSync(ROOT_ENV_FILE, 'utf8'));
  const written: string[] = [];
  const removed: string[] = [];
  for (const { key, value } of plan) {
    const idx = lines.findIndex((l) => l.key === key);
    if (value === null) {
      if (idx >= 0) lines.splice(idx, 1);
      removed.push(key);
    } else if (idx >= 0) {
      lines[idx] = { raw: `${key}=${value}`, key, value };
      written.push(key);
    } else {
      lines.push({ raw: `${key}=${value}`, key, value });
      written.push(key);
    }
  }

  const eol = readFileSync(ROOT_ENV_FILE, 'utf8').includes('\r\n') ? '\r\n' : '\n';
  writeFileSync(ROOT_ENV_FILE, lines.map((l) => l.raw).join(eol) + eol);

  let synced = false;
  let syncOutput = '';
  if (!skipSync) {
    try {
      syncOutput = await runSyncEnv();
      synced = true;
    } catch (err) {
      syncOutput = `sync-env failed: ${(err as Error).message}`;
    }
  }
  return { written, removed, synced, syncOutput };
}

// ---------------------------------------------------------------------------
// sync-env propagation
// ---------------------------------------------------------------------------
function runSyncEnv(): Promise<string> {
  const gateway = rootEnvValue('GATEWAY_URL');
  const base = gateway ? new URL(gateway).hostname : '127.0.0.1';
  const proto = gateway ? new URL(gateway).protocol.replace(':', '') : 'http';
  const args = [
    `${ROOT}/scripts/sync-env.mjs`,
    '--base', base,
    '--proto', proto,
    '--admin-port', rootEnvValue('ADMIN_PORT') || '3000',
    '--web-port', rootEnvValue('WEB_PORT') || '3001',
    '--media-port', rootEnvValue('MEDIA_PORT') || '5002',
    '--backend-port', rootEnvValue('PORT') || '5001',
  ];
  return new Promise((resolveSync, reject) => {
    execFile(process.execPath, args, { cwd: ROOT, timeout: 20_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || stdout || err.message));
      else resolveSync(stdout || 'ok');
    });
  });
}