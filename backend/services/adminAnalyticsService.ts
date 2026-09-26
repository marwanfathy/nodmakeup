// Admin analytics service — dashboard aggregation, live count, funnel,
// behavior insights and visitor reach. All persistence+redis access for the
// admin analytics surface lives here; controllers only parse query params.
import prisma from '../config/prismaClient';
import { redis } from '../config/redisClient';
import { Decimal } from '@prisma/client/runtime/library';

const formatDecimal = (val: any): number => {
    if (val instanceof Decimal) return val.toNumber();
    if (typeof val === 'string') return parseFloat(val);
    return val || 0;
};

const convertRawQueryBigInts = (results: any[]): any[] => {
    return (results || []).map((row) => {
        const newRow: any = {};
        for (const key in row) {
            const value = row[key];
            newRow[key] = typeof value === 'bigint' ? Number(value) : value;
        }
        return newRow;
    });
};

const successStatuses = ['Delivered', 'Shipped', 'Completed'];
const returnStatuses = ['Returned', 'Cancelled', 'Refunded'];

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

// ----------------------------- live count -----------------------------

/** Number of sessions marked live in Redis within the heartbeat TTL. */
export async function countLiveVisitors(): Promise<number> {
    try {
        const keys = await redis.keys('live_user:*');
        return Array.isArray(keys) ? keys.length : 0;
    } catch {
        return 0;
    }
}

// ----------------------------- dashboard -----------------------------

export interface AnalyticsQuery {
    startDate: Date;
    endDate: Date;
    lowStockThreshold: number;
}

