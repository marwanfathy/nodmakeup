import { Queue, JobsOptions } from 'bullmq';
import { queueForEventType } from '../config/bullmq';
import type { Prisma, PrismaClient } from '@prisma/client';

type PrismaTx = Prisma.TransactionClient | PrismaClient;

export type OutboxEventType = 'ORDER_CREATED' | 'ORDER_STATUS_CHANGED';

/**
 * Outbox delivery contract, shared by the writer (services/orderService.ts),
 * the workers, and the sweeper so the status state machine is defined once.
 *
 *   PENDING    claimable — the only state a worker may take work from
 *   PROCESSING leased and in flight — a claim is refused
 *   DONE       delivered
 *   FAILED     dead-lettered by the sweeper after MAX_OUTBOX_ATTEMPTS
 */

/**
 * How long a PROCESSING row may sit before the sweeper assumes the worker that
 * claimed it died and hands the event to somebody else. Must comfortably
 * exceed the time a real dispatch (a Telegram POST, a WhatsApp send) takes.
 */
export const CLAIM_LEASE_MS = 60_000;

/** Past this many delivery attempts an event is parked as FAILED for a human. */
export const MAX_OUTBOX_ATTEMPTS = 10;

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

/**
 * Best-effort enqueue after commit. Any failure is healed by the recovery
 * poller in workers/outboxHandlers.ts.
 *
 * `jobId` includes the attempt number. Dedupe is NOT delegated to Redis: the
 * authoritative "has this already been claimed" check is the conditional
 * UPDATE in the worker's processJob, which is atomic against the database.
 * BullMQ's own jobId dedupe would fight the sweeper, because it refuses to
 * re-add an id it has already seen — including a job that has moved to the
 * failed set — and a re-delivery after a stale lease must produce a new job.
 * Varying the suffix per attempt means a genuine re-delivery is enqueued,
 * while a duplicate enqueue in the same attempt window collapses harmlessly
 * and is filtered by the claim.
 *
 * The separator is `-`, not `:`. BullMQ rejects a custom job id containing a
 * colon outright ("Custom Id cannot contain :"), because Redis uses `:` to
 * separate key segments. Using one fails every enqueue at runtime; the
 * 15-second sweeper then rescues the rows anyway, which is exactly why this
 * would have been easy to miss in a casual test.
 */
export const enqueueOutboxEvent = async (
    outboxEventId: string,
    eventType: string,
    attempt = 0
) => {
    const queue: Queue = queueForEventType(eventType);
    const opts: JobsOptions = { jobId: `${outboxEventId}-${attempt}` };
    try {
        await queue.add(eventType, { outboxId: outboxEventId }, opts);
    } catch (err) {
        console.error(`Outbox enqueue failed for ${outboxEventId} (${eventType}):`, (err as Error).message);
    }
};
