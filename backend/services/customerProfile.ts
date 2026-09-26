import { Prisma } from '@prisma/client';
import prisma from '../config/prismaClient';

/** Bounded retries for the create-race on the unique `phone`. */
const PROFILE_WRITE_ATTEMPTS = 3;

/** The fields the latest order overwrites; counters are incremented, not set. */
const profileWrite = (order: OrderSnapshot) => ({
    name: order.customerName,
    governorate: order.shippingGovernorate,
    address: order.shippingAddressLine1,
    lastOrderAt: order.createdAt,
});

const isUniqueViolation = (err: unknown): boolean =>
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

const isRecordMissing = (err: unknown): boolean =>
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025';

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
 * Upsert a CustomerProfile from a newly placed order. Recomputes the segment
 * from the incremented order count / spend.
 *
 * **Deliberately NOT inside the checkout transaction.** This is derived CRM
 * data — segmentation counters that no order, and no customer's ability to
 * buy, depends on. Keeping it in the order's transaction was a mistake that
 * cost real orders, and it is worth recording exactly how, because the failure
 * is not visible from reading the code:
 *
 *  1. It was originally a `findUnique` and then a `create`/`update` branch
 *     decided in application code. Concurrent orders for the same number both
 *     read "no profile", both took `create`, and the loser's INSERT raised
 *     P2002 — which rolled back the whole checkout. The customer got an error
 *     for an order that had no reason to fail.
 *
 *  2. Swapping in `upsert` fixed that obvious case but was not enough either.
 *     Prisma's `upsert` still surfaces P2002 under contention, because when
 *     it cannot decide the operation from its arguments it compiles to
 *     read-then-write. The project's own flash-sale load test
 *     (deploy/loadtest/flash-sale.js) drove 100 simultaneous checkouts through
 *     one shared phone number and reproduced it.
 *
 *  3. Catching P2002 and retrying with `update` was worse, in the subtlest
 *     way of the three. The order transaction is a REPEATABLE READ
 *     transaction, and its snapshot is established by its first read — the
 *     order-status lookup, long before we get here. The competing transaction
 *     that triggered the P2002 committed *after* that snapshot was taken, so
 *     the retry's `update` still could not see the row it had just learned
 *     existed, and failed with P2025 "Record to update not found". Moving the
 *     write out of the order's transaction gives it a fresh snapshot, which is
 *     what makes the retry work at all.
 *
 * So: each attempt here runs in its own transaction against the shared client,
 * the retry handles both race outcomes, and the caller treats a failure as
 * non-fatal. An order that committed is an order that shipped; a missed
 * segmentation increment is a reporting discrepancy, and `rebuildCustomerProfiles`
 * repairs it from the orders table.
 *
 * Counters use `increment`, never a value computed from an earlier read — a
 * read-then-write loses updates silently, which is a worse bug than the loud
 * P2002 it replaced.
 */
export async function syncCustomerProfileFromOrder(order: OrderSnapshot): Promise<void> {
    const phone = order.customerPhoneNumber;

    for (let attempt = 1; attempt <= PROFILE_WRITE_ATTEMPTS; attempt += 1) {
        try {
            const profile = await prisma.customerProfile.upsert({
                where: { phone },
                create: {
                    phone,
                    ...profileWrite(order),
                    totalOrders: 1,
                    totalSpent: order.totalPrice,
                    segment: computeSegment(1, Number(order.totalPrice)),
                },
                update: {
                    ...profileWrite(order),
                    totalOrders: { increment: 1 },
                    totalSpent: { increment: order.totalPrice },
                },
            });

            // Segment depends on the post-increment counters, which are only
            // known after the write — hence the second statement. The returned
            // row is the authoritative post-write state, not a stale read.
            const segment = computeSegment(profile.totalOrders, Number(profile.totalSpent));
            if (profile.segment !== segment) {
                await prisma.customerProfile.update({
                    where: { id: profile.id },
                    data: { segment },
                });
            }
            return;
        } catch (err) {
            // P2002: a concurrent checkout created the row we were trying to
            // create, so the update branch is now the correct operation.
            // P2025: the reverse — our update lost a race with a delete. Both
            // are resolved by simply trying again from the top; the next
            // attempt takes a fresh snapshot and picks the right branch.
            const raced = isUniqueViolation(err) || isRecordMissing(err);
            if (!raced || attempt === PROFILE_WRITE_ATTEMPTS) throw err;
        }
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