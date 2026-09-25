import prisma from '../config/prismaClient';
import { sendNewOrderAlert, OrderNotificationData } from '../utils/notifications';
import { reqLogger } from '../config/logger';

// Handlers are idempotent: the worker only processes an outbox row once (guarded by
// status DONE), and REPLY/ID resolution happens here against current DB state.

export const handleOrderCreated = async (payload: Record<string, unknown>) => {
    const { notification, meta } = payload as unknown as { notification: OrderNotificationData; meta?: { requestId?: string } };
    if (!notification?.id) throw new Error('ORDER_CREATED payload missing notification.id');
    reqLogger({ requestId: meta?.requestId ?? '-', service: 'worker' })
        .info({ notificationId: notification.id }, `dispatching ORDER_CREATED #${notification.orderNumber}`);
    await sendNewOrderAlert(notification);
};

export const handleOrderStatusChanged = async (payload: Record<string, unknown>) => {
    const { orderId, orderNumber, fromStatus, toStatus, byAdmin, meta } = payload as unknown as {
        orderId?: string; orderNumber?: string; fromStatus?: string; toStatus?: string; byAdmin?: string;
        meta?: { requestId?: string };
    };
    if (!orderId) throw new Error('ORDER_STATUS_CHANGED payload missing orderId');
    reqLogger({ requestId: meta?.requestId ?? '-', service: 'worker' })
        .info({ fromStatus: fromStatus ?? '?', toStatus: toStatus ?? '?', updatedBy: byAdmin ?? 'system' },
            `order #${orderNumber ?? orderId} status changed`);
};

export const dispatchOutboxEvent = async (eventType: string, payload: Record<string, unknown>) => {
    switch (eventType) {
        case 'ORDER_CREATED':
            await handleOrderCreated(payload);
            return;
        case 'ORDER_STATUS_CHANGED':
            await handleOrderStatusChanged(payload);
            return;
        default:
            console.warn(`[outbox] No handler registered for event type "${eventType}".`);
    }
};

// Re-push any stale PENDING rows so events survive a crashed enqueue step.
export const sweepPendingOutboxEvents = async (): Promise<void> => {
    const pending = await prisma.outboxEvent.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 20,
    });
    for (const ev of pending) {
        const { enqueueOutboxEvent } = await import('../services/outbox');
        await enqueueOutboxEvent(ev.id, ev.eventType);
    }
};