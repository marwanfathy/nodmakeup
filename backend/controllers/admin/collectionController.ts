import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import * as collections from '../../services/adminCollectionService';
import { call } from './domainCall';

/**
 * @desc      Create a new collection with scheduling
 * @route     POST /api/v1/catalog/collections
 * @access    Private
 */
const createCollection = asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized, admin ID not found');
    }

    const { name, slug, description, isPublished, publishAt, endsAt } = req.body;
    if (!name || !slug) {
        res.status(400);
        throw new Error('Name and slug are required fields');
    }

    res.status(201).json(
        await collections.createCollection({ adminId, name, slug, description, isPublished, publishAt, endsAt }),
    );
});

/**
 * @desc      Get all collections (admin panel sees all, regardless of schedule)
 * @route     GET /api/v1/catalog/collections
 * @access    Private
 */
const getCollections = asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(await collections.listCollections());
});

/**
 * @desc      Get a single collection by ID
 * @route     GET /api/v1/catalog/collections/:id
 * @access    Private
 */
const getCollectionById = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(await collections.getCollectionById(req.params.id));
});

/**
 * @desc      Update a collection
 * @route     PUT /api/v1/catalog/collections/:id
 * @access    Private
 */
const updateCollection = asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized, admin ID not found');
    }

    const collectionId = req.params.id;
    const { name, slug, description, isPublished, publishAt, endsAt } = req.body;

    res.status(200).json(
        await call(res, () =>
            collections.updateCollection({ adminId, collectionId, name, slug, description, isPublished, publishAt, endsAt }),
        ),
    );
});

/**
 * @desc      Delete a collection (hard delete)
 * @route     DELETE /api/v1/catalog/collections/:id
 * @access    Private
 */
const deleteCollection = asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized, admin ID not found');
    }

    await call(res, () => collections.deleteCollection({ adminId, collectionId: req.params.id }));

    res.status(200).json({ message: 'Collection deleted successfully' });
});

export { createCollection, getCollections, getCollectionById, updateCollection, deleteCollection };