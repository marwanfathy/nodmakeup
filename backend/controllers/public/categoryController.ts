import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { getPublicCategories } from '../../services/categoryService';

/**
 * @desc      Fetch all active categories for public display
 * @route     GET /api/v1/catalog/categories
 * @access    Public
 */
export const getAllPublicCategories = asyncHandler(async (_req: Request, res: Response) => {
    const categories = await getPublicCategories();

    res.status(200).json({
        success: true,
        count: categories.length,
        data: categories,
    });
});