// Server-Sent Events realtime hub — replaces the Socket.IO analytics socket.
//
// Why SSE: analytics push is strictly one-way (server -> admin panel). SSE is a
// plain HTTP GET stream: the login `jwt` cookie rides the request exactly like
// every other API call (no WebSocket upgrade, no transports, no client
// library), browsers reconnect natively, and Express handles routing, CORS and
// CSRF for free. The same endpoint path and event names are preserved so the
// wire contract with the admin panel is unchanged.
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { redis } from '../config/redisClient';
import { AdminJwtPayload } from '../middleware/authMiddleware';
import { logger } from '../config/logger';

export const ANALYTICS_REALTIME_PATH = '/api/v1/analytics/realtime';
export const ANALYTICS_EVENT = 'analytics:event';
export const ANALYTICS_LIVE_COUNT = 'analytics:liveCount';

const MAX_CLIENTS_PER_ADMIN = 5;
const HEARTBEAT_MS = 25_000;
const LIVE_COUNT_CACHE_KEY = 'analytics:live_count';
const LIVE_COUNT_TTL = 15;

interface SseClient {
    id: number;
    adminId: string;
    res: Response;
}

let nextClientId = 1;
const clients = new Map<number, SseClient>();
const activePerAdmin = new Map<string, number>();
let heartbeatTimer: NodeJS.Timeout | null = null;

const readCookie = (cookieHeader: string | undefined, name: string): string | null => {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
};

/** Mirrors the socket handshake auth: httpOnly jwt access cookie (or ?token=). */
const authorizeRequest = (req: Request): AdminJwtPayload | null => {
    const token = readCookie(req.headers.cookie, 'jwt') || (typeof req.query.token === 'string' ? req.query.token : null);
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AdminJwtPayload;
        return decoded.typ === 'access' ? decoded : null;
    } catch {
        return null;
    }
};

/** Write one named SSE frame to every connected admin client. */
const broadcast = (event: string, payload: unknown): void => {
    if (clients.size === 0) return;
    const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of clients.values()) {
        client.res.write(frame);
    }
};

const removeClient = (id: number): void => {
    const client = clients.get(id);
    if (!client) return;
    clients.delete(id);
    const current = activePerAdmin.get(client.adminId) || 1;
    if (current <= 1) activePerAdmin.delete(client.adminId);
    else activePerAdmin.set(client.adminId, current - 1);
};

const ensureHeartbeat = (): void => {
    if (heartbeatTimer) return;
    // Comment frames keep idle connections alive through proxies/load balancers.
    heartbeatTimer = setInterval(() => {
        for (const client of clients.values()) {
            client.res.write(': keep-alive\n\n');
        }
    }, HEARTBEAT_MS);
};

const stopHeartbeat = (): void => {
    if (heartbeatTimer && clients.size === 0) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
};

export const analyticsSseHandler = (req: Request, res: Response): void => {
    const admin = authorizeRequest(req);
    if (!admin) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }

    const adminId = String(admin.admin_id);
    const current = activePerAdmin.get(adminId) || 0;
    if (current >= MAX_CLIENTS_PER_ADMIN) {
        res.status(429).json({ success: false, message: 'connection_limit' });
        return;
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const client: SseClient = { id: nextClientId++, adminId, res };
    clients.set(client.id, client);
    activePerAdmin.set(adminId, current + 1);
    ensureHeartbeat();

    logger.info({ clientId: client.id, clientCount: clients.size }, 'analytics SSE stream opened');

    // Push the current live count immediately so the UI has data on open.
    pushLiveCount().catch(() => {});

    req.on('close', () => {
        removeClient(client.id);
        stopHeartbeat();
        logger.info({ clientId: client.id, clientCount: clients.size }, 'analytics SSE stream closed');
    });
};

export const emitAnalyticsEvent = (event: Record<string, unknown>): void => {
    broadcast(ANALYTICS_EVENT, { at: new Date().toISOString(), ...event });
};

export const pushLiveCount = async (): Promise<void> => {
    try {
        const cached = await redis.get(LIVE_COUNT_CACHE_KEY);
        const count = cached ? Number(cached) : await recomputeLiveCount();
        broadcast(ANALYTICS_LIVE_COUNT, { count });
    } catch (error) {
        logger.error({ err: error }, 'pushLiveCount failed');
    }
};

export const recomputeLiveCount = async (): Promise<number> => {
    try {
        const keys = await redis.keys('live_user:*');
        const count = Array.isArray(keys) ? keys.length : 0;
        await redis.set(LIVE_COUNT_CACHE_KEY, String(count), { EX: LIVE_COUNT_TTL });
        return count;
    } catch {
        return 0;
    }
};