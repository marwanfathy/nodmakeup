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
        throw new Error(result.message);
    }

    res.status(200).json({ success: true, data: result.discount });
});