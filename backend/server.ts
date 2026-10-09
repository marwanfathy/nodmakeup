// --- Core Dependencies ---
import express, { Application, Request, Response, NextFunction } from 'express';
import cors, { CorsOptions } from 'cors';
import http from 'http';

// --- Configuration (fail-fast env; MUST be imported first) ---
import { env, isOriginAllowed } from './config/env';

// --- Middleware & Security Dependencies ---
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import compression from 'compression';

// --- Database & Cache ---
import prisma from './config/prismaClient';
import { connectRedis, redis } from './config/redisClient';

// --- Custom Middleware & Utilities ---
import { notFound, errorHandler } from './middleware/errorMiddleware';
import { requestId } from './middleware/requestId';
import { bindRequestContext, logger, reqLogger } from './config/logger';
import { Sentry, initSentry } from './config/sentry';
import { metricsMiddleware, metricsHandler } from './middleware/metrics';
import { csrfProtect } from './middleware/csrf';
import { RedisRateLimitStore } from './middleware/redisRateLimitStore';
import { initWhatsApp, isWhatsAppReady } from './services/whatsappService';
import { initTelegramBot, bot as telegramBot } from './utils/telegramReporting';
import { startOutboxWorker } from './workers/outboxWorker';
import { rewardsQueue } from './config/bullmq';
import { analyticsSseHandler, ANALYTICS_REALTIME_PATH } from './realtime/analyticsSse';
import { startRetentionJob } from './jobs/retentionJob';

// --- Route File Imports ---
import publicProductRoutes from './routes/public/productRoutes';
import publicCategoryRoutes from './routes/public/categoryRoutes';
import cartRoutes from './routes/public/cartRoutes';
import publicStoryRoutes from './routes/public/storyRoutes';
import publicCollectionRoutes from './routes/public/collectionRoutes';
import publicShippingRoutes from './routes/public/shippingRoutes';
import publicDiscountRoutes from './routes/public/discountRoutes';
import publicOrderRoutes from './routes/public/orderRoutes';
import publicAnalyticsRoutes from './routes/public/analyticsRoutes';
import publicHeroSectionRoutes from './routes/public/heroSectionRoutes';
import publicLandingBannerRoutes from './routes/public/landingBannerRoutes';
import publicLandingLayoutRoutes from './routes/public/landingLayoutRoutes';

import adminAuthRoutes from './routes/admin/authRoutes';
import adminDashboardRoutes from './routes/admin/dashboardRoutes';
import adminProductRoutes from './routes/admin/productRoutes';
import adminProductImageRoutes from './routes/admin/productImageRoutes';
import adminCategoryRoutes from './routes/admin/categoryRoutes';
import adminBrandRoutes from './routes/admin/brandRoutes';
import adminCollectionRoutes from './routes/admin/collectionRoutes';
import adminOrderRoutes from './routes/admin/orderRoutes';
import adminDiscountRoutes from './routes/admin/discountRoutes';
import adminStoryRoutes from './routes/admin/storyRoutes';
import adminUserRoutes from './routes/admin/adminRoutes';
import adminAnalyticsRoutes from './routes/admin/analyticsRoutes';
import heroSectionRoutes from './routes/admin/heroSectionRoutes';
import adminLandingBannerRoutes from './routes/admin/landingBannerRoutes';
import adminLandingLayoutRoutes from './routes/admin/landingLayoutRoutes';
import crmRoutes from './routes/admin/crmRoutes';

const app: Application = express();
const PORT: string | number = env.port;
const NODE_ENV: string = env.nodeEnv;

// CRITICAL: Prevents 500 errors when sending Analytics data (BigInt/Raw SQL)
(BigInt.prototype as any).toJSON = function () { return Number(this); };

app.set('trust proxy', 1);

let isShuttingDown = false;

// --- 1. MIDDLEWARE ---
app.use(helmet());
if (initSentry()) {
    reqLogger().info('sentry enabled with SENTRY_DSN');
}
app.use(requestId);
app.use(bindRequestContext);
app.use(compression());
app.disable('x-powered-by');
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
    if (isShuttingDown) {
        res.set('Connection', 'close');
        res.status(503).send('Server is shutting down.');
    } else {
        next();
    }
});

// --- 2. CORS (strict allowlist — shared origin matcher, no implicit LAN) ---

