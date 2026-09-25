// Admin product-image service — add / update / delete variant images for the
// admin panel, with audit logging. Controllers validate shape and map responses.
import prisma from '../config/prismaClient';
import { AdminActionType } from '@prisma/client';
import { logAdminAction } from '../utils/logger';
import { DomainError } from './domainError';

/** Add a new image to a variant. */
export async function addProductImage(input: {
    adminId: string;
    variantId: string;
    imageUrl: string;
    altText?: string;
    displayOrder?: unknown;
}) {
    const { adminId, variantId, imageUrl, altText, displayOrder } = input;

    const newImage = await prisma.productImage.create({
        data: {
            variantId,
            imageUrl,
            altText,
            displayOrder: displayOrder ? parseInt(displayOrder as string) : 0,
        },
    });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.PRODUCT_UPDATE,
        targetResource: 'ProductImage',
        targetId: newImage.id,
        details: { action: 'added_image', variantId },
    });

    return newImage;
}

/** Update an image's display order / alt text / variant. */
export async function updateProductImage(input: {
    adminId: string;
    imageId: string;
    displayOrder?: unknown;
    altText?: unknown;
    variantId?: unknown;
}) {
    const { adminId, imageId, displayOrder, altText, variantId } = input;

    const existing = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!existing) {
        throw new DomainError('Image not found', 404);
    }

    const updatedImage = await prisma.productImage.update({
        where: { id: imageId },
        data: {
            displayOrder: displayOrder !== undefined ? parseInt(displayOrder as string) : undefined,
            altText: altText !== undefined ? (altText as string) : undefined,
            variantId: variantId || undefined,
        },
    });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.PRODUCT_UPDATE,
        targetResource: 'ProductImage',
        targetId: imageId,
        details: { action: 'updated_image' },
    });

    return updatedImage;
}

/** Delete a product image. */
export async function deleteProductImage(input: { adminId: string; imageId: string }) {
    const { adminId, imageId } = input;

    const image = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image) {
        throw new DomainError('Image not found', 404);
    }

    await prisma.productImage.delete({ where: { id: imageId } });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.PRODUCT_UPDATE,
        targetResource: 'ProductImage',
        targetId: imageId,
        details: { action: 'deleted_image', imageUrl: image.imageUrl },
    });
}