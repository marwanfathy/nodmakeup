// Standalone outbox worker entry for production (Docker/process manager).
import http from 'http';
import { env } from '../config/env'; // dotenv + fail-fast BEFORE any config module reads process.env
import { startOutboxWorker } from './outboxWorker';
import { connectRedis } from '../config/redisClient';
import { rewardsQueue, alertsQueue } from '../config/bullmq';
import { logger } from '../config/logger';

void env;

// Worker-only liveness/readiness (§3.3). In production the worker runs in its own
// container, so it exposes its own /healthz + /readyz on PORT (default 5001).
const HEALTH_PORT = Number(process.env.PORT || 5001);

const send = (res: http.ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
};

const startHealthServer = () => {
    const server = http.createServer(async (req, res) => {
        const url = (req.url || '').split('?')[0];

        if (url === '/healthz') {
            return send(res, 200, { status: 'ok', service: 'worker' });
        }

        if (url === '/readyz') {
            const [rewards, alerts] = await Promise.allSettled([
                rewardsQueue.getJobCounts('wait', 'active', 'delayed', 'failed'),
                alertsQueue.getJobCounts('wait', 'active', 'delayed', 'failed'),
            ]);
            const queues = {
                rewards: rewards.status === 'fulfilled' ? rewards.value : null,
                alerts: alerts.status === 'fulfilled' ? alerts.value : null,
            };
            const ok = rewards.status === 'fulfilled' && alerts.status === 'fulfilled';
            return send(res, ok ? 200 : 503, { status: ok ? 'ready' : 'not_ready', checks: { redis: ok }, queues });
        }

        send(res, 404, { status: 'not_found' });
    });

    server.listen(HEALTH_PORT, '127.0.0.1', () => {
        logger.child({ service: 'worker' }).info(`health server listening on 127.0.0.1:${HEALTH_PORT}`);
    });
    server.on('error', (err) => logger.child({ service: 'worker' }).warn(err, 'health server error'));
};

const boot = async () => {
    try {
        await connectRedis();
    } catch (err) {
        logger.child({ service: 'worker' }).warn({ err }, 'redis connect warning (workers can still retry)');
    }
    const workers = startOutboxWorker();
    logger.child({ service: 'worker' }).info(`started ${workers.length} BullMQ workers`);
    startHealthServer();
};

boot();