/** Full dashboard payload: sales KPIs, regions, discounts, stock, stories, visits. */
export async function getAdminAnalytics({ startDate, endDate, lowStockThreshold }: AnalyticsQuery) {
    const [
        salesKpi,
        salesByRegion,
        discountUsageRaw,
        lowStockItems,
        storyPerformanceRaw,
        totalVisits,
        uniqueVisitorsGroup,
        liveKeysRaw,
        visitsByDayRaw,
        visitsByHourRaw,
        topProductsRaw,
        returnsCount,
        repeatCustomersRaw,
    ] = await Promise.all([
        prisma.order.aggregate({
            _sum: { totalPrice: true },
            _count: { id: true },
            _avg: { totalPrice: true },
            where: {
                createdAt: { gte: startDate, lte: endDate },
                status: { statusName: { in: successStatuses } },
            },
        }),

        prisma.order.groupBy({
            by: ['shippingGovernorate'],
            _sum: { totalPrice: true },
            _count: { id: true },
            where: {
                createdAt: { gte: startDate, lte: endDate },
                status: { statusName: { in: successStatuses } },
            },
            orderBy: { _sum: { totalPrice: 'desc' } },
        }),

        prisma.orderAppliedDiscount.groupBy({
            by: ['discountId'],
            _count: { orderId: true },
            where: {
                order: { createdAt: { gte: startDate, lte: endDate } },
            },
            orderBy: { _count: { orderId: 'desc' } },
            take: 10,
        }),

        prisma.productVariant.findMany({
            where: { stockQuantity: { gt: 0, lte: lowStockThreshold } },
            select: {
                id: true,
                sku: true,
                stockQuantity: true,
                colorName: true,
                size: true,
                product: { select: { id: true, name: true } },
            },
            orderBy: { stockQuantity: 'asc' },
            take: 20,
        }),

        prisma.story.findMany({
            where: { createdAt: { gte: startDate, lte: endDate } },
            select: { id: true, mediaUrl: true, viewCount: true, clickCount: true },
            orderBy: { viewCount: 'desc' },
            take: 10,
        }),

        prisma.siteVisit.count({
            where: { createdAt: { gte: startDate, lte: endDate } },
        }),

        prisma.siteVisit.groupBy({
            by: ['sessionId'],
            where: { createdAt: { gte: startDate, lte: endDate } },
        }),

        redis.keys('live_user:*').catch(() => []),

        prisma.$queryRaw`
            SELECT DATE(created_at) as date, COUNT(*) as visits
            FROM site_visits
            WHERE created_at >= ${startDate} AND created_at <= ${endDate}
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `.catch(() => []),

        prisma.$queryRaw`
            SELECT HOUR(created_at) as hour, COUNT(*) as visits
            FROM site_visits
            WHERE created_at >= ${startDate} AND created_at <= ${endDate}
            GROUP BY HOUR(created_at)
            ORDER BY hour ASC
        `.catch(() => []),

        prisma.orderItem.groupBy({
            by: ['variantId'],
            _sum: { quantity: true },
            where: {
                order: {
                    createdAt: { gte: startDate, lte: endDate },
                    status: { statusName: { in: successStatuses } },
                },
            },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 5,
        }),

        prisma.order.count({
            where: {
                createdAt: { gte: startDate, lte: endDate },
                status: { statusName: { in: returnStatuses } },
            },
        }),

        prisma.order.groupBy({
            by: ['customerPhoneNumber'],
            _count: { id: true },
            where: { createdAt: { gte: startDate, lte: endDate } },
        }),
    ]);

    const liveKeys = Array.isArray(liveKeysRaw) ? liveKeysRaw : [];

    const repeatCustomersGroup = (repeatCustomersRaw || []).filter((c) => (c?._count?.id || 0) > 1);

    const discountIds = (discountUsageRaw || []).map((d) => d.discountId);
    const variantIds = (topProductsRaw || []).map((p) => p.variantId);

    const [discountDetails, variantDetails] = await Promise.all([
        prisma.discount.findMany({
            where: { id: { in: discountIds } },
            select: { id: true, name: true, couponCode: true },
        }),
        prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            include: { product: { select: { name: true } } },
        }),
    ]);

    const visitsByDay = convertRawQueryBigInts(visitsByDayRaw as any[]);
    const visitsByHour = convertRawQueryBigInts(visitsByHourRaw as any[]);

    return {
        overview: {
            totalRevenue: formatDecimal(salesKpi?._sum?.totalPrice),
            totalOrders: salesKpi?._count?.id || 0,
            averageOrderValue: formatDecimal(salesKpi?._avg?.totalPrice),
            conversionRate: uniqueVisitorsGroup?.length
                ? (((salesKpi?._count?.id || 0) / uniqueVisitorsGroup.length) * 100).toFixed(2)
                : '0.00',
            totalReturns: returnsCount || 0,
            repeatCustomers: repeatCustomersGroup.length,
        },

        salesByRegion: (salesByRegion || []).map((r) => ({
            governorate: r.shippingGovernorate,
            totalSales: formatDecimal(r._sum?.totalPrice),
            orderCount: r._count?.id || 0,
        })),

        topSellingProducts: (topProductsRaw || []).map((item) => {
            const detail = variantDetails.find((v) => v.id === item.variantId);
            return {
                productName: detail?.product?.name || 'Unknown',
                variantInfo: `${detail?.colorName || ''} ${detail?.size || ''}`.trim(),
                quantitySold: item?._sum?.quantity ?? 0,
                sku: detail?.sku || 'N/A',
            };
        }),

        discountUsage: (discountUsageRaw || []).map((usage) => {
            const detail = discountDetails.find((d) => d.id === usage.discountId);
            return {
                name: detail?.name || 'Unknown',
                couponCode: detail?.couponCode || 'N/A',
                usageCount: usage?._count?.orderId || 0,
            };
        }),

        lowStockItems: (lowStockItems || []).map((i) => ({
            ...i,
            productName: i?.product?.name || 'Unknown',
        })),

        storyPerformance: (storyPerformanceRaw || []).map((s) => ({
            id: s.id,
            mediaUrl: s.mediaUrl,
            viewCount: s.viewCount,
            clickCount: s.clickCount,
            ctr: s.viewCount > 0 ? (s.clickCount / s.viewCount) * 100 : 0,
        })),

        visitorAnalytics: {
            liveVisitors: liveKeys.length,
            totalVisits,
            uniqueVisitors: uniqueVisitorsGroup.length,
            visitsByDay,
            visitsByHour,
        },
    };
}

