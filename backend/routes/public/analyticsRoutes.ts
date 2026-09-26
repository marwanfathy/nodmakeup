import express from 'express';
const router = express.Router();
import { trackVisit, trackBehaviors } from '../../controllers/public/analyticsController';
import { getLiveVisitorCount } from '../../controllers/admin/analyticsController';

/**
 * @desc      Public endpoint to track page views and heartbeats
 * @route     POST /api/v1/analytics/events/page-views
 * @access    Public
 */
router.post('/events/page-views', trackVisit);

/**
 * @desc      Any-method no-op so direct navigation / probes never show a scary 404.
 * @route     GET /api/v1/analytics/events/page-views
 * @access    Public
 */
router.get('/events/page-views', (_req, res) =>
  res.json({ success: true, message: 'Analytics events are tracked via POST only.' })
);

/**
 * @desc      Public batch endpoint for behavioral events (clicks, scroll depth...)
 * @route     POST /api/v1/analytics/events/behaviors
 * @access    Public
 */
router.post('/events/behaviors', trackBehaviors);

/**
 * @desc      Any-method no-op so direct navigation / probes never show a scary 404.
 * @route     GET /api/v1/analytics/events/behaviors
 * @access    Public
 */
router.get('/events/behaviors', (_req, res) =>
  res.json({ success: true, message: 'Analytics events are tracked via POST only.' })
);

/**
 * @desc      Public aggregate of currently-active visitors (online pulse)
 * @route     GET /api/v1/analytics/active-sessions
 * @access    Public
 */
router.get('/active-sessions', getLiveVisitorCount);

export default router;