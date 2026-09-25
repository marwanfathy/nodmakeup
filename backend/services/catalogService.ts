// Catalog service — storefront product reads.
// Owns persistence (prisma) and DTO shaping for the public catalog surface;
// controllers only translate HTTP to/from this layer. All response shapes
// here ARE the public API contract (parity with the legacy handlers).
import prisma from '../config/prismaClient';
import { Prisma, DiscountType } from '@prisma/client';
import { applyPriceLogic } from '../utils/priceUtils';
import { sanitizeHtml } from '../utils/sanitizeHtml';

// ----------------------------- types -----------------------------

const LIST_INCLUDE = {
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
} satisfies Prisma.ProductInclude;

const DETAIL_INCLUDE = {
    brand: { select: { name: true } },
    category: { select: { name: true } },
    discount: { where: { isActive: true } },
    variants: {
        orderBy: { id: 'asc' },
        include: {
            images: {
                orderBy: { displayOrder: 'asc' },
            },
        },
    },
} satisfies Prisma.ProductInclude;

type DetailRow = Prisma.ProductGetPayload<{ include: typeof DETAIL_INCLUDE }>;

export interface VariantSummary {
    id: string;
    colorName: string | null;
    hexCode: string | null;
    imageUrl: string | null;
    price: number;
    effectiveSalePrice: number | null;
}

export interface ProductSummary {
    id: string;
    name: string;
    slug: string;
    shortDescription: string | null;
    isBestseller: boolean;
    variants: VariantSummary[];
}

/**
 * Structural input accepted by {@link toProductSummary}: any product-shaped
 * row (typed prisma payload or mapped subset) exposing these fields.
 */
export interface ProductSummarySource {
    id: string;
    name: string;
    slug: string;
    shortDescription: string | null;
    isHero: boolean;
    discount: { type: DiscountType; value: number | Prisma.Decimal } | null;
    variants: Array<{
        id: string;
        colorName: string | null;
        hexCode: string | null;
        price: number | Prisma.Decimal;
        images: Array<{ imageUrl: string | null }>;
    }>;
}

export interface ProductDetail {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    shortDescription: string | null;
    brand: DetailRow['brand'];
    category: DetailRow['category'];
    discount: DetailRow['discount'];
    variants: Array<{
        id: string;
        sku: string;
        colorName: string | null;
        size: DetailRow['variants'][number]['size'];
        stockQuantity: DetailRow['variants'][number]['stockQuantity'];
        hexCode: DetailRow['variants'][number]['hexCode'];
        images: DetailRow['variants'][number]['images'];
        price: number;
        effectiveSalePrice: number | null;
    }>;
}

export interface SearchParams {
    q?: string;
    category?: string;
    brand?: string;
    collection?: string;
    sort?: string;
    page: number;
    limit: number;
}

export interface SearchResult {
    items: ProductSummary[];
    currentPage: number;
    totalPages: number;
    totalProducts: number;
    limit: number;
}

const PRODUCT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ----------------------------- helpers -----------------------------

/** True when the id matches the app's UUID product-id format. */
export const isValidProductId = (productId: string): boolean => PRODUCT_ID_RE.test(productId);

/**
 * Shape one product row into the storefront summary card DTO.
 * Rows without variants are omitted (they are not sellable).
 */
export const toProductSummary = (p: ProductSummarySource): ProductSummary | null => {
    if (!p.variants || p.variants.length === 0) return null;

    const variants: VariantSummary[] = p.variants.map((variant) => {
        const pricing = applyPriceLogic({
            price: variant.price,
            discount_type: p.discount?.type,
            discount_value: p.discount?.value,
        });
        return {
            id: variant.id,
            colorName: variant.colorName,
            hexCode: variant.hexCode,
            imageUrl: variant.images[0]?.imageUrl ?? null,
            price: pricing.original_price,
            effectiveSalePrice: pricing.effective_sale_price,
        };
    });

    return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        shortDescription: p.shortDescription,
        isBestseller: p.isHero,
        variants,
    };
}

// ----------------------------- queries -----------------------------

/** One active product by slug with full variant + discount detail, or null. */
export async function getProductDetail(slug: string): Promise<ProductDetail | null> {
    const product = await prisma.product.findFirst({
        where: { slug, isActive: true, isArchived: false },
        include: DETAIL_INCLUDE,
    });
    if (!product) return null;

    const variants = product.variants.map((variant) => {
        const pricing = applyPriceLogic({
            price: variant.price,
            discount_type: product.discount?.type,
            discount_value: product.discount?.value,
        });
        return {
            id: variant.id,
            sku: variant.sku,
            colorName: variant.colorName,
            size: variant.size,
            stockQuantity: variant.stockQuantity,
            hexCode: variant.hexCode,
            images: variant.images,
            price: pricing.original_price,
            effectiveSalePrice: pricing.effective_sale_price,
        };
    });

    return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: sanitizeHtml(product.description),
        shortDescription: sanitizeHtml(product.shortDescription),
        brand: product.brand,
        category: product.category,
        discount: product.discount,
        variants,
    };
}

/** Featured "hero" products for the Bestsellers surface (max 10). */
export async function getHeroProductSummaries(): Promise<ProductSummary[]> {
    const products = await prisma.product.findMany({
        where: { isHero: true, isActive: true, isArchived: false },
        take: 10,
        orderBy: { id: 'desc' },
        include: LIST_INCLUDE,
    });

    return products
        .map(toProductSummary)
        .filter((p): p is ProductSummary => p !== null);
}

/** Search + filter storefront products with pagination. */
export async function searchPublicProducts({
    q,
    category,
    brand,
    collection,
    sort,
    page,
    limit,
}: SearchParams): Promise<SearchResult> {
    const where: Prisma.ProductWhereInput = { isActive: true, isArchived: false };

    if (q) where.name = { contains: q };
    if (category) where.category = { slug: category };
    if (brand) where.brand = { slug: brand };
    if (collection) where.collections = { some: { collection: { slug: collection } } };

    const sortMap: Record<string, Prisma.ProductOrderByWithRelationInput> = {
        name_asc: { name: 'asc' },
        name_desc: { name: 'desc' },
        newest: { id: 'desc' },
    };
    const orderBy = sortMap[sort ?? ''] ?? { id: 'desc' };

    const skip = (page - 1) * limit;
    const [products, totalProducts] = await prisma.$transaction([
        prisma.product.findMany({ where, skip, take: limit, orderBy, include: LIST_INCLUDE }),
        prisma.product.count({ where }),
    ]);

    return {
        items: products.map(toProductSummary).filter((p): p is ProductSummary => p !== null),
        currentPage: page,
        totalPages: Math.ceil(totalProducts / limit),
        totalProducts,
        limit,
    };
}

/** Same-category products excluding the given one (max 10). */
export async function getRelatedProductSummaries(productId: string): Promise<ProductSummary[]> {
    const currentProduct = await prisma.product.findUnique({
        where: { id: productId },
        select: { categoryId: true },
    });

    if (!currentProduct?.categoryId) return [];

    const products = await prisma.product.findMany({
        where: {
            categoryId: currentProduct.categoryId,
            isActive: true,
            isArchived: false,
            id: { not: productId },
        },
        take: 10,
        orderBy: { id: 'desc' },
        include: LIST_INCLUDE,
    });

    return products
        .map(toProductSummary)
        .filter((p): p is ProductSummary => p !== null);
}