import express from 'express';
const router = express.Router();
// IMPORTANT: Use { } for named exports
import {
    getAnalyticsData,
    getRecentBehaviors,
    getBehaviorInsights,
    getAnalyticsVisitors,
    getFunnel
} from '../../controllers/admin/analyticsController';
import { protect } from '../../middleware/authMiddleware';

// Full dashboard data (protected)
router.get('/', protect, getAnalyticsData);

// Live behavioral feed + pattern insights (protected)
router.get('/behaviors/recent', protect, getRecentBehaviors);
router.get('/behaviors/insights', protect, getBehaviorInsights);

// Audience + journey (protected)
router.get('/visitors', protect, getAnalyticsVisitors);
router.get('/funnel', protect, getFunnel);

export default router;