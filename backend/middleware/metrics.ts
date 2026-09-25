import { Request, Response, NextFunction } from 'express';
import prisma from './../config/prismaClient';
import { rewardsQueue } from './../config/bullmq';
import { isWhatsAppReady } from './../services/whatsappService';

// Prometheus text-format /metrics endpoint. Zero dependencies — a tiny in-memory
// request counter plus live gauges computed on scrape. See
// deploy/monitoring/prometheus.yml for the scrape config.

const COUNTER = new Map<string, number>();

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
        if (req.path === '/metrics') return;
        const k = `${req.method} ${res.statusCode}`;
        COUNTER.set(k, (COUNTER.get(k) ?? 0) + 1);
    });
    next();
};

export const metricsHandler = async (_req: Request, res: Response) => {
    const [db, red, memory, queues, whatsapp] = await Promise.allSettled([
        prisma.$queryRaw`SELECT 1`,
        import('./../config/redisClient').then(({ redis }) => redis.ping()),
        Promise.resolve(process.memoryUsage().heapUsed),
        rewardsQueue.getJobCounts('wait', 'active', 'delayed'),
        Promise.resolve(isWhatsAppReady()),
    ]);

    const lines: string[] = [
        '# TYPE nod_uptime_seconds gauge',
        `nod_uptime_seconds ${process.uptime()}`,
        '# TYPE nod_heap_bytes gauge',
        `nod_heap_bytes ${memory.status === 'fulfilled' ? memory.value : 0}`,
        '# TYPE nod_ready_info gauge',
        `nod_ready_info{dependency="database"} ${db.status === 'fulfilled' ? 1 : 0}`,
        `nod_ready_info{dependency="redis"} ${red.status === 'fulfilled' && red.value === 'PONG' ? 1 : 0}`,
        `nod_ready_info{dependency="whatsapp"} ${whatsapp.status === 'fulfilled' && whatsapp.value ? 1 : 0}`,
        `nod_ready_info{dependency="bullmq"} ${queues.status === 'fulfilled' ? 1 : 0}`,
        '# TYPE nod_outbox_queue_total gauge',
    ];

    lines.push('# TYPE nod_http_requests_total counter');
    for (const [k, v] of COUNTER.entries()) {
        const [method, status] = k.split(' ');
        lines.push(`nod_http_requests_total{method="${method}",status="${status}"} ${v}`);
    }

    const q = queues.status === 'fulfilled' ? queues.value : { wait: -1, active: -1, delayed: -1, failed: -1 };
    for (const state of ['wait', 'active', 'delayed', 'failed'] as const) {
        lines.push(`nod_outbox_queue_total{state="${state}"} ${q[state]}`);
    }

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(lines.join('\n') + '\n');
};