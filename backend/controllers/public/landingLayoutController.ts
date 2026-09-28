// Landing layout controller — public read.
import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { getActiveLandingLayout } from '../../services/landingLayoutService';

/**
 * @desc      Get the homepage section order and visibility
 * @route     GET /api/v1/content/landing-layout
 * @access    Public
 *
 * Answers 200 with the enabled sections already in display order, so the client
 * never sorts and cannot disagree with the database about the order.
 *
 * `data` is never null: the registry is the base of the read, so a layout that
 * has never been saved resolves to today's page rather than an empty one. A 404
 * here would mean "the homepage does not exist", which is not a state this
 * endpoint can produce — so the storefront checks for a failed request, not for
 * a missing body.
 */
export const getPublicLandingLayout = asyncHandler(async (_req: Request, res: Response) => {
    const sections = await getActiveLandingLayout();

    res.status(200).json({ success: true, data: { sections } });
});
