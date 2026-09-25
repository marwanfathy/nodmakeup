// Admin category service — category CRUD for the admin panel.
// Owns create/list/detail/update/delete with audit logging; controllers
// validate shape (including boolean coercion) and map responses.
import prisma from '../config/prismaClient';
import { AdminActionType } from '@prisma/client';
import { logAdminAction } from '../utils/logger';
import { DomainError } from './domainError';

/** Create a category. */
export async function createCategory(input: { adminId: string; name: string; slug: string; isActive?: boolean }) {
    const { adminId, name, slug, isActive } = input;

    const newCategory = await prisma.category.create({
        data: { name, slug, isActive },
    });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.CATEGORY_CREATE,
        targetResource: 'Category',
        targetId: newCategory.id,
        details: { name: newCategory.name, slug: newCategory.slug },
    });

    return newCategory;
}

/** All categories, alphabetical. */
export async function listCategories() {
    return prisma.category.findMany({ orderBy: { name: 'asc' } });
}

/** Single category by id (throws Prisma P2025 -> 500 when missing, as before). */
export async function getCategoryById(categoryId: string) {
    return prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
}

/** Update whitelisted category fields (undefined = untouched). */
export async function updateCategory(
    input: {
        adminId: string;
        categoryId: string;
        data: { name?: string; slug?: string; isActive?: boolean };
    },
) {
    const { adminId, categoryId, data } = input;

    const categoryBeforeUpdate = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!categoryBeforeUpdate) {
        throw new DomainError('Category not found', 404);
    }

    const updatedCategory = await prisma.category.update({
        where: { id: categoryId },
        data,
    });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.CATEGORY_UPDATE,
        targetResource: 'Category',
        targetId: categoryId,
        details: {
            from: {
                name: categoryBeforeUpdate.name,
                slug: categoryBeforeUpdate.slug,
                isActive: categoryBeforeUpdate.isActive,
            },
            to: { name: updatedCategory.name, slug: updatedCategory.slug, isActive: updatedCategory.isActive },
        },
    });

    return updatedCategory;
}

/** Hard-delete a category. */
export async function deleteCategory(input: { adminId: string; categoryId: string }) {
    const { adminId, categoryId } = input;

    const categoryToDelete = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!categoryToDelete) {
        throw new DomainError('Category not found', 404);
    }

    await prisma.category.delete({ where: { id: categoryId } });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.CATEGORY_DELETE,
        targetResource: 'Category',
        targetId: categoryId,
        details: { deletedCategoryName: categoryToDelete.name },
    });
}