const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        // callback(null, false) omits CORS headers → browser blocks the call
        // cleanly (no 5xx from the API for a rejected cross-origin request).
        callback(null, isOriginAllowed(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-cart-session-id", "x-csrf-token", "x-request-id", "x-requested-with"]
};
app.use(cors(corsOptions));

// pino-http structured access log — every line carries the request id
// (pinned by the requestId middleware) for end-to-end correlation.
app.use(pinoHttp({
    logger,
    genReqId: (req) => (req as Request).requestId ?? '-',
    customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    autoLogging: { ignore: (req) => (req as Request).url?.startsWith('/metrics') ?? false },
    redact: {
        paths: ['req.headers.cookie', 'req.headers.authorization'],
        censor: '[redacted]',
    },
}));
app.use(metricsMiddleware);

// --- 3. ROUTES (v1 taxonomy — see shared/api/endpoints.ts) ---
//
// Rate limiting.
//
// This used to be one rule for all of `/api/`: 1000 requests per 15 minutes,
// counted in-process. Two problems, both fixed below.
//
//  - One budget for everything meant it was simultaneously far too generous for
//    the endpoints worth attacking and far too tight for the ones worth
//    fetching. A storefront client that loads a category page, opens a product
//    and reads a handful of stories can exhaust its own 1000 in a long
//    browsing session and start seeing 429s on plain navigation, while an
//    attacker running 1000 guesses against admin login never touched the
//    limit that mattered.
//  - Counting in-process (the express-rate-limit default) makes the number
//    per-instance, so N pods allow N x 1000, and a restart resets everyone's
//    allowance. A crash loop is a rate-limit bypass.
//
// The tiers below are per-route and share counters through Redis.
//
// A note on limiter keys, because it is the thing most easily got wrong: every
// key here is derived from the socket address, never from a request header.
// The `x-cart-session-id` header looks like a better identity for the checkout
// limiter — it survives carrier-grade NAT, where many customers share one
// egress IP — but it is attacker-controlled. A script that sends a fresh
// random value per request gets a brand-new allowance every time. Validating
// the *format* does not help either, since the attacker just generates
// well-formed UUIDs: 35 attempts with 35 distinct valid session ids were
// measured creating 35 separate counters, each at 1, with the limit never
// reached. So the checkout limiter keys on IP, and the budget is set high
// enough that a shared NAT cannot plausibly hit it.

/** Shared window for the IP-keyed tiers. Catalog deliberately uses a shorter one. */
const RATE_WINDOW_MS = 15 * 60 * 1000;

/**
 * IP-derived rate limit key.
 *
 * IPv6 is the reason this exists. A residential v6 address is commonly a
 * /64, so a single subscriber is handed 2^64 addresses and a naive
 * `req.ip` key can be rotated per request — which turns the limiter into a
 * no-op for exactly the traffic it is meant to constrain. Masking to the /64
 * collapses a subscriber's range to one bucket while still keeping genuinely
 * distinct IPv6 customers apart.
 *
 * `ipKeyGenerator` upstream (express-rate-limit 7.5.x exports only
 * `default`/`rateLimit`/`MemoryStore`) would be the canonical import; this is
 * the same idea, written locally to avoid bumping the dependency.
 */
const ipKeyGenerator = (req: Request): string => {
    const ip = req.ip ?? '';
    if (ip.includes(':')) {
        // Keep the first four hextets: /64 is the usual single-subscriber block.
        return ip.split(':').slice(0, 4).join(':');
    }
    return ip;
};

/** Broad backstop, mounted first so the stricter rules below can be tighter. */
const apiLimiter = rateLimit({
    windowMs: RATE_WINDOW_MS,
    max: env.rateLimitApiMax,
    store: new RedisRateLimitStore({ prefix: 'rl:api:' }),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please slow down.' },
});

/**
 * Admin login. The only endpoint in the system that takes a secret, so it gets
 * the tightest budget and a key that is per-IP regardless of any header — a
 * client that sets a cart-session header must not be able to mint a new
 * allowance per attempt.
 *
 * Scoped to `POST .../login` specifically, not the whole auth router. Mounted
 * with `use`, the refresh and `/me` endpoints were inside the budget too, and
 * the admin panel calls `/me` on every page load and after every token
 * refresh — 10 calls per 15 minutes would have locked administrators out of
 * their own panel.
 */
const authLimiter = rateLimit({
    windowMs: RATE_WINDOW_MS,
    max: env.rateLimitAuthMax,
    store: new RedisRateLimitStore({ prefix: 'rl:auth:' }),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true, // only failed attempts count
    message: { success: false, message: 'Too many failed sign-in attempts. Try again later.' },
});

/**
 * Order placement — `POST /api/v1/orders` only.
 *
 * Deliberately not mounted on `/api/v1/orders` as a whole. That prefix also
 * carries the cart read/write endpoints, and the flash-sale load test caught
 * exactly this: 100 VUs seeding a cart got 429 on 72 of them, because every
 * VU has no cart session yet (it is issued *by* the seed call) and so fell back
 * to the shared-IP key, letting the first 30 VUs consume the whole checkout
 * budget before any of them reached checkout. It would also have throttled
 * `GET /api/v1/orders/:orderId`, the confirmation page the customer lands on
 * straight after paying attention to their order.
 *
 * Keyed on the caller's IP, not on the cart session. See the note above the
 * `ipKeyGenerator` helper: a client-supplied session header cannot be the sole
 * limiter key, because a client can mint unlimited valid ones.
 *
 * 30 orders per 15 minutes was tried first and the load test immediately proved
 * it wrong, refusing 70 of 100 simultaneous checkouts with 429. A successful
 * flash sale legitimately puts dozens of orders in a burst, and in Egypt that
 * traffic routinely arrives through carrier-grade NAT, so every customer behind
 * one egress IP shares this budget. Tightening it does not just slow an attack,
 * it blocks the sale.
 *
 * The real protections against overselling do not depend on this number:
 * checkout reserves stock with a conditional `stockQuantity: { gte }` UPDATE, so
 * a unit cannot be sold twice no matter how many orders arrive, and
 * `checkoutKey` makes a duplicate submission idempotent rather than
 * duplicative. This ceiling bounds the damage an order-spam script can do to
 * the fulfilment queue on a Cash-on-Delivery store; it is not the thing that
 * makes stock correct.
 */
const checkoutLimiter = rateLimit({
    windowMs: RATE_WINDOW_MS,
    max: env.rateLimitCheckoutMax,
    store: new RedisRateLimitStore({ prefix: 'rl:checkout:' }),
    keyGenerator: ipKeyGenerator,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many checkout attempts. Please wait a moment.' },
});

/**
 * Catalogue reads. These are the highest-volume, lowest-value endpoints, and
 * they are all cacheable, so the ceiling is high enough that a real browsing
 * session never sees it: a single page view costs roughly a dozen calls, and
 * 10/second leaves an order of magnitude of headroom.
 */
const catalogLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: env.rateLimitCatalogMax,
    store: new RedisRateLimitStore({ prefix: 'rl:catalog:' }),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please slow down.' },
});