// ----------------------------- recent behavior -----------------------------

/** Live behavioral feed (most recent clicks / scrolls / exits). */
export async function getRecentBehaviorEvents(limit: number) {
    return prisma.userEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
            id: true,
            sessionId: true,
            type: true,
            target: true,
            label: true,
            href: true,
            value: true,
            path: true,
            createdAt: true,
        },
    });
}

// ----------------------------- behavior insights -----------------------------

/**
 * Pattern recognition over recent behavior (top clicks, intent funnel, pages).
 * Returns the same payload shape as before extraction.
 */
export async function getBehaviorInsights(hours: number) {
    const since = hoursAgo(hours);

    const [clicks, scrolls, exits, byType, topPaths, funnel, addRate] = await Promise.all([
        // Most-clicked elements (group by label + target)
        prisma.userEvent.groupBy({
            by: ['label', 'target', 'type'],
            _count: { label: true },
            where: { type: 'CLICK', createdAt: { gte: since }, label: { not: '' } },
            orderBy: { _count: { label: 'desc' } },
            take: 40,
        }),
        // Scroll depth distribution
        prisma.userEvent.groupBy({
            by: ['value'],
            _count: { value: true },
            where: { type: 'SCROLL', createdAt: { gte: since }, value: { not: null } },
            orderBy: { _count: { value: 'desc' } },
        }),
        // External links clicked (leak analysis)
        prisma.userEvent.groupBy({
            by: ['label', 'href'],
            _count: { label: true },
            where: { type: 'EXIT_LINK', createdAt: { gte: since }, label: { not: '' } },
            orderBy: { _count: { label: 'desc' } },
            take: 20,
        }),
        prisma.userEvent.groupBy({
            by: ['type'],
            _count: { type: true },
            where: { createdAt: { gte: since } },
        }),
        prisma.siteVisit.groupBy({
            by: ['path'],
            _count: { path: true },
            where: { createdAt: { gte: since } },
            orderBy: { _count: { path: 'desc' } },
            take: 20,
        }),
        // REAL funnel: distinct sessions progressing product → cart → checkout → done.
        computeFunnel(since),
        prisma.userEvent.count({ where: { createdAt: { gte: since } } }),
    ]);

    const totalEvents = byType.reduce((sum: number, t: any) => sum + t._count.type, 0);
    const clicksTotal = byType.find((t: any) => t.type === 'CLICK')?._count.type || 0;

    return {
        hours,
        totalEvents,
        byType: byType.map((t: any) => ({ type: t.type, _count: t._count.type })),
        clicks: clicks.map((c: any) => ({
            label: c.label,
            target: c.target,
            count: c._count.label,
        })),
        scrolls: scrolls
            .map((s: any) => ({
                depth: s.value,
                count: s._count.value,
            }))
            .sort((a: any, b: any) => a.depth - b.depth),
        exitLinks: exits.map((e: any) => ({
            label: e.label,
            href: e.href,
            count: e._count.label,
        })),
        topPaths: topPaths.map((p: any) => ({ path: p.path, count: p._count.path })),
        funnel: {
            productPageVisits: funnel.levels[1].count,
            addToCartClicks: funnel.levels[2].count,
            checkoutReach: funnel.levels[3].count,
            checkoutRateFromAdds: funnel.conversions[2].pct,
            addRate: addRate > 0 ? Math.round((funnel.levels[2].count / addRate) * 100) : 0,
        },
        flagLowEngagement: totalEvents === 0,
    };
}

// ----------------------------- intent funnel -----------------------------

