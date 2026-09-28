import express from 'express';
const router = express.Router();

import { getPublicLandingBanner } from '../../controllers/public/landingBannerController';

// The active landing banner, or { success: true, data: null } when none is set.
router.route('/').get(getPublicLandingBanner);

export default router;
