import { z } from 'zod';
import { allowOrigin } from '../runtime/config';

/**
 * NOD Makeup — environment configuration (servers / workers).
 *
 * URLs and secrets only. Endpoint paths live in `api/endpoints.ts` and are
 * NEVER part of the env surface.
 *
 * Fail-fast: missing required values throw at boot with a clear message.
 */

const url = z
  .string()
  .url()
  .or(z.string().regex(/^https?:\/\/[^ ]+$/i));

const ServerEnvSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().int().positive().default(5001),

  databaseUrl: z.string().min(1, 'DATABASE_URL is required'),
  redisUrl: z.string().min(1, 'REDIS_URL is required'),
  jwtSecret: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  jwtExpiresIn: z.string().default('15m'),

  gatewayUrl: url,
  mediaBaseUrl: url,
  adminPanelUrl: url,
  storeUrl: url.optional().default(''),
  safeOrigins: z
    .string()
    .min(1, 'SAFE_ORIGINS is required')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  telegramBotToken: z.string().optional(),
  telegramAdminChatId: z.string().optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

const envKeys: Record<keyof Omit<ServerEnv, 'safeOrigins'>, string> = {
  nodeEnv: 'NODE_ENV',
  port: 'PORT',
  databaseUrl: 'DATABASE_URL',
  redisUrl: 'REDIS_URL',
  jwtSecret: 'JWT_SECRET',
  jwtExpiresIn: 'JWT_EXPIRES_IN',
  gatewayUrl: 'GATEWAY_URL',
  mediaBaseUrl: 'MEDIA_BASE_URL',
  adminPanelUrl: 'ADMIN_PANEL_URL',
  storeUrl: 'STORE_URL',
  telegramBotToken: 'TELEGRAM_BOT_TOKEN',
  telegramAdminChatId: 'TELEGRAM_ADMIN_CHAT_ID',
};

function pickEnv(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, envName] of Object.entries(envKeys)) {
    if (process.env[envName] !== undefined) out[key] = process.env[envName];
  }
  if (process.env.SAFE_ORIGINS !== undefined) out.safeOrigins = process.env.SAFE_ORIGINS;
  return out;
}

let cached: ServerEnv | null = null;

/** Load and validate environment once per process. */
export function loadEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = ServerEnvSchema.safeParse(pickEnv());
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message} (env: ${envKeys[(i.path[0] as keyof typeof envKeys)] ?? i.path[0]})`)
      .join('\n');
    throw new Error(`[env] Configuration invalid — fix .env and restart.\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Load environment from an already-parsed object (tests / worker entrypoints). */
export function setEnv(env: Partial<ServerEnv>): ServerEnv {
  cached = ServerEnvSchema.parse({ ...loadEnvInitial(), ...env });
  return cached;
}

function loadEnvInitial(): ServerEnv {
  const raw = ServerEnvSchema.parse(pickEnv());
  return raw;
}

/** Inline URL used to reach this API service externally (public base). */
export function gatewayBaseUrl(): string {
  return loadEnv().gatewayUrl.replace(/\/+$/, '');
}

/** Inline URL used to reach the media service externally. */
export function mediaBaseUrl(): string {
  return loadEnv().mediaBaseUrl.replace(/\/+$/, '');
}

/** Origin allowlist for CORS and CSRF checks. */
export function safeOrigins(): string[] {
  return loadEnv().safeOrigins;
}

/**
 * True when an Origin header may talk to this API. Strict explicit allowlist
 * from SAFE_ORIGINS (exact origins and/or `*.subdomain` wildcards) — no
 * implicit private-subnet trust. Undefined origins (non-browser clients) are
 * allowed. The matching logic lives in runtime/config.ts — one implementation.
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  return allowOrigin(origin, safeOrigins());
}