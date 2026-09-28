import express from 'express';
const router = express.Router();

import { getPublicLandingLayout } from '../../controllers/public/landingLayoutController';

// The enabled sections, already in display order.
router.route('/').get(getPublicLandingLayout);

export default router;
