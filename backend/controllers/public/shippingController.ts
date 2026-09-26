import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { getPublicShippingZones } from '../../services/shippingService';

/**
 * @desc      Get all available shipping zones for the public
 * @route     GET /api/v1/orders/shipping-zones
 * @access    Public
 */
export const getShippingZones = asyncHandler(async (_req: Request, res: Response) => {
    const zones = await getPublicShippingZones();

    res.status(200).json({
        success: true,
        count: zones.length,
        data: zones,
    });
});