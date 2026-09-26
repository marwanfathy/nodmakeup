// Admin order service — fulfillment domain for the admin panel.
// Owns list/detail projections, status transitions with stock management
// (inside a transaction + outbox), transaction-level status updates, and
// manual WhatsApp reward sends with audit logging.
import prisma from '../config/prismaClient';
import { AdminActionType, DiscountType, Prisma, TransactionStatus } from '@prisma/client';
import { logAdminAction } from '../utils/logger';
import { createPersonalizedReward } from './discountGenerator';
import { sendWhatsAppMessage } from './whatsappService';
import { recordOutboxEvent, enqueueOutboxEvent } from './outbox';
import { logger } from '../config/logger';
import { DomainError } from './domainError';

// ----------------------------- list + detail -----------------------------

export interface ListOrdersQuery {
    page: number;
    limit: number;
    search: string;
    statusFilter: string;
}

/** Paged order list with search + status filter (summary projection). */
export async function listOrders({ page, limit, search, statusFilter }: ListOrdersQuery) {
    const where: Prisma.OrderWhereInput = {};

    if (search) {
        where.OR = [
            { orderNumber: { contains: search } },
            { customerName: { contains: search } },
            { customerPhoneNumber: { contains: search } },
        ];
    }

    if (statusFilter) {
        where.status = { statusName: { equals: statusFilter } };
    }

    const [orders, total] = await Promise.all([
        prisma.order.findMany({
            where,
            select: {
                id: true,
                orderNumber: true,
                customerName: true,
                totalPrice: true,
                createdAt: true,
                isRewardSent: true, // Included so frontend knows if icon should be gray/green
                status: { select: { statusName: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.order.count({ where }),
    ]);

    const formattedOrders = orders.map((order) => ({
        order_id: order.id,
        order_number: order.orderNumber,
        customer_name: order.customerName,
        total_price: order.totalPrice,
        status_name: order.status.statusName,
        created_at: order.createdAt,
        is_reward_sent: order.isRewardSent, // Expose to frontend
    }));

    return {
        orders: formattedOrders,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}

/** Full order detail with status, items, discounts, transactions; null if missing. */
export async function getAdminOrderById(orderId: string) {
    return prisma.order.findUnique({
        where: { id: orderId },
        include: {
            status: true,
            managedBy: { select: { id: true, firstName: true, lastName: true } },
            items: { include: { variant: { include: { product: { select: { name: true } } } } } },
            appliedDiscounts: { include: { discount: true } },
            transactions: { orderBy: { transactionDate: 'desc' } },
        },
    });
}

// ----------------------------- status transitions -----------------------------

/**
 * Statuses that release reserved stock. Compared against `orderStatus.statusName`
 * exactly as stored in the database.
 *
 * A name match is fragile: renaming a status in the admin panel would silently
 * stop restocking cancelled orders, and a typo here would leave stock locked up
 * permanently. The durable fix is a boolean on `order_status` (e.g.
 * `releases_stock`) so the rule follows the data instead of a string literal in
 * this file. Until that exists the list lives in exactly one place, so it is at
 * least greppable.
 */
const STOCK_RELEASING_STATUSES = ['Cancelled', 'Refunded'] as const;

const releasesStock = (statusName: string): boolean =>
    (STOCK_RELEASING_STATUSES as readonly string[]).includes(statusName);

/**
 * Fulfillment status change: updates the order + managed-by admin, returns or
 * re-decrements stock based on active/inactive transitions, and records an
 * outbox event — all atomically. Post-commit queue push is best-effort.
 */
export async function updateOrderStatus(input: {
    orderId: string;
    newStatusId: string;
    adminId: string;
    requestId?: string;
}) {
    const { orderId, newStatusId, adminId, requestId } = input;

    const targetStatus = await prisma.orderStatus.findUnique({ where: { id: newStatusId } });
    if (!targetStatus) {
        throw new DomainError(`Status with ID ${newStatusId} does not exist.`, 400);
    }

    // Everything that decides the stock effect happens INSIDE the transaction.
    // The order used to be read before it started, which let two admins acting
    // on the same order at the same moment both observe the old status, both
    // decide the transition released stock, and both restock it — inflating
    // inventory above the truth with nothing in the audit log to show for it.
    //
    // The gate is the conditional status UPDATE below. In MySQL that UPDATE
    // takes an exclusive row lock on the order and holds it until commit, so a
    // concurrent transition blocks and then re-evaluates its predicate against
    // the committed row: `statusId: { not: newStatusId }` no longer holds, it
    // matches 0 rows, and it bails out as `already_set` without touching stock.
    // The serialisation comes from the database, not from a hopeful
    // read-then-write.
    const outcome = await prisma.$transaction(async (tx) => {
        const orderBeforeUpdate = await tx.order.findUnique({
            where: { id: orderId },
            include: {
                items: true, // needed for the stock movement
                status: true, // the old status, to decide the direction
            },
        });

        if (!orderBeforeUpdate) {
            throw new DomainError('Order not found', 404);
        }

        if (orderBeforeUpdate.statusId === newStatusId) {
            return { kind: 'already_set' as const, order: orderBeforeUpdate };
        }

        // A. Transition the order, conditionally. This is both the lock and the
        //    gate for everything below.
        const moved = await tx.order.updateMany({
            where: { id: orderId, statusId: { not: newStatusId } },
            data: { statusId: newStatusId, managedByAdminId: adminId },
        });
        if (moved.count === 0) {
            // Lost the race: another admin already applied this exact status.
            // Report that instead of applying a second stock movement.
            const current = await tx.order.findUniqueOrThrow({
                where: { id: orderId },
                include: { items: true, status: true },
            });
            return { kind: 'already_set' as const, order: current };
        }

        // B. Manage stock levels based on status change.
        const isMovingToInactive = releasesStock(targetStatus.statusName);
        const wasPreviouslyInactive = releasesStock(orderBeforeUpdate.status.statusName);

        // Rule 1: moving TO a stock-releasing state FROM an active state
        //         -> RETURN stock.
        if (isMovingToInactive && !wasPreviouslyInactive) {
            for (const item of orderBeforeUpdate.items) {
                await tx.productVariant.update({
                    where: { id: item.variantId },
                    data: { stockQuantity: { increment: item.quantity } },
                });
            }
        }
        // Rule 2: moving FROM a stock-releasing state TO an active state
        //         -> DECREMENT stock again, but never below zero.
        //
        // This used to be an unconditional `decrement`, so reopening an order
        // that had been cancelled long enough for its units to sell could drive
        // `stock_quantity` negative — and nothing could see it happen: the
        // Prometheus rule meant to catch it (FlashSaleStockNegative) is a
        // declared placeholder querying a metric the code never exports.
        // Refusing the transition preserves the invariant that stock is a
        // non-negative count, and the admin gets a message naming the SKU
        // instead of a silently corrupt inventory.
        else if (!isMovingToInactive && wasPreviouslyInactive) {
            for (const item of orderBeforeUpdate.items) {
                const claimed = await tx.productVariant.updateMany({
                    where: { id: item.variantId, stockQuantity: { gte: item.quantity } },
                    data: { stockQuantity: { decrement: item.quantity } },
                });
                if (claimed.count === 0) {
                    const variant = await tx.productVariant.findUniqueOrThrow({
                        where: { id: item.variantId },
                        select: { sku: true, stockQuantity: true },
                    });
                    // Throwing rolls the whole transaction back, which also
                    // reverts the status change: the order stays cancelled and
                    // its stock stays returned. That is the consistent outcome.
                    throw new DomainError(
                        `Cannot reopen order ${orderBeforeUpdate.orderNumber}: ` +
                        `${variant.stockQuantity} of SKU ${variant.sku} left, but the ` +
                        `order needs ${item.quantity}. Restock first, or leave it cancelled.`,
                        409,
                    );
                }
            }
        }
        // Rule 3: otherwise no stock change needed (e.g. Processing -> Shipped).

        // C. Outbox: status change recorded atomically for downstream consumers.
        const outboxEvent = await recordOutboxEvent(tx, 'ORDER_STATUS_CHANGED', orderId, {
            meta: { requestId: requestId ?? '-' },
            orderId,
            orderNumber: orderBeforeUpdate.orderNumber,
            fromStatus: orderBeforeUpdate.status.statusName,
            toStatus: targetStatus.statusName,
            byAdmin: adminId,
        });

        return {
            kind: 'updated' as const,
            fromStatusId: orderBeforeUpdate.statusId,
            outboxEventId: outboxEvent.id,
        };
    });

    if (outcome.kind === 'already_set') {
        return { kind: 'already_set', order: outcome.order };
    }

    // Post-commit: best-effort enqueue (sweeper heals failures).
    try {
        await enqueueOutboxEvent(outcome.outboxEventId, 'ORDER_STATUS_CHANGED');
    } catch (err) {
        logger.error({ err }, 'outbox enqueue failed after status change (sweeper will retry)');
    }

    // Audit the action.
    await logAdminAction({
        adminId,
        actionType: AdminActionType.ORDER_STATUS_UPDATE,
        targetResource: 'Order',
        targetId: orderId,
        details: { fromStatusId: outcome.fromStatusId, toStatusId: newStatusId },
    });

    // Fetch and return the final, fully detailed order for instant UI refresh.
    const finalOrderData = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
            status: true,
            managedBy: true,
            items: { include: { variant: { include: { product: true } } } },
            transactions: true,
            appliedDiscounts: true,
        },
    });

    return { kind: 'updated', order: finalOrderData };
}

/** Manually update ONLY the transaction status for an order. */
export async function updateTransactionStatus(input: {
    orderId: string;
    status: TransactionStatus;
    adminId: string;
}) {
    const { orderId, status, adminId } = input;

    const transaction = await prisma.transaction.findFirst({
        where: { orderId },
        orderBy: { transactionDate: 'desc' },
    });

    if (!transaction) {
        throw new DomainError('No transaction found for this order.', 404);
    }

    await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status },
    });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.ORDER_STATUS_UPDATE, // Re-using for simplicity
        targetResource: 'Transaction',
        targetId: transaction.id,
        details: { from: transaction.status, to: status, orderId },
    });

    const finalOrderData = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
            status: true,
            managedBy: true,
            items: { include: { variant: { include: { product: true } } } },
            transactions: true,
            appliedDiscounts: true,
        },
    });

    return finalOrderData;
}