// REAL intent funnel: distinct sessions that progress through the shopping
// journey. Baseline for both the dashboard insights panel and GET /funnel.
//
// Purchase-to-session linkage (orders have no analytics-session column yet) is
// approximated by the completed order-flow path; the realtime purchase feed
// still streams paid orders live.

const funnelSiteVisitSessions = async (where: any): Promise<number> => {
    const rows = await prisma.siteVisit.findMany({
        where,
        distinct: ['sessionId'],
        select: { sessionId: true },
    });
    return rows.length;
};

const addToCartSessions = async (since: Date): Promise<number> => {
    // `resolveContext` in the storefront sets target to the data-track value
    // ('add_to_cart') and the label to the visible button text.
    const where: any = {
        createdAt: { gte: since },
        OR: [
            { target: 'add_to_cart' },
            { label: { contains: 'add to cart' } },
            { label: { contains: 'add to bag' } },
        ],
    };
    const rows = await prisma.userEvent.findMany({
        where,
        distinct: ['sessionId'],
        select: { sessionId: true },
    });
    return rows.length;
};

/** Distinct-session funnel levels + step conversions since `since`. */
export const computeFunnel = async (since: Date) => {
    const [sessions, product, cart, checkout, completed] = await Promise.all([
        funnelSiteVisitSessions({ createdAt: { gte: since } }),
        funnelSiteVisitSessions({ createdAt: { gte: since }, path: { contains: '/product/' } }),
        addToCartSessions(since),
        funnelSiteVisitSessions({ createdAt: { gte: since }, path: { contains: '/checkout' } }),
        funnelSiteVisitSessions({ createdAt: { gte: since }, path: { contains: 'order-success' } }),
    ]);

    const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

    return {
        levels: [
            { key: 'sessions', label: 'Sessions', count: sessions },
            { key: 'product', label: 'Viewed a product', count: product },
            { key: 'addToCart', label: 'Added to cart', count: cart },
            { key: 'checkout', label: 'Reached checkout', count: checkout },
            { key: 'completed', label: 'Completed order flow', count: completed },
        ],
        conversions: [
            { from: 'Sessions', to: 'Product view', pct: pct(product, sessions) },
            { from: 'Product view', to: 'Add to cart', pct: pct(cart, product) },
            { from: 'Add to cart', to: 'Checkout', pct: pct(checkout, cart) },
            { from: 'Checkout', to: 'Completed', pct: pct(completed, checkout) },
        ],
    };
};

/** Funnel payload for GET /analytics/funnel?days=N (N capped at 90). */
export async function getFunnelData(days: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return computeFunnel(since);
}

// ----------------------------- visitors -----------------------------

/** Recent first-party visitors with reach aggregates. */
export async function getAnalyticsVisitors(days: number, limit: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [visits, events] = await Promise.all([
        prisma.siteVisit.groupBy({
            by: ['visitorId'],
            _count: { _all: true, sessionId: true },
            _min: { createdAt: true },
            _max: { createdAt: true },
            where: { createdAt: { gte: since }, visitorId: { not: null } },
            orderBy: { _max: { createdAt: 'desc' } },
            take: limit,
        }),
        prisma.userEvent.groupBy({
            by: ['visitorId'],
            _count: { _all: true },
            where: { createdAt: { gte: since }, visitorId: { not: null } },
        }),
    ]);

    const eventCounts = new Map(events.map((e: any) => [e.visitorId, e._count._all]));

    const visitors = visits.map((v: any) => ({
        visitorId: v.visitorId,
        firstSeen: v._min.createdAt,
        lastSeen: v._max.createdAt,
        sessions: v._count.sessionId,
        visits: v._count._all,
        events: eventCounts.get(v.visitorId) || 0,
        // Heuristic: a returning visitor opened 2+ tabs (sessions) or made 2+
        // visits in the window — proof of repeat intent vs a single drop-in.
        returning: v._count.sessionId > 1 || v._count._all >= 2,
    }));

    return { days, total: visitors.length, visitors };
}