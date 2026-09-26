import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { TransactionStatus } from '@prisma/client';
import { isValidOrderId } from '../../services/orderService';
import * as adminOrders from '../../services/adminOrderService';
import { call } from './domainCall';

/**
 * @desc      Get all orders (summary view) with search, status filter & pagination
 * @route     GET /api/v1/orders
 * @access    Private
 */
export const getOrders = asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const search = (req.query.search as string)?.trim() ?? '';
    const statusFilter = (req.query.status as string)?.trim() ?? '';

    res.status(200).json(await adminOrders.listOrders({ page, limit, search, statusFilter }));
});

/**
 * @desc      Get a single order by ID with full details
 * @route     GET /api/v1/orders/:id
 * @access    Private
 */
export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
    const orderId = req.params.id;
    if (!isValidOrderId(orderId)) {
        res.status(400);
        throw new Error('Invalid Order ID format');
    }

    const order = await adminOrders.getAdminOrderById(orderId);

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    res.status(200).json(order);
});

/**
 * @desc      Update ONLY the order's fulfillment status AND manage stock
 * @route     PUT /api/v1/orders/:id/status
 * @access    Private
 */
export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
    const orderId = req.params.id;
    if (!isValidOrderId(orderId)) {
        res.status(400);
        throw new Error('Invalid Order ID format');
    }

    const { statusId } = req.body;
    if (!statusId || !isValidOrderId(statusId)) {
        res.status(400);
        throw new Error('Status ID must be a valid UUID');
    }

    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized, admin context not found');
    }

    const result = await call(res, () =>
        adminOrders.updateOrderStatus({ orderId, newStatusId: statusId, adminId, requestId: req.requestId }),
    );

    if (result.kind === 'already_set') {
        res.status(200).json({ message: 'Order status is already set.', order: result.order });
        return;
    }

    res.status(200).json({ message: 'Order status updated successfully', order: result.order });
});

/**
 * @desc      Manually update ONLY the transaction status for an order
 * @route     PUT /api/v1/orders/:orderId/transaction-status
 * @access    Private
 */
export const updateTransactionStatus = asyncHandler(async (req: Request, res: Response) => {
    const orderId = req.params.orderId;
    if (!isValidOrderId(orderId)) {
        res.status(400);
        throw new Error('Invalid Order ID format');
    }

    const { status } = req.body;
    if (!status || !Object.values(TransactionStatus).includes(status as TransactionStatus)) {
        res.status(400);
        throw new Error(`Invalid transaction status provided.`);
    }

    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized, admin context not found');
    }

    const order = await call(res, () => adminOrders.updateTransactionStatus({ orderId, status, adminId }));

    res.status(200).json({ message: 'Transaction status updated successfully', order });
});

/**
 * @desc      Get all possible order statuses
 * @route     GET /api/v1/orders/statuses
 * @access    Private
 */
export const getAllOrderStatuses = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(await adminOrders.getAllOrderStatuses());
});

/**
 * @desc      Manually trigger sending a Reward WhatsApp to the customer
 * @route     POST /api/v1/orders/:orderId/send-reward
 * @access    Private (Admin)
 */
export const sendOrderReward = asyncHandler(async (req: Request, res: Response) => {
    const orderId = req.params.orderId;
    const adminId = req.admin?.admin_id;

    if (!isValidOrderId(orderId)) {
        res.status(400);
        throw new Error('Invalid Order ID.');
    }

    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized, admin context not found');
    }

    const { discountType, discountValue } = req.body;

    // Basic validation for discount configuration
    if (!discountType || !['PERCENTAGE', 'FIXED_AMOUNT'].includes(discountType)) {
        res.status(400);
        throw new Error('Invalid discount type. Must be PERCENTAGE or FIXED_AMOUNT.');
    }
    if (!discountValue || isNaN(Number(discountValue)) || Number(discountValue) <= 0) {
        res.status(400);
        throw new Error('Invalid discount value.');
    }

    const data = await call(res, () =>
        adminOrders.sendOrderReward({ orderId, adminId, discountType, discountValue }),
    );

    res.status(200).json({
        success: true,
        message: 'Reward sent successfully!',
        data: { code: data.code },
    });
});