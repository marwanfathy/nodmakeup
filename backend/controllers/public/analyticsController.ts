import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { v4 as uuidv4 } from 'uuid';
import * as analyticsService from '../../services/analyticsService';

const SESSION_COOKIE_NAME = 'user_session_id';

/**
 * @desc      Track a storefront page visit (heartbeat)
 * @route     POST /api/v1/analytics/events/page-views
 * @access    Public — responds 202 instantly, persistence runs in background
 */
export const trackVisit = asyncHandler(async (req: Request, res: Response) => {
    const { path, visitorId: rawVisitor, sessionId: rawSession } = req.body;

    // The storefront sends an explicit per-tab sessionId; fall back to the
    // persistent visitorId, then to a legacy cookie.
    const sessionId: string =
        (typeof rawSession === 'string' && rawSession) ||
        (typeof rawVisitor === 'string' && rawVisitor) ||
        (req.cookies ? req.cookies[SESSION_COOKIE_NAME] : null) ||
        uuidv4();

    if (!req.cookies?.[SESSION_COOKIE_NAME] && !rawSession) {
        res.cookie(SESSION_COOKIE_NAME, sessionId, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 365 * 24 * 60 * 60 * 1000,
            path: '/',
        });
    }

    // First-party persistent visitor identity (repeat-visitor analysis).
    const visitorId = typeof rawVisitor === 'string' && rawVisitor ? rawVisitor.slice(0, 191) : null;

    // Respond immediately — the frontend shouldn't wait for analytics to finish.
    res.status(202).json({ success: true });

    // Background processing (non-blocking; the service never throws).
    void analyticsService.trackVisit({ sessionId, path, visitorId });
});

/**
 * @desc      Record a batch of behavioral events (clicks, scroll depth, exits...)
 * @route     POST /api/v1/analytics/events/behaviors
 * @access    Public — responds 202 instantly, persistence runs in background
 */
export const trackBehaviors = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body;
    const events = Array.isArray(body) ? body : body?.events;
    if (!Array.isArray(events) || events.length === 0) {
        res.status(202).json({ success: true });
        return;
    }

    // Cap batch size so a single request can't flood the DB.
    const batch = events.slice(0, 50);

    // Session comes from the per-tab sessionId; visitorId is the persistent
    // first-party identity stored against every row.
    const sessionId =
        (typeof body?.sessionId === 'string' && body.sessionId) ||
        (typeof body?.visitorId === 'string' && body.visitorId) ||
        (req.cookies && req.cookies[SESSION_COOKIE_NAME]) ||
        null;
    const visitorId = typeof body?.visitorId === 'string' && body.visitorId ? body.visitorId.slice(0, 191) : null;

    res.status(202).json({ success: true });

    // Normalize + persist in the background (non-blocking; the service never throws).
    void analyticsService.trackBehaviors({ sessionId, visitorId, events: batch });
});