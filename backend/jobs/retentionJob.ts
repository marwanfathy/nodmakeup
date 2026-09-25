import cron from 'node-cron';
import prisma from '../config/prismaClient';
import { logger } from '../config/logger';

const VISITS_RETENTION_DAYS = 90;
const EVENTS_RETENTION_DAYS = 30;
const SESSIONS_RETENTION_DAYS = 90;

let started = false;

/**
 * Daily retention sweep — keeps the analytics tables bounded:
 *   - site_visits     pruned after 90 days
 *   - user_events     pruned after 30 days (raw rows are high-volume)
 *   - live_sessions   pruned after 90 days of inactivity
 */
export const runRetention = async (): Promise<{ siteVisits: number; userEvents: number; liveSessions: number }> => {
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [siteVisits, userEvents, liveSessions] = await Promise.all([
        prisma.siteVisit.deleteMany({ where: { createdAt: { lt: daysAgo(VISITS_RETENTION_DAYS) } } }),
        prisma.userEvent.deleteMany({ where: { createdAt: { lt: daysAgo(EVENTS_RETENTION_DAYS) } } }),
        prisma.liveSession.deleteMany({ where: { lastActive: { lt: daysAgo(SESSIONS_RETENTION_DAYS) } } }),
    ]);

    return { siteVisits: siteVisits.count, userEvents: userEvents.count, liveSessions: liveSessions.count };
};

export const startRetentionJob = (): void => {
    if (started) return;

    cron.schedule('0 4 * * *', async () => {
        try {
            const result = await runRetention();
            if (result.siteVisits || result.userEvents || result.liveSessions) {
                logger.info({ result }, 'analytics retention sweep done');
            }
        } catch (error) {
            logger.error({ err: error }, 'analytics retention sweep failed');
        }
    });

    started = true;
    logger.info('analytics retention scheduled: daily at 04:00');
};