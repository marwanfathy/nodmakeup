import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import * as banner from '../../services/adminLandingBannerService';
import type { UpsertLandingBannerInput } from '@nod/shared/dist/schemas';
import { call } from './domainCall';

/**
 * @desc      Get the landing banner for editing
 * @route     GET /api/v1/content/landing-banner
 * @access    Private
 *
 * Returns the row whether or not it is currently live, so a switched-off banner
 * can still be opened and edited — and `data: null` on a first visit, which the
 * form renders as blank fields rather than an error.
 */
export const getLandingBannerForAdmin = asyncHandler(async (_req: Request, res: Response) => {
    const data = await banner.getLandingBannerForAdmin();

    res.status(200).json({ success: true, data });
});

/**
 * @desc      Create or replace the landing banner
 * @route     PUT /api/v1/content/landing-banner
 * @access    Private
 *
 * PUT rather than POST because the banner is a singleton slot: the client is
 * always writing "the" banner, whether or not one exists yet. The body has
 * already been through upsertLandingBannerSchema by the route's validate()
 * middleware, so it is cast to the inferred type here instead of being
 * re-validated field by field.
 */
export const upsertLandingBanner = asyncHandler(async (req: Request, res: Response) => {
    const data = await call(res, () => banner.upsertLandingBanner(req.body as UpsertLandingBannerInput));

    res.status(200).json({ success: true, data });
});
