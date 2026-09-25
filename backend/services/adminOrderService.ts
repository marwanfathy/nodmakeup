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

    const orderBeforeUpdate = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            items: true, // CRITICAL: Include items for stock management
            status: true, // CRITICAL: Include the old status object to compare against
        },
    });

    if (!orderBeforeUpdate) {
        throw new DomainError('Order not found', 404);
    }

    if (orderBeforeUpdate.statusId === newStatusId) {
        return { kind: 'already_set', order: orderBeforeUpdate };
    }

    // Transaction: status update + stock management + outbox succeed or fail together.
    const outboxEventId = await prisma.$transaction(async (tx) => {
        // A. Update the order's status
        await tx.order.update({
            where: { id: orderId },
            data: {
                statusId: newStatusId,
                managedByAdminId: adminId,
            },
        });

        // B. Manage stock levels based on status change
        const isMovingToInactive = ['Cancelled', 'Refunded'].includes(targetStatus.statusName);
        const wasPreviouslyInactive = ['Cancelled', 'Refunded'].includes(orderBeforeUpdate.status.statusName);

        // Rule 1: moving TO an inactive state FROM an active state -> RETURN stock.
        if (isMovingToInactive && !wasPreviouslyInactive) {
            for (const item of orderBeforeUpdate.items) {
                await tx.productVariant.update({
                    where: { id: item.variantId },
                    data: { stockQuantity: { increment: item.quantity } },
                });
            }
        }
        // Rule 2: moving FROM an inactive state TO an active state -> DECREMENT stock again.
        else if (!isMovingToInactive && wasPreviouslyInactive) {
            for (const item of orderBeforeUpdate.items) {
                await tx.productVariant.update({
                    where: { id: item.variantId },
                    data: { stockQuantity: { decrement: item.quantity } },
                });
            }
        }
        // Rule 3: otherwise no stock change needed (e.g. Processing -> Shipped).

        // C. Outbox: status change recorded atomically for downstream consumers.
        if (targetStatus.statusName !== orderBeforeUpdate.status.statusName) {
            const outboxEvent = await recordOutboxEvent(tx, 'ORDER_STATUS_CHANGED', orderId, {
                meta: { requestId: requestId ?? '-' },
                orderId,
                orderNumber: orderBeforeUpdate.orderNumber,
                fromStatus: orderBeforeUpdate.status.statusName,
                toStatus: targetStatus.statusName,
                byAdmin: adminId,
            });
            return outboxEvent.id;
        }
        return null;
    });

    // Post-commit: best-effort enqueue (sweeper heals failures).
    if (outboxEventId) {
        try {
            await enqueueOutboxEvent(outboxEventId, 'ORDER_STATUS_CHANGED');
        } catch (err) {
            logger.error({ err }, 'outbox enqueue failed after status change (sweeper will retry)');
        }
    }

    // Audit the action.
    await logAdminAction({
        adminId,
        actionType: AdminActionType.ORDER_STATUS_UPDATE,
        targetResource: 'Order',
        targetId: orderId,
        details: { fromStatusId: orderBeforeUpdate.statusId, toStatusId: newStatusId },
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