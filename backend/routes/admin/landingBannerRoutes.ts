import express from 'express';
import asyncHandler from 'express-async-handler';
const router = express.Router();

import {
    getLandingBannerForAdmin,
    upsertLandingBanner,
} from '../../controllers/admin/landingBannerController';

import { protect } from '../../middleware/authMiddleware';
import { protectIfToken } from '../../middleware/requireValidId';
import { validate } from '../../middleware/validate';
import { upsertLandingBannerSchema } from '@nod/shared/dist/schemas';

// Reads fall through to the public router mounted at the same path when the
// caller has no admin session, so the storefront gets the active-only banner
// and the admin form gets the row whatever its isActive state. The write always
// requires an authenticated admin.
//
// No :id guard here, unlike the multi-row content routes: the banner is a
// singleton, so there is no id to be malformed.
router.route('/')
    .get(protectIfToken, getLandingBannerForAdmin)
    .put(protect, validate(upsertLandingBannerSchema), upsertLandingBanner);

export default router;
