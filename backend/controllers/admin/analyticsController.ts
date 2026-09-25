import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import * as analytics from '../../services/adminAnalyticsService';

/**
 * @desc      Number of currently-live storefront visitors (public bridge)
 * @route     GET /api/v1/analytics/active-sessions
 * @access    Public
 */
export const getLiveVisitorCount = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({ liveVisitors: await analytics.countLiveVisitors() });
});

/**
 * @desc      Full admin dashboard analytics payload
 * @route     GET /api/v1/analytics
 * @access    Admin
 */
export const getAnalyticsData = asyncHandler(async (req: Request, res: Response) => {
    const { startDate: queryStartDate, endDate: queryEndDate, lowStock: queryLowStock } = req.query;

    const data = await analytics.getAdminAnalytics({
        startDate: queryStartDate
            ? new Date(queryStartDate as string)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: queryEndDate ? new Date(queryEndDate as string) : new Date(),
        lowStockThreshold: parseInt(queryLowStock as string) || 10,
    });

    res.status(200).json(data);
});

/**
 * @desc      Live behavioral feed (most recent clicks / scrolls / exits)
 * @route     GET /api/v1/analytics/behaviors/recent?limit=80
 * @access    Admin
 */
export const getRecentBehaviors = asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 80, 300);
    const events = await analytics.getRecentBehaviorEvents(limit);
    res.status(200).json({ events });
});

/**
 * @desc      Pattern recognition over recent behavior (top clicks, intent funnel, pages)
 * @route     GET /api/v1/analytics/behaviors/insights?hours=24
 * @access    Admin
 */
export const getBehaviorInsights = asyncHandler(async (req: Request, res: Response) => {
    const hours = Math.min(parseInt(req.query.hours as string) || 24, 24 * 14);
    const insights = await analytics.getBehaviorInsights(hours);
    res.status(200).json(insights);
});

/**
 * @desc      Distinct-session purchase funnel over N days
 * @route     GET /api/v1/analytics/funnel?days=30
 * @access    Admin
 */
export const getFunnel = asyncHandler(async (req: Request, res: Response) => {
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const funnel = await analytics.getFunnelData(days);
    res.status(200).json({ days, ...funnel });
});

/**
 * @desc      Recent first-party visitors with reach aggregates
 * @route     GET /api/v1/analytics/visitors?days=30&limit=20
 * @access    Admin
 */
export const getAnalyticsVisitors = asyncHandler(async (req: Request, res: Response) => {
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    res.status(200).json(await analytics.getAnalyticsVisitors(days, limit));
});