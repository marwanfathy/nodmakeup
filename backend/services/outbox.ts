import { Queue, JobsOptions } from 'bullmq';
import { queueForEventType } from '../config/bullmq';
import type { Prisma, PrismaClient } from '@prisma/client';

type PrismaTx = Prisma.TransactionClient | PrismaClient;

export type OutboxEventType = 'ORDER_CREATED' | 'ORDER_STATUS_CHANGED';

// Write the outbox row atomically inside the caller's transaction.
export const recordOutboxEvent = async (
    tx: PrismaTx,
    eventType: OutboxEventType,
    aggregateId: string,
    payload: Record<string, unknown>
) => {
    return tx.outboxEvent.create({
        data: {
            eventType,
            aggregateId,
            payload: (payload ?? {}) as Prisma.InputJsonValue,
            status: 'PENDING',
        },
    });
};

// Best-effort enqueue after commit. Any failure is healed by the recovery poller.
// jobId = outbox id => at-least-once dedupe per event.
export const enqueueOutboxEvent = async (outboxEventId: string, eventType: string) => {
    const queue: Queue = queueForEventType(eventType);
    const opts: JobsOptions = { jobId: outboxEventId };
    try {
        await queue.add(eventType, { outboxId: outboxEventId }, opts);
    } catch (err) {
        console.error(`Outbox enqueue failed for ${outboxEventId} (${eventType}):`, (err as Error).message);
    }
};