// controllers/admin/dashboardController.ts
import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import * as dashboard from '../../services/adminDashboardService';

/**
 * @desc    Get real-time dashboard statistics
 * @route   GET /api/v1/analytics/dashboard
 * @access  Private
 */
export const getDashboardStats = asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(await dashboard.getDashboardStats());
});