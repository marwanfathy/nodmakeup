import { Worker } from 'bullmq';
import prisma from '../config/prismaClient';
import { loadEnv } from '@nod/shared/dist/config/env';
import { dispatchOutboxEvent, sweepPendingOutboxEvents } from './outboxHandlers';

const { redisUrl } = loadEnv();

/**
 * Deliver one outbox event exactly as far as at-least-once allows.
 *
 * The claim is a single conditional UPDATE, never a read-then-write: with two
 * workers, four slots each, and a 15s sweeper, a read-then-write claim let two
 * of them both observe `PENDING`, both pass a `status === 'DONE'` check, and
 * both post the same "NEW ORDER" alert to Telegram.
 *
 * State machine:
 *   PENDING    -> claimable. The only state a worker may take work from.
 *   PROCESSING -> leased and in flight. A claim is refused.
 *   DONE       -> delivered.
 *   FAILED     -> dead-lettered by the sweeper after MAX_ATTEMPTS.
 *
 * A failed dispatch returns the row to PENDING *before* rethrowing, so BullMQ's
 * own retry finds a claimable row and can genuinely retry it.
 */
const processJob = async (outboxId: string) => {
    // Atomic claim: exactly one caller can win the PENDING -> PROCESSING move.
    // A count of 0 means the row is DONE, FAILED, or already leased by a peer —
    // in every case this caller must not touch the side effect.
    const claim = await prisma.outboxEvent.updateMany({
        where: { id: outboxId, status: 'PENDING' },
        data: {
            status: 'PROCESSING',
            attempts: { increment: 1 },
            claimedAt: new Date(),
        },
    });
    if (claim.count === 0) return;

    const ev = await prisma.outboxEvent.findUnique({ where: { id: outboxId } });
    if (!ev) return;

    try {
        await dispatchOutboxEvent(ev.eventType, ev.payload as Record<string, unknown>);
    } catch (err) {
        // Release the lease so the retry (or the sweeper) can pick it up. The
        // row must not be left PROCESSING: nothing else would ever reclaim it.
        await prisma.outboxEvent
            .update({
                where: { id: outboxId },
                data: { status: 'PENDING', lastError: String((err as Error)?.message ?? err).slice(0, 500) },
            })
            .catch(() => undefined);
        throw err;
    }

    await prisma.outboxEvent.update({
        where: { id: outboxId },
        data: { status: 'DONE', processedAt: new Date() },
    });
};

const buildWorker = (queueName: string): Worker => {
    const worker = new Worker(
        queueName,
        async (job) => {
            const { outboxId } = job.data as { outboxId: string };
            if (!outboxId) throw new Error('Outbox job missing outboxId.');
            await processJob(outboxId);
        },
        {
            connection: { url: redisUrl },
            concurrency: 4,
        }
    );

    worker.on('failed', async (job, err) => {
        if (!job?.data?.outboxId) return;
        try {
            // processJob already recorded lastError when it released the lease;
            // this is the safety net for failures before or around the claim.
            await prisma.outboxEvent.updateMany({
                where: { id: job.data.outboxId, status: { not: 'DONE' } },
                data: { lastError: String(err?.message ?? '').slice(0, 500) },
            });
        } catch { /* row may be gone */ }
    });

    worker.on('error', (err) => console.error(`[outbox-worker:${queueName}] error`, err.message));
    return worker;
};

export const startOutboxWorker = (): Worker[] => {
    const workers = [buildWorker('rewards'), buildWorker('alerts')];

    // Recovery poller. Covers three cases the queue alone does not:
    //   1. the enqueue that happened after commit never reached Redis;
    //   2. a worker died mid-dispatch, leaving a PROCESSING row with a
    //      stale lease (previously these were stranded forever — the old
    //      sweeper only looked at PENDING);
    //   3. an event that has burned its attempts needs to become visible
    //      as FAILED instead of being retried silently forever.
    const sweeper = setInterval(() => {
        sweepPendingOutboxEvents().catch((err) =>
            console.error('[outbox-worker] sweep failed:', err.message)
        );
    }, 15_000);
    if (typeof sweeper.unref === 'function') sweeper.unref();

    return workers;
};
