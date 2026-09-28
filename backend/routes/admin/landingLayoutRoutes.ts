import express from 'express';
const router = express.Router();

import {
    getLandingLayoutForAdmin,
    upsertLandingLayout,
} from '../../controllers/admin/landingLayoutController';

import { protect } from '../../middleware/authMiddleware';
import { protectIfToken } from '../../middleware/requireValidId';
import { validate } from '../../middleware/validate';
import { upsertLandingLayoutSchema } from '@nod/shared/dist/schemas';

// Reads fall through to the public router mounted at the same path when the
// caller has no admin session, so the storefront gets the enabled-only list and
// the admin form gets every registered section whatever its saved state. The
// write always requires an authenticated admin.
//
// No :id guard here, unlike the multi-row content routes: the layout is a single
// ordered list, so there is no id that could be malformed.
router.route('/')
    .get(protectIfToken, getLandingLayoutForAdmin)
    .put(protect, validate(upsertLandingLayoutSchema), upsertLandingLayout);

export default router;
