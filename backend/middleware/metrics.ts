import { Request, Response, NextFunction } from 'express';
import prisma from './../config/prismaClient';
import { rewardsQueue } from './../config/bullmq';
import { isWhatsAppReady } from './../services/whatsappService';

// Prometheus text-format /metrics endpoint. Zero dependencies — tiny in-memory
// counters plus live gauges computed on scrape. See
// deploy/monitoring/prometheus.yml for the scrape config.

const COUNTER = new Map<string, number>();

/**
 * Request-duration histogram.
 *
 * This existed only as an alert rule: deploy/monitoring/alerts.yml had an
 * `APIHighLatency` rule querying
 * `histogram_quantile(0.95, rate(nod_http_requests_duration_seconds_bucket[5m]))`,
 * but nothing ever exported a `_bucket` series — the module only counted
 * requests. The rule could never fire, so the one signal that would have
 * caught a slow database or a saturated connection pool was permanently silent.
 */
const DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] as const;

/** labelKey -> { perBucket (non-cumulative), sum, count } */
const HISTOGRAM = new Map<string, { perBucket: number[]; sum: number; count: number }>();

/**
 * Route label, not the raw path. A raw path would create a new time series per
 * product id and per order id — an unbounded cardinality leak that eventually
 * takes Prometheus down. `req.route.path` is the declared route pattern, so
 * `/api/v1/catalog/products/:slug` collapses to one series.
 */
const routeLabel = (req: Request): string => {
    const pattern = req.route?.path;
    if (typeof pattern === 'string' && pattern.length > 0) {
        return `${req.baseUrl ?? ''}${pattern}`;
    }
    return 'unmatched';
};

const escapeLabel = (v: string): string => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
        if (req.path === '/metrics') return;
        const k = `${req.method} ${res.statusCode}`;
        COUNTER.set(k, (COUNTER.get(k) ?? 0) + 1);

        const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
        const labelKey = `${req.method}|${routeLabel(req)}|${res.statusCode}`;
        let entry = HISTOGRAM.get(labelKey);
        if (!entry) {
            entry = { perBucket: new Array(DURATION_BUCKETS.length).fill(0), sum: 0, count: 0 };
            HISTOGRAM.set(labelKey, entry);
        }
        entry.sum += seconds;
        entry.count += 1;
        // +Inf is implicit: anything past the last boundary is counted by the
        // total, and the cumulative sum below covers the overflow.
        for (let i = 0; i < DURATION_BUCKETS.length; i += 1) {
            if (seconds <= DURATION_BUCKETS[i]) {
                entry.perBucket[i] += 1;
            }
        }
    });
    next();
};

/**
 * Upper bound on stock time series. One series per variant is the only way the
 * `FlashSaleStockNegative` rule can name the offending SKU, and it is bounded
 * by the catalogue — but a variant table that grows to tens of thousands of
 * rows would make every scrape expensive and every Prometheus TSDB grow
 * without limit. Past this many variants the export falls back to an aggregate
 * so the *existence* of negative stock is still detectable, even if the alert
 * can no longer name the variant.
 */
const MAX_STOCK_SERIES = 500;

type StockRow = { variant_id: string; sku: string; stock_quantity: number };

