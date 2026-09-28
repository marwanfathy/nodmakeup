// Landing layout controller — admin read and write.
import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import * as layout from '../../services/adminLandingLayoutService';
import type { UpsertLandingLayoutInput } from '@nod/shared/dist/schemas';

/**
 * @desc      Get the homepage layout for editing
 * @route     GET /api/v1/content/landing-layout
 * @access    Private
 *
 * Returns every registered section, whether or not it has a saved row, which is
 * what lets a newly registered component appear in the admin list without any
 * admin-panel change. Rows for keys the registry no longer knows come back
 * flagged `isRegistered: false` instead of being hidden or deleted, so a stale
 * entry is visible and its saved position is not thrown away.
 */
export const getLandingLayoutForAdmin = asyncHandler(async (_req: Request, res: Response) => {
    const data = await layout.getLandingLayoutForAdmin();

    res.status(200).json({ success: true, data });
});

/**
 * @desc      Replace the homepage layout
 * @route     PUT /api/v1/content/landing-layout
 * @access    Private
 *
 * PUT because the body is always "the whole layout": the client sends the list
 * it is displaying, in the order it is displaying it. There is no partial
 * update to express — a section's position only means anything relative to the
 * rest, so "move hero to third" is the entire layout, not one field.
 *
 * The body has already been through upsertLandingLayoutSchema by the route's
 * validate() middleware, so it is used as its inferred type rather than being
 * re-validated field by field.
 */
export const upsertLandingLayout = asyncHandler(async (req: Request, res: Response) => {
    const data = await layout.upsertLandingLayout(req.body as UpsertLandingLayoutInput);

    res.status(200).json({ success: true, data });
});
