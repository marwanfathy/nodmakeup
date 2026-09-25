// Admin product service — product CRUD for the admin panel.
// Owns nested create (product + variants + images + collections), the variant
// sync transaction on update (delete-missing guarded by order history, upsert
// the rest), summary/detail projections, archive toggles and guarded delete.
import prisma from '../config/prismaClient';
import { AdminActionType } from '@prisma/client';
import { logAdminAction } from '../utils/logger';
import { DomainError } from './domainError';

// ----------------------------- types -----------------------------

export interface ImageInput {
    id?: string;
    imageUrl: string;
    altText?: string | null;
    displayOrder?: number;
}

export interface VariantInput {
    id?: string;
    sku: string;
    price: string | number;
    stockQuantity: string | number;
    colorName?: string | null;
    size?: string | null;
    hexCode?: string | null;
    images?: ImageInput[];
}

export interface ProductWriteData {
    name: string;
    slug: string;
    description?: string;
    shortDescription?: string;
    categoryId: string;
    brandId: string;
    isActive?: boolean;
    isHero?: boolean;
    discountId?: string | null;
    variants: VariantInput[];
    collectionIds?: string[];
}

// ----------------------------- create -----------------------------

/** Create a product with nested variants, images and collection links. */
export async function createProduct(adminId: string, data: ProductWriteData) {
    const { name, slug, description, shortDescription, categoryId, brandId, isActive, isHero, discountId, variants, collectionIds } = data;

    const newProduct = await prisma.product.create({
        data: {
            name,
            slug,
            description,
            shortDescription,
            isActive: Boolean(isActive),
            isHero: Boolean(isHero),
            categoryId,
            brandId,
            discountId: discountId || null,
            variants: {
                create: variants.map((v) => ({
                    sku: v.sku,
                    price: parseFloat(v.price.toString()),
                    stockQuantity: parseInt(v.stockQuantity.toString()),
                    colorName: v.colorName,
                    size: v.size,
                    hexCode: v.hexCode,
                    images: {
                        create: (v.images || []).map((img, idx) => ({
                            imageUrl: img.imageUrl,
                            altText: img.altText,
                            displayOrder: img.displayOrder ?? idx,
                        })),
                    },
                })),
            },
            collections: {
                create: (collectionIds || []).map((cId: string) => ({
                    collection: { connect: { id: cId } },
                })),
            },
        },
        include: {
            variants: { include: { images: true } },
            collections: { include: { collection: true } },
        },
    });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.PRODUCT_CREATE,
        targetResource: 'Product',
        targetId: newProduct.id,
        details: { name: newProduct.name },
    });

    return newProduct;
}

// ----------------------------- update -----------------------------

/**
 * Update a product: core fields + collection sync + variant sync, all in one
 * transaction. Missing variants are deleted unless an order references them
 * (data-integrity guard); the remaining are upserted with fresh images.
 */
