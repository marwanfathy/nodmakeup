import express from 'express';
const router = express.Router();

import { validateCoupon } from '../../controllers/public/discountController';
import { validate } from '../../middleware/validate';
import { validateCouponSchema } from '@nod/shared/dist/schemas';

// POST to validate a coupon code
router.route('/validate')
    .post(validate(validateCouponSchema), validateCoupon);

export default router;