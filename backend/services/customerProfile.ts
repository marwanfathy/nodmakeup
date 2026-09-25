import { Prisma } from '@prisma/client';

// --- Customer segmentation ---
// NEW   = 1 order
// REPEAT = 2-4 orders (or total served >= EGP 1,000)
// LOYAL  = 5-9 orders (or total spend >= EGP 3,000)
// VIP    = 10+ orders or total spend >= EGP 7,500
export const SEGMENT_ORDER = ['NEW', 'REPEAT', 'LOYAL', 'VIP'];

export function computeSegment(totalOrders: number, totalSpent: number): string {
    const spent = Number(totalSpent) || 0;
    if (totalOrders >= 10 || spent >= 7500) return 'VIP';
    if (totalOrders >= 5 || spent >= 3000) return 'LOYAL';
    if (totalOrders >= 2 || spent >= 1000) return 'REPEAT';
    return 'NEW';
}

interface OrderSnapshot {
    id: string;
    customerName: string;
    customerPhoneNumber: string;
    shippingAddressLine1: string;
    shippingGovernorate: string;
    totalPrice: Prisma.Decimal | number | string;
    createdAt: Date;
}

/**
 * Upsert a CustomerProfile from a newly placed order. Runs inside the
 * checkout transaction so profile and order stay consistent. Segment is
 * recomputed from the incremented order count / spend.
 */
export async function syncCustomerProfileFromOrder(
    tx: Prisma.TransactionClient,
    order: OrderSnapshot
): Promise<void> {
    const existing = await tx.customerProfile.findUnique({
        where: { phone: order.customerPhoneNumber },
        select: { id: true, totalOrders: true, totalSpent: true },
    });

    const nextOrders = (existing?.totalOrders ?? 0) + 1;
    const nextSpent = Number(existing?.totalSpent ?? 0) + Number(order.totalPrice);

    const data = {
        name: order.customerName,
        email: null,
        governorate: order.shippingGovernorate,
        address: order.shippingAddressLine1,
        totalOrders: nextOrders,
        totalSpent: nextSpent,
        lastOrderAt: order.createdAt,
        segment: computeSegment(nextOrders, nextSpent),
    };

    if (existing) {
        await tx.customerProfile.update({ where: { id: existing.id }, data });
    } else {
        await tx.customerProfile.create({
            data: { phone: order.customerPhoneNumber, ...data },
        });
    }
}

/** Backfill: rebuild/recompute every CustomerProfile straight from the orders table. */
export async function rebuildCustomerProfiles(tx: Prisma.TransactionClient): Promise<number> {
    const groups = await tx.order.groupBy({
        by: ['customerPhoneNumber', 'customerName', 'shippingGovernorate', 'shippingAddressLine1'],
        _count: { id: true },
        _sum: { totalPrice: true },
        _max: { createdAt: true },
    });

    let written = 0;
    for (const g of groups) {
        const totalOrders = g._count.id;
        const totalSpent = Number(g._sum.totalPrice) || 0;
        const segment = computeSegment(totalOrders, totalSpent);
        await tx.customerProfile.upsert({
            where: { phone: g.customerPhoneNumber },
            create: {
                phone: g.customerPhoneNumber,
                name: g.customerName,
                governorate: g.shippingGovernorate || null,
                address: g.shippingAddressLine1 || null,
                totalOrders,
                totalSpent,
                lastOrderAt: g._max.createdAt ?? undefined,
                segment,
            },
            update: {
                name: g.customerName,
                governorate: g.shippingGovernorate || null,
                address: g.shippingAddressLine1 || null,
                totalOrders,
                totalSpent,
                lastOrderAt: g._max.createdAt ?? undefined,
                segment,
            },
        });
        written += 1;
    }
    return written;
}