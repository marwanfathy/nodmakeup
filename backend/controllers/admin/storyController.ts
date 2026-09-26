import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import * as stories from '../../services/adminStoryService';
import { call } from './domainCall';

const STORY_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @desc      Create a new story (single or batch)
 * @route     POST /api/v1/content/stories
 * @access    Private
 */
const createStory = asyncHandler(async (req: Request, res: Response) => {
    const rawAdminId = req.admin?.admin_id;
    if (!rawAdminId) {
        res.status(401);
        throw new Error('Not authorized, admin ID not found');
    }

    const createdStories = await call(res, () => stories.createStories({ adminId: rawAdminId, body: req.body }));

    res.status(201).json({
        success: true,
        message: `Created ${createdStories.length} stories in bundle ${createdStories[0]?.bundleId}`,
        data: createdStories,
    });
});

/**
 * @desc      Get all stories for the admin panel
 * @route     GET /api/v1/content/stories
 * @access    Private
 */
const getStories = asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(await stories.listStories());
});

/**
 * @desc      Delete a story
 * @route     DELETE /api/v1/content/stories/:id
 * @access    Private
 */
const deleteStory = asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.admin?.admin_id;
    if (!adminId) {
        res.status(401);
        throw new Error('Not authorized, admin ID not found');
    }

    const storyId = req.params.id;
    if (!STORY_ID_RE.test(storyId)) {
        res.status(400);
        throw new Error('Invalid Story ID');
    }

    await call(res, () => stories.deleteStory({ adminId, storyId }));

    res.status(200).json({ message: 'Story deleted successfully' });
});

export { createStory, getStories, deleteStory };