/** Every possible order status (ascending by id). */
export async function getAllOrderStatuses() {
    return prisma.orderStatus.findMany({
        orderBy: { id: 'asc' },
    });
}

// ----------------------------- rewards -----------------------------

/**
 * Manually trigger sending a Reward WhatsApp to the customer: generates a
 * one-time personalized discount code, sends it over WhatsApp, then flags the
 * order as rewarded. Fails with 503 if the WhatsApp connection is down (the
 * DB flag stays untouched so the admin can retry).
 */
export async function sendOrderReward(input: {
    orderId: string;
    adminId: string;
    discountType: string;
    discountValue: number | string;
}) {
    const { orderId, adminId, discountType, discountValue } = input;

    // 1. Retrieve the order
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
            id: true,
            orderNumber: true,
            customerName: true,
            customerPhoneNumber: true,
            isRewardSent: true,
        },
    });

    if (!order) {
        throw new DomainError('Order not found.', 404);
    }

    // 2. Prevent duplicate sending
    if (order.isRewardSent) {
        throw new DomainError('A reward has already been sent for this order.', 400);
    }

    // 3. Generate the Custom Code
    // Note: createPersonalizedReward creates a "CLIENT_REWARD" category discount
    const generatedCode = await createPersonalizedReward(
        order.customerPhoneNumber,
        order.customerName,
        discountType as DiscountType,
        Number(discountValue),
    );

    // 4. Construct Message
    const valueText = discountType === 'PERCENTAGE' ? `${discountValue}%` : `EGP ${discountValue}`;

    const message = `Hi ${order.customerName}! 👋\n\nThank you for choosing nod (Order #${order.orderNumber}).\n\n🎁 *Special Gift:*\nWe created a special discount just for you!\n\nCode: *${generatedCode}*\nValue: *${valueText} Off*\n\nValid for your next order (One-time use). Enjoy!`;

    // 5. Send via WhatsApp
    const isSent = await sendWhatsAppMessage(order.customerPhoneNumber, message);

    if (!isSent) {
        // If WhatsApp service is down, don't update the DB flag
        throw new DomainError(
            'Failed to send WhatsApp message. Please check the WhatsApp connection.',
            503,
        );
    }

    // 6. Update Order Flag & Log Action
    await prisma.order.update({
        where: { id: orderId },
        data: { isRewardSent: true },
    });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.DISCOUNT_CREATE, // Or create a new enum type for REWARDS
        targetResource: 'Order Reward',
        targetId: orderId,
        details: { code: generatedCode, value: discountValue, type: discountType },
    });

    return { code: generatedCode };
}