/**
 * Public order tracking — `POST /api/v1/orders/track`.
 *
 * A customer checks their order a handful of times, so the budget is generous
 * for that. It is well below the backstop because the route turns a bare order
 * number into an order, and a looser budget would make it a cheap way to try
 * guesses against the order table. Keyed on normalized IP like checkout, for
 * the same reason: a client-supplied header must not mint a new allowance.
 */
const trackingLimiter = rateLimit({
    windowMs: RATE_WINDOW_MS,
    max: env.rateLimitTrackingMax,
    store: new RedisRateLimitStore({ prefix: 'rl:tracking:' }),
    keyGenerator: ipKeyGenerator,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many tracking attempts. Please wait a moment.' },
});

app.use('/api/', apiLimiter);
// Narrower rules shadow the backstop for the exact operations that warrant them.
app.post('/api/v1/users/auth/login', authLimiter);
app.post('/api/v1/orders', checkoutLimiter);
// Tracking is a separate endpoint on the same resource, so it gets its own
// budget. `app.post` matches the exact path, so this does not widen checkout.
app.post('/api/v1/orders/track', trackingLimiter);
app.use('/api/v1/catalog/', catalogLimiter);
app.use('/api/v1/content/', catalogLimiter);

// Catalog (admin first — numeric-ID guards let slugs fall through to public)
app.use('/api/v1/catalog/products', csrfProtect, adminProductRoutes);
app.use('/api/v1/catalog/products', publicProductRoutes);
app.use('/api/v1/catalog/product-images', csrfProtect, adminProductImageRoutes);
app.use('/api/v1/catalog/categories', csrfProtect, adminCategoryRoutes);
app.use('/api/v1/catalog/categories', publicCategoryRoutes);
app.use('/api/v1/catalog/brands', csrfProtect, adminBrandRoutes);
app.use('/api/v1/catalog/collections', csrfProtect, adminCollectionRoutes);
app.use('/api/v1/catalog/collections', publicCollectionRoutes);

// Content (admin first with numeric guards; public slug handlers fall through)
app.use('/api/v1/content/stories', csrfProtect, adminStoryRoutes);
app.use('/api/v1/content/stories', publicStoryRoutes);
app.use('/api/v1/content/hero-sections', csrfProtect, heroSectionRoutes);
app.use('/api/v1/content/hero-sections', publicHeroSectionRoutes);
// Singleton slot, so no :id guard — protectIfToken alone splits admin from public.
app.use('/api/v1/content/landing-banner', csrfProtect, adminLandingBannerRoutes);
app.use('/api/v1/content/landing-banner', publicLandingBannerRoutes);
// The homepage section order, same singleton shape as the banner. Which sections
// exist is registered in code, so there is nothing to guard by id here either.
app.use('/api/v1/content/landing-layout', csrfProtect, adminLandingLayoutRoutes);
app.use('/api/v1/content/landing-layout', publicLandingLayoutRoutes);

