// Collection service — published collections for the storefront.
// List tiles + per-slug detail (reuses the shared product-summary formatter).
import prisma from '../config/prismaClient';
import { Prisma } from '@prisma/client';
import { ProductSummary, toProductSummary } from './catalogService';

export interface CollectionListItem {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    productCount: number;
}

export interface CollectionDetail {
    collection: { id: string; name: string; slug: string };
    products: ProductSummary[];
}

/** A collection is "live" when published and inside its publish/end window. */
const PUBLISHED_FILTER: Prisma.CollectionWhereInput = {
    isPublished: true,
    OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }],
    AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }],
};

export async function getPublishedCollections(): Promise<CollectionListItem[]> {
    const collections = await prisma.collection.findMany({
        where: PUBLISHED_FILTER,
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            products: {
                where: { product: { isActive: true, isArchived: false } },
                select: { product: { select: { id: true } } },
            },
        },
    });

    return collections.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        productCount: c.products.length,
    }));
}

export async function getPublishedCollectionBySlug(
    slug: string,
): Promise<CollectionDetail | null> {
    const collection = await prisma.collection.findFirst({
        where: { slug, ...PUBLISHED_FILTER },
        include: {
            products: {
                where: { product: { isActive: true, isArchived: false } },
                include: {
                    product: {
                        include: {
                            discount: { where: { isActive: true } },
                            variants: {
                                orderBy: { id: 'asc' },
                                include: {
                                    images: {
                                        orderBy: { displayOrder: 'asc' },
                                        take: 1,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!collection) return null;

    const products = collection.products
        .map((pc) => pc.product)
        .map(toProductSummary)
        .filter((p): p is ProductSummary => p !== null);

    return {
        collection: {
            id: collection.id,
            name: collection.name,
            slug: collection.slug,
        },
        products,
    };
}