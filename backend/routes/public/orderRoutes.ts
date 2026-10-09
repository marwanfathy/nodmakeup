// src/routes/public/order.routes.ts

import express from 'express';
import { 
    getOrderDetails,
    createOrderFromCart, // Import the new order creation function
    trackOrder
} from '../../controllers/public/orderController';
import { validate } from '../../middleware/validate';
import { createOrderSchema, trackOrderSchema } from '@nod/shared/dist/schemas';

const router = express.Router();

// POST /api/public/orders -> Creates a new order from the cart (the new checkout endpoint)
router.route('/')
    .post(validate(createOrderSchema), createOrderFromCart);

// POST /api/public/orders/track -> Public lookup by order number.
// Must sit before the `/:orderId` route so the literal segment wins.
router.route('/track')
    .post(validate(trackOrderSchema), trackOrder);

// GET /api/public/orders/:orderId -> Gets public details for a single order by its ID
router.route('/:orderId')
    .get(getOrderDetails);

export default router;