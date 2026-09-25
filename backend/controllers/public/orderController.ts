import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { getOrCreateSessionId } from '../../middleware/cartSessionId';
import * as orderService from '../../services/orderService';

/**
 * @desc      Create a new order from the cart (storefront checkout)
 * @route     POST /api/v1/orders
 * @access    Public
 */
export const createOrderFromCart = asyncHandler(async (req: Request, res: Response) => {
    const {
        customerName,
        customerPhone,
        customerAddress,
        shippingGovernorate,
        customerNotes,
        couponCode,
        checkoutKey,
    } = req.body;

    const sessionId = await getOrCreateSessionId(req, res);

    const result = await orderService.createOrderFromCart({
        sessionId,
        customerName,
        customerPhone,
        customerAddress,
        shippingGovernorate,
        customerNotes,
        couponCode,
        checkoutKey,
        requestId: req.requestId,
    });

    if (result.kind === 'already_placed') {
        res.status(200).json({
            success: true,
            message: 'Order was already placed.',
            data: { orderId: result.orderId, orderNumber: result.orderNumber },
        });
        return;
    }

    if (result.kind === 'error') {
        res.status(result.status);
        throw new Error(result.message);
    }

    res.status(201).json({
        success: true,
        message: 'Order placed successfully!',
        data: { orderId: result.orderId, orderNumber: result.orderNumber },
    });
});

/**
 * @desc      Get public order details for the confirmation page
 * @route     GET /api/v1/orders/:orderId
 * @access    Public
 */
export const getOrderDetails = asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;

    if (!orderService.isValidOrderId(orderId)) {
        res.status(400);
        throw new Error('Invalid order ID format.');
    }

    const data = await orderService.getPublicOrderDetails(orderId);

    if (!data) {
        res.status(404);
        throw new Error('Order not found');
    }

    res.status(200).json({ success: true, data });
});