// Orders (cart, orders, shipping-zones, discounts)
app.use('/api/v1/orders/cart', cartRoutes);
app.use('/api/v1/orders/shipping-zones', publicShippingRoutes);
// Discounts must be mounted BEFORE the generic /orders routes (Express matches in order)
app.use('/api/v1/orders/discounts', csrfProtect, adminDiscountRoutes);
app.use('/api/v1/orders/discounts', publicDiscountRoutes);
app.use('/api/v1/orders', csrfProtect, adminOrderRoutes);
app.use('/api/v1/orders', publicOrderRoutes);

// Users
app.use('/api/v1/users/auth', adminAuthRoutes);
app.use('/api/v1/users/admins', csrfProtect, adminUserRoutes);

// Analytics
// Public analytics ingest (events, live count) must come before the CSRF-gated
// admin chain: csrfProtect is cookie-gated, so a browser logged into the admin
// panel would otherwise 403 the storefront's event POSTs (its jwt cookie rides
// along to every localhost:5001 request). Paths are disjoint (public owns
// /events/* and /active-sessions; admin owns the dashboard reads).
app.use('/api/v1/analytics', publicAnalyticsRoutes);
app.use('/api/v1/analytics', csrfProtect, adminAnalyticsRoutes);
app.use('/api/v1/analytics/dashboard', adminDashboardRoutes);
// Real-time analytics push (SSE) — one plain HTTP stream for the admin panel.
app.get(ANALYTICS_REALTIME_PATH, analyticsSseHandler);

// CRM (admin-only system)
app.use('/api/v1/crm', csrfProtect, crmRoutes);

// --- HEALTH ENDPOINTS (unauthenticated, infra-only) ---
app.get('/healthz', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
});
app.get('/readyz', async (req: Request, res: Response) => {
    const [db, rd, wa, queue] = await Promise.allSettled([
        prisma.$queryRaw`SELECT 1`,
        redis.ping(),
        Promise.resolve(isWhatsAppReady()),
        rewardsQueue.getJobCounts('wait', 'active', 'delayed'),
    ]);

    const checks = {
        database: db.status === 'fulfilled',
        redis: rd.status === 'fulfilled' && rd.value === 'PONG',
        whatsapp: wa.status === 'fulfilled' && wa.value === true,
        bullmq: queue.status === 'fulfilled',
    };

    if (checks.database && checks.redis) {
        res.status(200).json({ status: 'ready', checks });
    } else {
        res.status(503).json({ status: 'not_ready', checks });
    }
});

// --- METRICS (Prometheus text format — infra-only, always on) ---
app.get('/metrics', metricsHandler);

app.use(notFound);
app.use(errorHandler);

// Wait until after the /metrics hook is registered before we stop needing Sentry
// request-scoped middleware; error reporting lives in errorMiddleware.ts (Sentry.captureException).

// --- 4. STARTUP & SHUTDOWN ---
const main = async () => {
    let server: http.Server;

    try {
        await prisma.$connect();
        reqLogger().info('database connected');

        await connectRedis();
        reqLogger().info('redis connected');

        server = http.createServer(app);

        reqLogger().info('analytics SSE hub ready on /api/v1/analytics/realtime');

        server.listen(PORT, () => {
            reqLogger().info(`server listening on ${PORT} [${NODE_ENV}]`);

            // Local dev runs the outbox worker in-process; production uses dist/workers/run.js.
            if (NODE_ENV === 'development') {
                startOutboxWorker();
                reqLogger().info('outbox worker running in-process (dev mode)');
            }

            // Fire-and-forget: init Telegram and WhatsApp in parallel, non-blocking
            initTelegramBot().catch(err => reqLogger().error({ err }, 'telegram init failed'));
            initWhatsApp().catch(err => reqLogger().error({ err }, 'whatsapp init failed'));

            startRetentionJob();
        });

        const gracefulShutdown = async (signal: string, err?: any) => {
            if (isShuttingDown) return;
            isShuttingDown = true;
            reqLogger().info({ signal }, 'shutdown initiated');
            if (err) reqLogger().error({ err }, 'shutdown error detail');

            if (server) {
                server.close(async () => {
                    try {
                        await prisma.$disconnect();
                        if (redis.isOpen) await redis.quit();
                        process.exit(err ? 1 : 0);
                    } catch (shutdownErr) {
                        process.exit(1);
                    }
                });
            } else {
                process.exit(err ? 1 : 0);
            }
            setTimeout(() => process.exit(1), 10000);
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('uncaughtException', (e) => gracefulShutdown('UNCAUGHT_EXCEPTION', e));
        process.on('unhandledRejection', (r) => gracefulShutdown('UNHANDLED_REJECTION', r));

    } catch (error) {
        reqLogger().fatal({ err: error }, 'fatal: server failed to start');
        process.exit(1);
    }
};

main();