export async function updateProduct(adminId: string, productId: string, data: ProductWriteData) {
    const { name, slug, description, shortDescription, categoryId, brandId, isActive, isHero, discountId, variants, collectionIds } = data;

    const productExists = await prisma.product.findUnique({ where: { id: productId } });
    if (!productExists) {
        throw new DomainError('Product not found', 404);
    }

    const updatedProduct = await prisma.$transaction(async (tx) => {
        // 1. Update Core Product Info
        const product = await tx.product.update({
            where: { id: productId },
            data: {
                name, slug, description, shortDescription,
                isActive: Boolean(isActive),
                isHero: Boolean(isHero),
                categoryId,
                brandId,
                discountId: discountId || null,
            },
        });

        // 2. Sync Collections
        await tx.productCollection.deleteMany({ where: { productId } });
        if (collectionIds && Array.isArray(collectionIds)) {
            await tx.productCollection.createMany({
                data: collectionIds.map((cId: string) => ({ productId, collectionId: cId })),
            });
        }

        // 3. Sync Variants Safely
        const incomingVariantIds = variants.filter((v) => v.id).map((v) => v.id as string);

        // Try to delete variants not present in request.
        // This will fail if variant is linked to an OrderItem (intended behavior for data integrity).
        try {
            await tx.productVariant.deleteMany({
                where: {
                    productId,
                    id: { notIn: incomingVariantIds },
                },
            });
        } catch {
            throw new DomainError(
                'Cannot delete variants that are linked to existing orders. Mark them as inactive or zero stock instead.',
                400,
            );
        }

        // Upsert variants
        for (const v of variants) {
            if (v.id) {
                await tx.productVariant.update({
                    where: { id: v.id },
                    data: {
                        sku: v.sku,
                        price: parseFloat(v.price.toString()),
                        stockQuantity: parseInt(v.stockQuantity.toString()),
                        colorName: v.colorName,
                        size: v.size,
                        hexCode: v.hexCode,
                        images: {
                            deleteMany: {}, // Clear old images for this specific variant
                            create: (v.images || []).map((img, idx) => ({
                                imageUrl: img.imageUrl,
                                altText: img.altText,
                                displayOrder: img.displayOrder ?? idx,
                            })),
                        },
                    },
                });
            } else {
                await tx.productVariant.create({
                    data: {
                        productId,
                        sku: v.sku,
                        price: parseFloat(v.price.toString()),
                        stockQuantity: parseInt(v.stockQuantity.toString()),
                        colorName: v.colorName,
                        size: v.size,
                        hexCode: v.hexCode,
                        images: {
                            create: (v.images || []).map((img, idx) => ({
                                imageUrl: img.imageUrl,
                                altText: img.altText,
                                displayOrder: img.displayOrder ?? idx,
                            })),
                        },
                    },
                });
            }
        }
        return product;
    });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.PRODUCT_UPDATE,
        targetResource: 'Product',
        targetId: productId,
        details: { name },
    });

    return updatedProduct;
}

// ----------------------------- read + lifecycle -----------------------------

/** All products as a summary list (stock total + first image). */
export async function listProductsSummary() {
    const products = await prisma.product.findMany({
        select: {
            id: true, name: true, isActive: true, isArchived: true,
            brand: { select: { name: true } },
            variants: {
                select: {
                    stockQuantity: true,
                    images: { select: { imageUrl: true }, orderBy: { displayOrder: 'asc' }, take: 1 },
                },
            },
        },
        orderBy: { id: 'desc' },
    });

    return products.map((p) => ({
        product_id: p.id, name: p.name, is_active: p.isActive, is_archived: p.isArchived,
        brand_name: p.brand?.name,
        total_stock: p.variants.reduce((sum, v) => sum + v.stockQuantity, 0),
        first_image: p.variants.find((v) => v.images.length > 0)?.images[0]?.imageUrl || null,
    }));
}

/** Single product with brand, category, discount, variants + images, collections. */
export async function getProductDetails(productId: string) {
    return prisma.product.findUniqueOrThrow({
        where: { id: productId },
        include: {
            brand: true,
            category: true,
            discount: true,
            variants: { include: { images: { orderBy: { displayOrder: 'asc' } } } },
            collections: { include: { collection: true } },
        },
    });
}

/** Archive a product (also deactivates it). */
export async function archiveProduct(productId: string) {
    await prisma.product.update({
        where: { id: productId },
        data: { isArchived: true, isActive: false },
    });
}

/** Restore a product (unarchive + reactivate). */
export async function unarchiveProduct(productId: string) {
    await prisma.product.update({
        where: { id: productId },
        data: { isArchived: false, isActive: true },
    });
}

/** Delete a product, guarded against order history. */
export async function deleteProductWithGuard(productId: string) {
    const hasOrders = await prisma.orderItem.findFirst({ where: { variant: { productId } } });
    if (hasOrders) {
        throw new DomainError('Cannot delete product with order history. Archive it instead.', 400);
    }

    await prisma.product.delete({ where: { id: productId } });
}