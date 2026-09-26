// Admin dashboard service — real-time KPI aggregation for the admin panel.
// Success statuses must match analyticsService exactly (single source of the
// dashboard's revenue/AOV math).
import prisma from '../config/prismaClient';
import { redis } from '../config/redisClient';

// TIP #11: Helper to safely convert BigInt/Decimal values
const toInt = (val: any) => (typeof val === 'bigint' ? Number(val) : val ?? 0);
const toNum = (val: any) => (val ? Number(val) : 0);

/** All summary queries run in parallel; math calibrated to match Analytics. */
export async function getDashboardStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // CRITICAL SYNC: exact same success logic as analytics
    const successStatuses = ['Delivered', 'Shipped', 'Completed'];

    const [salesKpi, shippingKpi, totalOrdersCount, newOrdersToday, pendingCount, lowStockCount, liveKeys, recentOrders] =
        await Promise.all([
            // 1. Successful Sales Financials (Revenue & AOV source)
            prisma.order.aggregate({
                _sum: { totalPrice: true },
                _count: { id: true }, // SUCCESSFUL orders count
                _avg: { totalPrice: true },
                where: { status: { statusName: { in: successStatuses } } },
            }),
            // 2. Shipping Revenue
            prisma.order.aggregate({
                _sum: { shippingCost: true },
                where: { status: { statusName: { in: successStatuses } } },
            }),
            // 3. All-time total volume (includes all statuses)
            prisma.order.count(),
            // 4. Activity today
            prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
            // 5. Urgent Action Items
            prisma.order.count({ where: { status: { statusName: 'Pending' } } }),
            // 6. Inventory Warnings
            prisma.productVariant.count({ where: { stockQuantity: { lte: 5 } } }),
            // 7. Live Visitors (Tip #7 - High Speed Cache)
            redis.keys('live_user:*'),
            // 8. Recent Activity List
            prisma.order.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    orderNumber: true,
                    customerName: true,
                    totalPrice: true,
                    createdAt: true,
                    status: { select: { statusName: true } },
                },
            }),
        ]);

    const totalRevenue = toNum(salesKpi._sum.totalPrice);
    const successOrderCount = salesKpi._count.id;
    const averageOrderValue = successOrderCount > 0 ? totalRevenue / successOrderCount : 0;

    return {
        // KPI Cards
        totalSales: totalRevenue,
        totalShippingRevenue: toNum(shippingKpi._sum.shippingCost),
        totalOrders: toInt(totalOrdersCount),
        newOrdersToday: toInt(newOrdersToday),
        averageOrderValue,

        // Real-time & Action Items
        liveVisitors: liveKeys.length,
        pendingOrders: toInt(pendingCount),
        lowStockAlerts: toInt(lowStockCount),

        // Lists
        recentOrders: recentOrders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            customerName: o.customerName,
            totalPrice: toNum(o.totalPrice),
            status: o.status.statusName,
            createdAt: o.createdAt,
        })),
    };
}