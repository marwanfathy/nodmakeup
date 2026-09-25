import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import * as products from '../../services/adminProductService';
import { call } from './domainCall';

/**
 * @desc      Create a new product with variants and images
 * @route     POST /api/v1/catalog/products
 * @access    Private
 */
export const createProduct = asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized, admin ID not found');
    }

    const { name, slug, description, shortDescription, categoryId, brandId, isActive, isHero, discountId, variants, collectionIds } = req.body;

    if (!name || !slug || !categoryId || !brandId || !variants || !Array.isArray(variants)) {
        res.status(400);
        throw new Error('Missing required product data');
    }

    const newProduct = await products.createProduct(adminId, {
        name, slug, description, shortDescription, categoryId, brandId,
        isActive, isHero, discountId, variants, collectionIds,
    });

    res.status(201).json({ message: 'Product created successfully', data: newProduct });
});

/**
 * @desc      Update a product (sync variants instead of deleting all)
 * @route     PUT /api/v1/catalog/products/:id
 * @access    Private
 */
export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const productId = req.params.id;
    const { name, slug, description, shortDescription, categoryId, brandId, isActive, isHero, discountId, variants, collectionIds } = req.body;

    const updatedProduct = await call(res, () =>
        products.updateProduct(adminId, productId, {
            name, slug, description, shortDescription, categoryId, brandId,
            isActive, isHero, discountId, variants, collectionIds,
        }),
    );

    res.status(200).json(updatedProduct);
});

/**
 * @desc      Get all products (summary)
 * @route     GET /api/v1/catalog/products
 * @access    Private
 */
export const getProducts = asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(await products.listProductsSummary());
});

/**
 * @desc      Get single product details
 * @route     GET /api/v1/catalog/products/:id
 * @access    Private
 */
export const getProductById = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(await products.getProductDetails(req.params.id));
});

/**
 * @desc      Archive a product
 * @route     PUT /api/v1/catalog/products/:id/archive
 * @access    Private
 */
export const archiveProduct = asyncHandler(async (req: Request, res: Response) => {
    await products.archiveProduct(req.params.id);
    res.status(200).json({ message: 'Product archived' });
});

/**
 * @desc      Unarchive a product
 * @route     PUT /api/v1/catalog/products/:id/unarchive
 * @access    Private
 */
export const unarchiveProduct = asyncHandler(async (req: Request, res: Response) => {
    await products.unarchiveProduct(req.params.id);
    res.status(200).json({ message: 'Product restored' });
});

/**
 * @desc      Delete a product (guarded against order history)
 * @route     DELETE /api/v1/catalog/products/:id
 * @access    Private
 */
export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
    await call(res, () => products.deleteProductWithGuard(req.params.id));
    res.status(200).json({ message: 'Product deleted' });
});