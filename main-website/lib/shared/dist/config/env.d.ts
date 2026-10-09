import { z } from 'zod';
declare const ServerEnvSchema: z.ZodObject<{
    nodeEnv: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    port: z.ZodDefault<z.ZodNumber>;
    databaseUrl: z.ZodString;
    redisUrl: z.ZodString;
    jwtSecret: z.ZodString;
    jwtExpiresIn: z.ZodDefault<z.ZodString>;
    gatewayUrl: z.ZodUnion<[z.ZodString, z.ZodString]>;
    mediaBaseUrl: z.ZodUnion<[z.ZodString, z.ZodString]>;
    adminPanelUrl: z.ZodUnion<[z.ZodString, z.ZodString]>;
    storeUrl: z.ZodDefault<z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>>;
    safeOrigins: z.ZodEffects<z.ZodString, string[], string>;
    telegramBotToken: z.ZodOptional<z.ZodString>;
    telegramAdminChatId: z.ZodOptional<z.ZodString>;
    /**
     * Rate-limit budgets, per IP, per 15-minute window.
     *
     * Configurable so a load environment can raise the checkout ceiling instead
     * of the production default being weakened to accommodate a test. The
     * flash-sale load test (deploy/loadtest/flash-sale.js) fires 100 simultaneous
     * checkouts from one address by design, which no real customer does and which
     * the default checkout budget correctly refuses.
     */
    rateLimitApiMax: z.ZodDefault<z.ZodNumber>;
    rateLimitAuthMax: z.ZodDefault<z.ZodNumber>;
    rateLimitCheckoutMax: z.ZodDefault<z.ZodNumber>;
    rateLimitCatalogMax: z.ZodDefault<z.ZodNumber>;
    /**
     * Order-tracking lookups, per IP, per 15-minute window. Lower than the
     * backstop because this route turns a bare order number into an order; the
     * ceiling is high enough for a customer checking their order a few times, and
     * low enough that it is not a convenient oracle to guess numbers with.
     */
    rateLimitTrackingMax: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    port: number;
    nodeEnv: "development" | "production" | "test";
    databaseUrl: string;
    redisUrl: string;
    jwtSecret: string;
    jwtExpiresIn: string;
    gatewayUrl: string;
    mediaBaseUrl: string;
    adminPanelUrl: string;
    storeUrl: string;
    safeOrigins: string[];
    rateLimitApiMax: number;
    rateLimitAuthMax: number;
    rateLimitCheckoutMax: number;
    rateLimitCatalogMax: number;
    rateLimitTrackingMax: number;
    telegramBotToken?: string | undefined;
    telegramAdminChatId?: string | undefined;
}, {
    databaseUrl: string;
    redisUrl: string;
    jwtSecret: string;
    gatewayUrl: string;
    mediaBaseUrl: string;
    adminPanelUrl: string;
    safeOrigins: string;
    port?: number | undefined;
    nodeEnv?: "development" | "production" | "test" | undefined;
    jwtExpiresIn?: string | undefined;
    storeUrl?: string | undefined;
    telegramBotToken?: string | undefined;
    telegramAdminChatId?: string | undefined;
    rateLimitApiMax?: number | undefined;
    rateLimitAuthMax?: number | undefined;
    rateLimitCheckoutMax?: number | undefined;
    rateLimitCatalogMax?: number | undefined;
    rateLimitTrackingMax?: number | undefined;
}>;
export type ServerEnv = z.infer<typeof ServerEnvSchema>;
/** Load and validate environment once per process. */
export declare function loadEnv(): ServerEnv;
/** Load environment from an already-parsed object (tests / worker entrypoints). */
export declare function setEnv(env: Partial<ServerEnv>): ServerEnv;
/** Inline URL used to reach this API service externally (public base). */
export declare function gatewayBaseUrl(): string;
/** Inline URL used to reach the media service externally. */
export declare function mediaBaseUrl(): string;
/** Origin allowlist for CORS and CSRF checks. */
export declare function safeOrigins(): string[];
/**
 * True when an Origin header may talk to this API. Strict explicit allowlist
 * from SAFE_ORIGINS (exact origins and/or `*.subdomain` wildcards) — no
 * implicit private-subnet trust. Undefined origins (non-browser clients) are
 * allowed. The matching logic lives in runtime/config.ts — one implementation.
 */
export declare function isOriginAllowed(origin: string | undefined): boolean;
export {};
