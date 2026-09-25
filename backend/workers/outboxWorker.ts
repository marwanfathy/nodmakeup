import { Worker } from 'bullmq';
import prisma from '../config/prismaClient';
import { loadEnv } from '@nod/shared/dist/config/env';
import { dispatchOutboxEvent, sweepPendingOutboxEvents } from './outboxHandlers';

const { redisUrl } = loadEnv();

const processJob = async (outboxId: string) => {
    const ev = await prisma.outboxEvent.findUnique({ where: { id: outboxId } });
    if (!ev || ev.status === 'DONE') return;

    await prisma.outboxEvent.update({
        where: { id: outboxId },
        data: { status: 'PROCESSING', attempts: { increment: 1 } },
    });

    await dispatchOutboxEvent(ev.eventType, ev.payload as Record<string, unknown>);

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
            await prisma.outboxEvent.update({
                where: { id: job.data.outboxId },
                data: { lastError: String(err?.message ?? '').slice(0, 500) },
            });
        } catch { /* row may be gone */ }
    });

    worker.on('error', (err) => console.error(`[outbox-worker:${queueName}] error`, err.message));
    return worker;
};

export const startOutboxWorker = (): Worker[] => {
    const workers = [buildWorker('rewards'), buildWorker('alerts')];

    // Crash/edge-case recovery: re-push any PENDING outbox rows every 15s.
    const sweeper = setInterval(() => {
        sweepPendingOutboxEvents().catch((err) =>
            console.error('[outbox-worker] sweep failed:', err.message)
        );
    }, 15_000);
    if (typeof sweeper.unref === 'function') sweeper.unref();

    return workers;
};