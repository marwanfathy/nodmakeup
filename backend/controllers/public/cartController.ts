import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { redis } from '../../config/redisClient';
import { getOrCreateSessionId } from '../../middleware/cartSessionId';
import * as cartService from '../../services/cartService';

const MAX_MUTATIONS_PER_MINUTE = 20;

/**
 * @desc      Get the current cart
 * @route     GET /api/v1/orders/cart
 * @access    Public
 */
export const getCart = asyncHandler(async (req: Request, res: Response) => {
    const sessionId = await getOrCreateSessionId(req, res);
    const cart = await cartService.buildCartObject(sessionId);
    res.status(200).json({ success: true, data: cart });
});

/**
 * @desc      Add an item to the cart
 * @route     POST /api/v1/orders/cart/items
 * @access    Public
 */
export const addItemToCart = asyncHandler(async (req: Request, res: Response) => {
    const { variantId, quantity } = req.body;
    const addQuantity = parseInt(quantity);

    if (!variantId || !addQuantity || addQuantity < 1) {
        res.status(400);
        throw new Error('Variant ID and a valid quantity are required.');
    }

    const sessionId = await getOrCreateSessionId(req, res);

    // §2.7 per-minute abuse cap (Redis fixed-window).
    const bucketKey = `cart:adds:${sessionId}:${Math.floor(Date.now() / 60000)}`;
    const mutationCount = await redis.incr(bucketKey);
    if (mutationCount === 1) await redis.expire(bucketKey, 60);
    if (mutationCount > MAX_MUTATIONS_PER_MINUTE) {
        res.status(429);
        throw new Error(`Too many cart updates, slow down (max ${MAX_MUTATIONS_PER_MINUTE}/min).`);
    }

    const result = await cartService.addItem(sessionId, variantId, addQuantity);

    if (result.kind === 'line_quantity_cap') {
        res.status(400);
        throw new Error(`Maximum ${cartService.MAX_LINE_QUANTITY} units allowed per item.`);
    }
    if (result.kind === 'line_count_cap') {
        res.status(400);
        throw new Error(`Cart cannot exceed ${cartService.MAX_CART_LINES} different items.`);
    }

    res.status(200).json({ success: true, data: result.cart });
});

/**
 * @desc      Update the quantity of a cart line
 * @route     PUT /api/v1/orders/cart/items/:cartItemId
 * @access    Public
 */
export const updateItemQuantity = asyncHandler(async (req: Request, res: Response) => {
    const cartItemId = req.params.cartItemId;
    const { quantity } = req.body;
    const newQuantity = parseInt(quantity);

    if (isNaN(newQuantity)) {
        res.status(400);
        throw new Error('A valid quantity is required.');
    }

    const sessionId = await getOrCreateSessionId(req, res);
    const cart = await cartService.updateItemQuantity(sessionId, cartItemId, newQuantity);
    res.status(200).json({ success: true, data: cart });
});

/**
 * @desc      Remove an item from the cart
 * @route     DELETE /api/v1/orders/cart/items/:cartItemId
 * @access    Public
 */
export const removeItem = asyncHandler(async (req: Request, res: Response) => {
    const sessionId = await getOrCreateSessionId(req, res);
    const cart = await cartService.removeItem(sessionId, req.params.cartItemId);
    res.status(200).json({ success: true, data: cart });
});