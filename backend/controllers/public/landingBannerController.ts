import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { getActiveLandingBanner } from '../../services/landingBannerService';

/**
 * @desc      Get the active landing banner
 * @route     GET /api/v1/content/landing-banner
 * @access    Public
 *
 * Answers 200 with `data: null` when no banner is live, rather than 404. Having
 * nothing configured is a normal state for a slot the admin fills in, not a
 * missing resource, and the storefront's server fetch treats a null payload and
 * a 404 identically (both fall back to the built-in copy) — so 200 keeps the
 * two from needing to be told apart.
 */
export const getPublicLandingBanner = asyncHandler(async (_req: Request, res: Response) => {
    const banner = await getActiveLandingBanner();

    res.status(200).json({ success: true, data: banner });
});
