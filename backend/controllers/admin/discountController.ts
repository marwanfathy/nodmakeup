import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { DiscountType } from '@prisma/client';
import * as discounts from '../../services/adminDiscountService';
import { call } from './domainCall';

// Helper to check if a string is a valid DiscountType
const isValidDiscountType = (type: unknown): type is DiscountType => {
    return typeof type === 'string' && Object.values(DiscountType).includes(type as DiscountType);
};

/**
 * @desc      Create a new discount (usage limits & personalization)
 * @route     POST /api/v1/orders/discounts
 * @access    Private
 */
export const createDiscount = asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized, admin ID not found');
    }

    const { name, couponCode, type, value, isActive, maxUsages, assignedPhone } = req.body;

    if (!name || !type || value === undefined) {
        res.status(400);
        throw new Error('Name, type, and value are required');
    }

    if (!isValidDiscountType(type)) {
        res.status(400);
        throw new Error(`Invalid discount type. Must be one of: ${Object.values(DiscountType).join(', ')}`);
    }

    const newDiscount = await discounts.createDiscount(adminId, {
        name, couponCode, type, value, isActive, maxUsages, assignedPhone,
    });

    res.status(201).json(newDiscount);
});

/**
 * @desc      Get all discounts
 * @route     GET /api/v1/orders/discounts
 * @access    Private
 */
export const getDiscounts = asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(await discounts.listDiscounts());
});

/**
 * @desc      Get a single discount by ID
 * @route     GET /api/v1/orders/discounts/:id
 * @access    Private
 */
export const getDiscountById = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(await discounts.getDiscountById(req.params.id));
});

/**
 * @desc      Update a discount (usage limits & personalization)
 * @route     PUT /api/v1/orders/discounts/:id
 * @access    Private
 */
export const updateDiscount = asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized, admin ID not found');
    }

    const discountId = req.params.id;
    const { name, couponCode, type, value, isActive, maxUsages, currentUsages, assignedPhone } = req.body;

    if (type && !isValidDiscountType(type)) {
        res.status(400);
        throw new Error(`Invalid discount type. Must be one of: ${Object.values(DiscountType).join(', ')}`);
    }

    const updatedDiscount = await call(res, () =>
        discounts.updateDiscount(adminId, discountId, {
            name, couponCode, type, value, isActive, maxUsages, currentUsages, assignedPhone,
        }),
    );

    res.status(200).json(updatedDiscount);
});

/**
 * @desc      DELETE a discount (hard delete)
 * @route     DELETE /api/v1/orders/discounts/:id
 * @access    Private
 */
export const deleteDiscount = asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized, admin ID not found');
    }

    const discountId = req.params.id;

    await call(res, () => discounts.deleteDiscount(adminId, discountId));

    res.status(200).json({ message: 'Discount deleted successfully' });
});