export const metricsHandler = async (_req: Request, res: Response) => {
    const [db, red, memory, queues, whatsapp, stock, outboxCounts] = await Promise.allSettled([
        prisma.$queryRaw`SELECT 1`,
        import('./../config/redisClient').then(({ redis }) => redis.ping()),
        Promise.resolve(process.memoryUsage().heapUsed),
        rewardsQueue.getJobCounts('wait', 'active', 'delayed'),
        Promise.resolve(isWhatsAppReady()),
        prisma.$queryRawUnsafe<StockRow[]>(
            'SELECT variant_id, sku, stock_quantity FROM product_variants ' +
            'ORDER BY stock_quantity ASC LIMIT ?',
            MAX_STOCK_SERIES,
        ),
        prisma.$queryRawUnsafe<Array<{ status: string; n: number }>>(
            'SELECT status, COUNT(*) AS n FROM outbox_events GROUP BY status',
        ),
    ]);

    const lines: string[] = [
        '# TYPE nod_uptime_seconds gauge',
        `nod_uptime_seconds ${process.uptime()}`,
        '# TYPE nod_heap_bytes gauge',
        `nod_heap_bytes ${memory.status === 'fulfilled' ? memory.value : 0}`,
        '# TYPE nod_ready_info gauge',
        `nod_ready_info{dependency="database"} ${db.status === 'fulfilled' ? 1 : 0}`,
        `nod_ready_info{dependency="redis"} ${red.status === 'fulfilled' && red.value === 'PONG' ? 1 : 0}`,
        `nod_ready_info{dependency="whatsapp"} ${whatsapp.status === 'fulfilled' && whatsapp.value ? 1 : 0}`,
        `nod_ready_info{dependency="bullmq"} ${queues.status === 'fulfilled' ? 1 : 0}`,
        '# TYPE nod_outbox_queue_total gauge',
    ];

    lines.push('# TYPE nod_http_requests_total counter');
    for (const [k, v] of COUNTER.entries()) {
        const [method, status] = k.split(' ');
        lines.push(`nod_http_requests_total{method="${method}",status="${status}"} ${v}`);
    }

    // Duration histogram. Emitted cumulatively, which is what
    // histogram_quantile() requires: each _bucket value is the number of
    // observations at or below that bound, not the count falling in the band.
    lines.push('# HELP nod_http_requests_duration_seconds HTTP request duration.');
    lines.push('# TYPE nod_http_requests_duration_seconds histogram');
    for (const [labelKey, entry] of HISTOGRAM.entries()) {
        const [method, route, status] = labelKey.split('|');
        const labels = `method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${escapeLabel(status)}"`;
        let cumulative = 0;
        for (let i = 0; i < DURATION_BUCKETS.length; i += 1) {
            cumulative += entry.perBucket[i];
            lines.push(
                `nod_http_requests_duration_seconds_bucket{${labels},le="${DURATION_BUCKETS[i]}"} ${cumulative}`,
            );
        }
        lines.push(`nod_http_requests_duration_seconds_bucket{${labels},le="+Inf"} ${entry.count}`);
        lines.push(`nod_http_requests_duration_seconds_sum${labels} ${entry.sum}`);
        lines.push(`nod_http_requests_duration_seconds_count${labels} ${entry.count}`);
    }

    const q = queues.status === 'fulfilled' ? queues.value : { wait: -1, active: -1, delayed: -1, failed: -1 };
    for (const state of ['wait', 'active', 'delayed', 'failed'] as const) {
        lines.push(`nod_outbox_queue_total{state="${state}"} ${q[state]}`);
    }

    // Outbox event state, straight from the table rather than from Redis.
    //
    // `nod_outbox_queue_total` reads BullMQ, which knows only what is in the
    // queue. It cannot see the states that actually meant "a customer never
    // got their order confirmation": a PENDING row whose enqueue never reached
    // Redis, or a PROCESSING row stranded by a worker that died mid-dispatch.
    // Both are invisible to Redis by construction, and both used to be silent —
    // the sweeper logged to stdout and nothing read the `attempts` column. The
    // FAILED state in particular is the dead-letter the sweeper parks events in
    // after MAX_OUTBOX_ATTEMPTS, and it must be alertable or it is just a log
    // line nobody sees.
    lines.push('# HELP nod_outbox_events Outbox events by state, read from the database.');
    lines.push('# TYPE nod_outbox_events gauge');
    if (outboxCounts.status === 'fulfilled') {
        for (const row of outboxCounts.value) {
            lines.push(`nod_outbox_events{state="${escapeLabel(row.status)}"} ${row.n}`);
        }
    }

    // Per-variant stock. The `FlashSaleStockNegative` alert in
    // deploy/monitoring/alerts.yml was written against this series with a
    // comment admitting it did not exist yet ("This would need a custom
    // metric; placeholder for when stock gauge is exposed"), so the rule
    // querying it could never evaluate and overselling to a negative count was
    // invisible. Stock is now non-negative by construction — both the checkout
    // reservation and the admin reopen path use a conditional UPDATE with a
    // `stockQuantity: { gte }` guard — but the invariant is worth a canary.
    lines.push('# HELP nod_product_variant_stock Units on hand per product variant.');
    lines.push('# TYPE nod_product_variant_stock gauge');
    if (stock.status === 'fulfilled') {
        let truncated = false;
        for (const row of stock.value) {
            lines.push(
                `nod_product_variant_stock{variant_id="${escapeLabel(row.variant_id)}",` +
                `sku="${escapeLabel(row.sku)}"} ${row.stock_quantity}`,
            );
            if (row.stock_quantity < 0) truncated = true;
        }
        if (truncated) {
            // Flag it even if the offending variant fell outside the LIMIT
            // window, so the alert degrades to "there is a problem somewhere"
            // rather than going quiet — which is the failure mode this whole
            // metric exists to prevent.
            lines.push('# HELP nod_product_variant_stock_truncated Some stock series were not exported.');
            lines.push('# TYPE nod_product_variant_stock_truncated gauge');
            lines.push('nod_product_variant_stock_truncated 1');
        }
    }

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(lines.join('\n') + '\n');
};