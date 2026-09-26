"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnv = loadEnv;
exports.setEnv = setEnv;
exports.gatewayBaseUrl = gatewayBaseUrl;
exports.mediaBaseUrl = mediaBaseUrl;
exports.safeOrigins = safeOrigins;
exports.isOriginAllowed = isOriginAllowed;
const zod_1 = require("zod");
const config_1 = require("../runtime/config");
/**
 * NOD Makeup — environment configuration (servers / workers).
 *
 * URLs and secrets only. Endpoint paths live in `api/endpoints.ts` and are
 * NEVER part of the env surface.
 *
 * Fail-fast: missing required values throw at boot with a clear message.
 */
const url = zod_1.z
    .string()
    .url()
    .or(zod_1.z.string().regex(/^https?:\/\/[^ ]+$/i));
const ServerEnvSchema = zod_1.z.object({
    nodeEnv: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    port: zod_1.z.coerce.number().int().positive().default(5001),
    databaseUrl: zod_1.z.string().min(1, 'DATABASE_URL is required'),
    redisUrl: zod_1.z.string().min(1, 'REDIS_URL is required'),
    jwtSecret: zod_1.z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
    jwtExpiresIn: zod_1.z.string().default('15m'),
    gatewayUrl: url,
    mediaBaseUrl: url,
    adminPanelUrl: url,
    storeUrl: url.optional().default(''),
    safeOrigins: zod_1.z
        .string()
        .min(1, 'SAFE_ORIGINS is required')
        .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
    telegramBotToken: zod_1.z.string().optional(),
    telegramAdminChatId: zod_1.z.string().optional(),
    /**
     * Rate-limit budgets, per IP, per 15-minute window.
     *
     * Configurable so a load environment can raise the checkout ceiling instead
     * of the production default being weakened to accommodate a test. The
     * flash-sale load test (deploy/loadtest/flash-sale.js) fires 100 simultaneous
     * checkouts from one address by design, which no real customer does and which
     * the default checkout budget correctly refuses.
     */
    rateLimitApiMax: zod_1.z.coerce.number().int().positive().default(1000),
    rateLimitAuthMax: zod_1.z.coerce.number().int().positive().default(10),
    rateLimitCheckoutMax: zod_1.z.coerce.number().int().positive().default(60),
    rateLimitCatalogMax: zod_1.z.coerce.number().int().positive().default(600),
});
const envKeys = {
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
    rateLimitApiMax: 'RATE_LIMIT_API_MAX',
    rateLimitAuthMax: 'RATE_LIMIT_AUTH_MAX',
    rateLimitCheckoutMax: 'RATE_LIMIT_CHECKOUT_MAX',
    rateLimitCatalogMax: 'RATE_LIMIT_CATALOG_MAX',
};
function pickEnv() {
    const out = {};
    for (const [key, envName] of Object.entries(envKeys)) {
        if (process.env[envName] !== undefined)
            out[key] = process.env[envName];
    }
    if (process.env.SAFE_ORIGINS !== undefined)
        out.safeOrigins = process.env.SAFE_ORIGINS;
    return out;
}
let cached = null;
/** Load and validate environment once per process. */
function loadEnv() {
    if (cached)
        return cached;
    const parsed = ServerEnvSchema.safeParse(pickEnv());
    if (!parsed.success) {
        const issues = parsed.error.issues
            .map((i) => { var _a; return `  - ${i.path.join('.')}: ${i.message} (env: ${(_a = envKeys[i.path[0]]) !== null && _a !== void 0 ? _a : i.path[0]})`; })
            .join('\n');
        throw new Error(`[env] Configuration invalid — fix .env and restart.\n${issues}`);
    }
    cached = parsed.data;
    return cached;
}
/** Load environment from an already-parsed object (tests / worker entrypoints). */
function setEnv(env) {
    cached = ServerEnvSchema.parse({ ...loadEnvInitial(), ...env });
    return cached;
}
function loadEnvInitial() {
    const raw = ServerEnvSchema.parse(pickEnv());
    return raw;
}
/** Inline URL used to reach this API service externally (public base). */
function gatewayBaseUrl() {
    return loadEnv().gatewayUrl.replace(/\/+$/, '');
}
/** Inline URL used to reach the media service externally. */
function mediaBaseUrl() {
    return loadEnv().mediaBaseUrl.replace(/\/+$/, '');
}
/** Origin allowlist for CORS and CSRF checks. */
function safeOrigins() {
    return loadEnv().safeOrigins;
}
/**
 * True when an Origin header may talk to this API. Strict explicit allowlist
 * from SAFE_ORIGINS (exact origins and/or `*.subdomain` wildcards) — no
 * implicit private-subnet trust. Undefined origins (non-browser clients) are
 * allowed. The matching logic lives in runtime/config.ts — one implementation.
 */
function isOriginAllowed(origin) {
    return (0, config_1.allowOrigin)(origin, safeOrigins());
}
