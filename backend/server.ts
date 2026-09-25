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
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use('/api/', apiLimiter);

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