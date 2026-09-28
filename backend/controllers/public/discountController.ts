import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { validateCouponCode } from '../../services/discountService';

/**
 * @desc      Validate a discount coupon code
 * @route     POST /api/v1/orders/discounts/validate
 * @access    Public
 */
export const validateCoupon = asyncHandler(async (req: Request, res: Response) => {
    const { couponCode, customerPhone } = req.body;

    if (!couponCode || typeof couponCode !== 'string') {
        res.status(400);
        throw new Error('Coupon code is required.');
    }

    const result = await validateCouponCode(couponCode, customerPhone);

    if (!result.ok) {
        res.status(result.status);
        // The reason rides along so the storefront can explain the refusal in the
        // shopper's own language and offer the right way out of it, instead of
        // showing this English sentence verbatim.
        throw Object.assign(new Error(result.message), { reason: result.reason });
    }

    res.status(200).json({ success: true, data: result.discount });
});