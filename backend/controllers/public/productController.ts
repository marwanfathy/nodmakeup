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
 * @desc      Search and filter products
 * @route     GET /api/public/products/search
 * @access    Public
 */
export const searchProducts = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;

    const result = await searchPublicProducts({
        q: req.query.q as string | undefined,
        category: req.query.category as string | undefined,
        brand: req.query.brand as string | undefined,
        collection: req.query.collection as string | undefined,
        sort: req.query.sort as string | undefined,
        page,
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