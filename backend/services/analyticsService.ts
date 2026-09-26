// Analytics tracking service — storefront visit + behavior ingestion.
// All entrypoints are fire-and-forget background jobs: they never throw, so
// analytics can never break the page that triggered them.
import prisma from '../config/prismaClient';
import { Prisma } from '@prisma/client';
import { redis } from '../config/redisClient';
import { emitAnalyticsEvent, pushLiveCount } from '../realtime/analyticsSse';
import { logger } from '../config/logger';

/** User is considered "Live" for 60s after their last heartbeat. */
export const HEARTBEAT_TTL = 60;

export interface TrackVisitInput {
    sessionId: string;
    /** Current route path emitted by the storefront (optional). */
    path?: string;
    /** First-party persistent visitor id (repeat-visitor analysis), if any. */
    visitorId: string | null;
}

/**
 * Records a storefront visit heartbeat: marks the user live in Redis, keeps
 * the durable session row fresh, and writes a site-visit row only when the
 * path actually changed (last 60s). Streams page views to the admin feed.
 */
export async function trackVisit(input: TrackVisitInput): Promise<void> {
    const { sessionId, path, visitorId } = input;

    try {
        const redisLiveKey = `live_user:${sessionId}`;
        const redisLastPathKey = `last_path:${sessionId}`;

        // Redis heartbeat: no MySQL write needed for 30s heartbeats.
        await redis.set(redisLiveKey, 'active', { EX: HEARTBEAT_TTL });

        // Keep the durable session row fresh for retention / revisit math.
        prisma.liveSession
            .upsert({
                where: { sessionId },
                update: { lastActive: new Date() },
                create: { sessionId },
            })
            .catch(() => {});

        // Only log to DB on path change.
        const lastSavedPath = await redis.get(redisLastPathKey);

        if (path && path !== lastSavedPath) {
            await redis.set(redisLastPathKey, path, { EX: 3600 });

            await prisma.siteVisit.create({
                data: {
                    sessionId: String(sessionId).slice(0, 191),
                    visitorId,
                    path: path.substring(0, 255),
                },
            });

            // Push the new page view to the admin realtime feed.
            emitAnalyticsEvent({ kind: 'pageView', sessionId: String(sessionId), path: path.substring(0, 255) });
        }

        // Refresh the live visitor count on every heartbeat (cached 15s server-side).
        pushLiveCount().catch(() => {});
    } catch (error) {
        logger.error({ err: error }, 'Analytics Background Error');
    }
}

const BEHAVIOR_TYPES = ['CLICK', 'SCROLL', 'EXIT_LINK', 'VIEW', 'ERROR'];

export interface TrackBehaviorsInput {
    sessionId: string | null;
    visitorId: string | null;
    /** Raw events from the storefront; normalized + sanitized in here. */
    events: Array<Record<string, unknown>>;
}

/**
 * Normalizes a capped batch of behavioral events (clicks, scroll depth, exit
 * links...) and persists them, then streams a sanitized summary to the admin
 * realtime feed and refreshes the live count.
 */
export async function trackBehaviors(input: TrackBehaviorsInput): Promise<void> {
    const { sessionId, visitorId, events } = input;

    try {
        if (typeof sessionId !== 'string' || sessionId.length > 191) return;

        // Mark the user live in Redis immediately, no waiting on the DB.
        redis.set(`live_user:${sessionId}`, 'active', { EX: HEARTBEAT_TTL }).catch(() => {});

        const rows: Array<{
            sessionId: string;
            visitorId: string | null;
            type: string;
            target: string | null;
            label: string | null;
            href: string | null;
            value: number | null;
            path: string | null;
            meta?: Prisma.InputJsonValue;
        }> = [];

        for (const e of events) {
            if (!e || typeof e.type !== 'string') continue;
            const type = BEHAVIOR_TYPES.includes(e.type.toUpperCase()) ? e.type.toUpperCase() : 'CLICK';
            const label = e.label ? String(e.label).trim().slice(0, 255) : null;
            const path = e.path ? String(e.path).slice(0, 255) : null;
            if (type !== 'SCROLL' && !label) continue;

            rows.push({
                sessionId,
                visitorId,
                type,
                target: e.target ? String(e.target).slice(0, 255) : null,
                label: label || null,
                href: e.href ? String(e.href).slice(0, 255) : null,
                value: Number.isFinite(e.value as number) ? Math.round(Number(e.value)) : null,
                path,
                meta:
                    e.meta && typeof e.meta === 'object'
                        ? (e.meta as unknown as Prisma.InputJsonValue)
                        : undefined,
            });
        }

        if (rows.length === 0) return;

        await prisma.userEvent.createMany({ data: rows });

        // Stream a sanitized summary to the admin realtime feed.
        emitAnalyticsEvent({
            kind: 'behaviors',
            sessionId,
            count: rows.length,
            events: rows.slice(0, 20).map((r) => ({
                type: r.type,
                target: r.target,
                label: r.label,
                path: r.path,
            })),
        });

        pushLiveCount().catch(() => {});
    } catch (error) {
        logger.error({ err: error }, 'Behaviors Background Error');
    }
}