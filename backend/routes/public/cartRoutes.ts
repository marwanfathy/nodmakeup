// src/routes/public/cartRoutes.ts

import express from 'express';
import {
    getCart,
    addItemToCart,
    updateItemQuantity,
    removeItem,
} from '../../controllers/public/cartController';
import { validate } from '../../middleware/validate';
import { addCartItemSchema, updateCartItemSchema } from '@nod/shared/dist/schemas';

const router = express.Router();

// GET /api/public/cart
router.get('/', getCart);

// POST /api/public/cart/items
router.post('/items', validate(addCartItemSchema), addItemToCart);

// PUT /api/public/cart/items/:cartItemId
router.put('/items/:cartItemId', validate(updateCartItemSchema), updateItemQuantity);

// DELETE /api/public/cart/items/:cartItemId
router.delete('/items/:cartItemId', removeItem);

export default router;