// Admin brand service — brand CRUD for the admin panel.
// Owns create/list/detail/update/delete with the product-association guard
// and audit logging; controllers validate shape and map responses.
import prisma from '../config/prismaClient';
import { AdminActionType } from '@prisma/client';
import { logAdminAction } from '../utils/logger';
import { DomainError } from './domainError';

/** Create a brand. */
export async function createBrand(input: { adminId: string; name: string; slug: string }) {
    const { adminId, name, slug } = input;

    const newBrand = await prisma.brand.create({ data: { name, slug } });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.PRODUCT_CREATE, // Assuming Brand is a type of Product action for simplicity
        targetResource: 'Brand',
        targetId: newBrand.id,
        details: { name: newBrand.name, slug: newBrand.slug },
    });

    return newBrand;
}

/** All brands, alphabetical. */
export async function listBrands() {
    return prisma.brand.findMany({ orderBy: { name: 'asc' } });
}

/** Single brand by id (throws Prisma P2025 -> 500 when missing, as before). */
export async function getBrandById(brandId: string) {
    return prisma.brand.findUniqueOrThrow({ where: { id: brandId } });
}

/** Update a brand (before/after state logged). */
export async function updateBrand(input: { adminId: string; brandId: string; name?: string; slug?: string }) {
    const { adminId, brandId, name, slug } = input;

    const brandBeforeUpdate = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brandBeforeUpdate) {
        throw new DomainError('Brand not found', 404);
    }

    const updatedBrand = await prisma.brand.update({
        where: { id: brandId },
        data: { name, slug },
    });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.PRODUCT_UPDATE,
        targetResource: 'Brand',
        targetId: brandId,
        details: {
            from: { name: brandBeforeUpdate.name, slug: brandBeforeUpdate.slug },
            to: { name: updatedBrand.name, slug: updatedBrand.slug },
        },
    });

    return updatedBrand;
}

/**
 * Hard-delete a brand, blocked while products are still associated with it.
 */
export async function deleteBrandWithGuard(input: { adminId: string; brandId: string }) {
    const { adminId, brandId } = input;

    const associatedProductsCount = await prisma.product.count({ where: { brandId } });
    if (associatedProductsCount > 0) {
        throw new DomainError(
            `Cannot delete this brand. It is associated with ${associatedProductsCount} product(s). Please reassign or delete them first.`,
            400,
        );
    }

    const brandToDelete = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brandToDelete) {
        throw new DomainError('Brand not found', 404);
    }

    await prisma.brand.delete({ where: { id: brandId } });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.PRODUCT_DELETE,
        targetResource: 'Brand',
        targetId: brandId,
        details: { deletedBrandName: brandToDelete.name },
    });
}