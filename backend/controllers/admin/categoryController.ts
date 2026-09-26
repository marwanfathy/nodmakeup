import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import * as categories from '../../services/adminCategoryService';
import { call } from './domainCall';

// Helper function to safely parse boolean values from a request
const parseBoolean = (value: unknown): boolean | undefined => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
};

/**
 * @desc      Create a new category
 * @route     POST /api/v1/catalog/categories
 * @access    Private
 */
const createCategory = asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized, admin ID not found');
    }

    const { name, slug, isActive } = req.body;
    if (!name || !slug) {
        res.status(400);
        throw new Error('Name and slug are required fields');
    }

    res.status(201).json(await categories.createCategory({ adminId, name, slug, isActive: parseBoolean(isActive) }));
});

/**
 * @desc      Get all categories
 * @route     GET /api/v1/catalog/categories
 * @access    Private
 */
const getCategories = asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(await categories.listCategories());
});

/**
 * @desc      Get a single category by ID
 * @route     GET /api/v1/catalog/categories/:id
 * @access    Private
 */
const getCategoryById = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(await categories.getCategoryById(req.params.id));
});

/**
 * @desc      Update a category
 * @route     PUT /api/v1/catalog/categories/:id
 * @access    Private
 */
const updateCategory = asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized, admin ID not found');
    }

    const categoryId = req.params.id;
    const { name, slug, isActive } = req.body;

    const dataToUpdate: { name?: string; slug?: string; isActive?: boolean } = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (slug !== undefined) dataToUpdate.slug = slug;
    if (isActive !== undefined) {
        const activeStatus = parseBoolean(isActive);
        if (typeof activeStatus === 'boolean') {
            dataToUpdate.isActive = activeStatus;
        }
    }

    res.status(200).json(await call(res, () => categories.updateCategory({ adminId, categoryId, data: dataToUpdate })));
});

/**
 * @desc      Delete a category (hard delete)
 * @route     DELETE /api/v1/catalog/categories/:id
 * @access    Private
 */
const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized, admin ID not found');
    }

    await call(res, () => categories.deleteCategory({ adminId, categoryId: req.params.id }));

    res.status(200).json({ message: 'Category deleted successfully' });
});

export { createCategory, getCategories, getCategoryById, updateCategory, deleteCategory };