import prisma from '../config/prismaClient';
import { sendNewOrderAlert, OrderNotificationData } from '../utils/notifications';
import { reqLogger } from '../config/logger';
import { CLAIM_LEASE_MS, MAX_OUTBOX_ATTEMPTS, enqueueOutboxEvent } from '../services/outbox';

/**
 * Outbox dispatch handlers.
 *
 * These are NOT idempotent, and they cannot be made idempotent from here: the
 * side effect is a Telegram/WhatsApp message sent to a third party, and only
 * the receiver can dedupe it. What this layer guarantees is that a given
 * outbox row is *claimed* by exactly one worker at a time
 * (see `processJob` in ./outboxWorker.ts), so under normal operation each event
 * is delivered once. The residual duplicate window is the unavoidable
 * at-least-once case: the message was delivered, then the process died before
 * the row was marked DONE. Narrowing that further needs a receiver-side
 * idempotency key, not a change here.
 */

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
            // Unknown types still count as delivered: parking them in PENDING
            // forever would let one unrecognised event type stop the sweeper
            // from ever draining.
            console.warn(`[outbox] No handler registered for event type "${eventType}".`);
    }
};

/**
 * Recovery poller. Runs every 15s and covers the cases BullMQ's own retry
 * cannot:
 *
 *  1. The enqueue that runs right after the order commits never reached Redis
 *     (crash, or a Redis blip). The row is PENDING with no job behind it.
 *  2. A worker died mid-dispatch, stranding a PROCESSING row. The previous
 *     sweeper selected only `PENDING`, so these were never reclaimed and the
 *     order notification was silently lost — a real outcome, because
 *     `attempts` was incremented and then never read by anything.
 *  3. An event that has exhausted its attempts becomes FAILED, so it is
 *     visible to the `nod_outbox_queue_total{state="failed"}` gauge and the
 *     OutboxQueueBacklog alert instead of retrying forever.
 */
export const sweepPendingOutboxEvents = async (): Promise<void> => {
    // 1. Dead-letter anything that has burned its attempts.
    const exhausted = await prisma.outboxEvent.updateMany({
        where: { status: 'PENDING', attempts: { gte: MAX_OUTBOX_ATTEMPTS } },
        data: {
            status: 'FAILED',
            lastError: `Abandoned after ${MAX_OUTBOX_ATTEMPTS} delivery attempts.`,
        },
    });
    if (exhausted.count > 0) {
        console.error(`[outbox-sweeper] parked ${exhausted.count} event(s) as FAILED after ${MAX_OUTBOX_ATTEMPTS} attempts`);
    }

    // 2. Reclaim leases whose owner never came back. Idempotent: running it
    //    twice just re-releases the same rows, and the atomic claim in
    //    processJob means only one worker can pick the event up afterwards.
    const staleLeaseBefore = new Date(Date.now() - CLAIM_LEASE_MS);
    const reclaimed = await prisma.outboxEvent.updateMany({
        where: { status: 'PROCESSING', claimedAt: { lt: staleLeaseBefore } },
        data: { status: 'PENDING' },
    });
    if (reclaimed.count > 0) {
        console.warn(`[outbox-sweeper] reclaimed ${reclaimed.count} event(s) with a stale claim lease`);
    }

    // 3. Re-push anything claimable, oldest first.
    const pending = await prisma.outboxEvent.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 20,
        select: { id: true, eventType: true, attempts: true },
    });

    for (const ev of pending) {
        await enqueueOutboxEvent(ev.id, ev.eventType, ev.attempts);
    }
};
