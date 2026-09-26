import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import {
    getProductDetail,
    getHeroProductSummaries,
    searchPublicProducts,
    getRelatedProductSummaries,
    isValidProductId,
} from '../../services/catalogService';

/**
 * @desc      Get a single product by its slug for the public detail page
 * @route     GET /api/public/products/:slug
 * @access    Public
 */
export const getProductBySlug = asyncHandler(async (req: Request, res: Response) => {
    const data = await getProductDetail(req.params.slug);

    if (!data) {
        res.status(404);
        throw new Error('Product not found.');
    }

    res.status(200).json({ success: true, data });
});

/**
 * @desc      Get featured "hero" products (used for Bestsellers)
 * @route     GET /api/public/products/hero
 * @access    Public
 */
export const getHeroProducts = asyncHandler(async (_req: Request, res: Response) => {
    const data = await getHeroProductSummaries();
    res.status(200).json({ success: true, data });
});

/**
 * Hard ceilings for the public catalogue query. `parseInt(req.query.limit) || 12`
 * used to accept any integer the caller liked and hand it straight to Prisma's
 * `take`, so a single unauthenticated `?limit=1000000` asked the database for the
 * entire catalogue in one round trip. The admin analytics endpoints already
 * clamp with Math.min; the public one did not, and it is the one that is
 * reachable without a token.
 */
const MAX_PAGE_SIZE = 48;
const MAX_PAGE_OFFSET = 10_000;

/** Clamp to a positive integer within bounds; falls back when unparseable. */
const clampInt = (raw: unknown, fallback: number, min: number, max: number): number => {
    const n = Number.parseInt(String(raw ?? ''), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(n, min), max);
};

/**
 * @desc      Search and filter products
 * @route     GET /api/public/products/search
 * @access    Public
 */
export const searchProducts = asyncHandler(async (req: Request, res: Response) => {
    const page = clampInt(req.query.page, 1, 1, 10_000);
    const limit = clampInt(req.query.limit, 12, 1, MAX_PAGE_SIZE);

    // A huge page number is cheap to request and expensive to serve, because
    // OFFSET makes the database walk and discard every skipped row. Cap the
    // reachable window instead of letting `?page=99999999` scan the table.
    const pageOffset = (page - 1) * limit;
    const effectivePage = pageOffset > MAX_PAGE_OFFSET ? Math.floor(MAX_PAGE_OFFSET / limit) + 1 : page;

    const result = await searchPublicProducts({
        q: (req.query.q as string | undefined)?.slice(0, 120),
        category: req.query.category as string | undefined,
        brand: req.query.brand as string | undefined,
        collection: req.query.collection as string | undefined,
        sort: req.query.sort as string | undefined,
        page: effectivePage,
        limit,
    });

    res.status(200).json({
        success: true,
        pagination: {
            currentPage: result.currentPage,
            totalPages: result.totalPages,
            totalProducts: result.totalProducts,
            limit: result.limit,
        },
        data: result.items,
    });
});

/**
 * @desc      Get related products based on category (excludes current product)
 * @route     GET /api/public/products/related/:productId
 * @access    Public
 */
export const getRelatedProducts = asyncHandler(async (req: Request, res: Response) => {
    const { productId } = req.params;

    if (!isValidProductId(productId)) {
        res.status(400);
        throw new Error('Invalid Product ID');
    }

    const data = await getRelatedProductSummaries(productId);
    res.status(200).json({ success: true, data });
});