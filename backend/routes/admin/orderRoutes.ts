import express from 'express';
const router = express.Router();

import {
    getOrders,
    getOrderById,
    updateOrderStatus,
    getAllOrderStatuses,
    updateTransactionStatus,
    sendOrderReward, // <--- New Controller Function
} from '../../controllers/admin/orderController';

import { protect } from '../../middleware/authMiddleware';
import requireValidId, { protectIfToken } from '../../middleware/requireValidId';

// --- Routes ---

// 1. Get all status options (e.g. Pending, Shipped)
router.route('/statuses')
    .get(protect, getAllOrderStatuses);

// 2. Get all orders (Summary list)
router.route('/')
    .get(protect, getOrders);

// 3. Get single order details (public lookup without token)
router.route('/:id')
    .get(requireValidId, protectIfToken, getOrderById);

// 4. Update Order Status (e.g. Processing -> Shipped)
router.route('/:id/status')
    .put(requireValidId, protect, updateOrderStatus);

// 5. Update Transaction Status (e.g. Pending -> Paid)
router.route('/:orderId/transaction-status')
    .put(requireValidId, protect, updateTransactionStatus);

// 6. NEW: Manually Send WhatsApp Reward
router.route('/:orderId/send-reward')
    .post(requireValidId, protect, sendOrderReward);

export default router;