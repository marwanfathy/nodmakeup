import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import * as brands from '../../services/adminBrandService';
import { call } from './domainCall';

const BRAND_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @desc      Create a new brand
 * @route     POST /api/v1/catalog/brands
 * @access    Private
 */
const createBrand = asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized, admin ID not found');
    }

    const { name, slug } = req.body;
    if (!name || !slug) {
        res.status(400);
        throw new Error('Name and slug are required fields');
    }

    res.status(201).json(await brands.createBrand({ adminId, name, slug }));
});

/**
 * @desc      Get all brands
 * @route     GET /api/v1/catalog/brands
 * @access    Private
 */
const getBrands = asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(await brands.listBrands());
});

/**
 * @desc      Get a single brand by ID
 * @route     GET /api/v1/catalog/brands/:id
 * @access    Private
 */
const getBrandById = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(await brands.getBrandById(req.params.id));
});

/**
 * @desc      Update a brand
 * @route     PUT /api/v1/catalog/brands/:id
 * @access    Private
 */
const updateBrand = asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized, admin ID not found');
    }

    const { name, slug } = req.body;

    res.status(200).json(
        await call(res, () => brands.updateBrand({ adminId, brandId: req.params.id, name, slug })),
    );
});

/**
 * @desc      Delete a brand (guarded against associated products)
 * @route     DELETE /api/v1/catalog/brands/:id
 * @access    Private
 */
const deleteBrand = asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized, admin ID not found');
    }

    const brandId = req.params.id;
    if (!BRAND_ID_RE.test(brandId)) {
        res.status(400);
        throw new Error('Invalid brand ID');
    }

    await call(res, () => brands.deleteBrandWithGuard({ adminId, brandId }));

    res.status(200).json({ message: 'Brand deleted successfully' });
});

export { createBrand, getBrands, getBrandById, updateBrand, deleteBrand };