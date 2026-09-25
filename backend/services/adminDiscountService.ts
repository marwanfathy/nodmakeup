// Admin discount service — discount CRUD for the admin panel.
// Owns create/update/delete with usage-limit & phone-lock fields, plus audit
// logging; controllers only validate shape and map responses.
import prisma from '../config/prismaClient';
import { AdminActionType, DiscountType } from '@prisma/client';
import { logAdminAction } from '../utils/logger';
import { DomainError } from './domainError';

export interface DiscountWriteData {
    name?: unknown;
    couponCode?: unknown;
    type?: unknown;
    value?: unknown;
    isActive?: unknown;
    maxUsages?: unknown;
    currentUsages?: unknown;
    assignedPhone?: unknown;
}

/** Create a discount with usage limits & personalization fields. */
export async function createDiscount(adminId: string, data: Required<Pick<DiscountWriteData, 'name' | 'type' | 'value'>> & DiscountWriteData) {
    const { name, couponCode, type, value, isActive, maxUsages, assignedPhone } = data;

    const newDiscount = await prisma.discount.create({
        data: {
            name: name as string,
            couponCode: couponCode as string,
            type: type as DiscountType,
            value: parseFloat(value as string),
            isActive: typeof isActive === 'boolean' ? isActive : true,

            // If maxUsages is not sent, it defaults to a high cap (unlimited-ish).
            maxUsages: maxUsages !== undefined ? parseInt(maxUsages as string) : 10000,
            assignedPhone: (assignedPhone as string) || null, // If sent, lock to this phone
            currentUsages: 0,
        },
    });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.DISCOUNT_CREATE,
        targetResource: 'Discount',
        targetId: newDiscount.id,
        details: {
            name: newDiscount.name,
            code: newDiscount.couponCode,
            value: newDiscount.value,
            type: newDiscount.type,
            limit: newDiscount.maxUsages,
            lockedTo: newDiscount.assignedPhone,
        },
    });

    return newDiscount;
}

/** All discounts, newest first. */
export async function listDiscounts() {
    return prisma.discount.findMany({
        orderBy: { id: 'desc' },
    });
}

/** Single discount by id (throws Prisma P2025 -> 500 when missing, as before). */
export async function getDiscountById(discountId: string) {
    return prisma.discount.findUniqueOrThrow({
        where: { id: discountId },
    });
}

/** Update a discount (whitelisted fields; undefined values are untouched). */
export async function updateDiscount(adminId: string, discountId: string, data: DiscountWriteData) {
    const { name, couponCode, type, value, isActive, maxUsages, currentUsages, assignedPhone } = data;

    // Fetch state before update for logging
    const discountBeforeUpdate = await prisma.discount.findUnique({
        where: { id: discountId },
    });
    if (!discountBeforeUpdate) {
        throw new DomainError('Discount not found', 404);
    }

    const updatedDiscount = await prisma.discount.update({
        where: { id: discountId },
        data: {
            name: name as string,
            couponCode: couponCode as string,
            type: type as DiscountType,
            value: value !== undefined ? parseFloat(value as string) : undefined,
            isActive: typeof isActive === 'boolean' ? isActive : undefined,

            maxUsages: maxUsages !== undefined ? parseInt(maxUsages as string) : undefined,
            currentUsages: currentUsages !== undefined ? parseInt(currentUsages as string) : undefined,
            assignedPhone: assignedPhone as string | null, // Can be null to unlock it
        },
    });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.DISCOUNT_UPDATE,
        targetResource: 'Discount',
        targetId: discountId,
        details: {
            from: discountBeforeUpdate,
            to: updatedDiscount,
        },
    });

    return updatedDiscount;
}

/** Hard-delete a discount after logging its state. */
export async function deleteDiscount(adminId: string, discountId: string) {
    // Fetch before deleting for logging
    const discountToDelete = await prisma.discount.findUnique({
        where: { id: discountId },
    });
    if (!discountToDelete) {
        throw new DomainError('Discount not found', 404);
    }

    await prisma.discount.delete({
        where: { id: discountId },
    });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.DISCOUNT_DELETE,
        targetResource: 'Discount',
        targetId: discountId,
        details: { deletedDiscountName: discountToDelete.name, code: discountToDelete.couponCode },
    });
}