import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import {
    getPublishedCollections,
    getPublishedCollectionBySlug,
} from '../../services/collectionService';

/**
 * @desc      Public list of published collections (homepage feature tiles)
 * @route     GET /api/v1/catalog/collections
 * @access    Public
 */
export const getPublicCollections = asyncHandler(async (_req: Request, res: Response) => {
    const data = await getPublishedCollections();
    res.status(200).json({ success: true, data });
});

/**
 * @desc      Get a single public collection and its products by slug
 * @route     GET /api/v1/catalog/collections/:slug
 * @access    Public
 */
export const getCollectionBySlug = asyncHandler(async (req: Request, res: Response) => {
    const data = await getPublishedCollectionBySlug(req.params.slug);

    if (!data) {
        res.status(404);
        throw new Error('Collection not found');
    }

    res.status(200).json({ success: true, data });
});