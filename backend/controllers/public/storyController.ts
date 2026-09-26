import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import * as storyService from '../../services/storyService';

/**
 * @desc      Get active stories, grouped by Bundle (upload session)
 * @route     GET /api/v1/content/stories
 * @access    Public
 */
export const getActiveStories = asyncHandler(async (_req: Request, res: Response) => {
    const data = await storyService.getActiveStoryBundles();
    res.status(200).json({ success: true, count: data.length, data });
});

/**
 * @desc      Record a story view
 * @route     POST /api/v1/content/stories/:storyId/view
 * @access    Public
 */
export const incrementStoryView = asyncHandler(async (req: Request, res: Response) => {
    const { storyId } = req.params;
    if (!storyService.isValidStoryId(storyId)) {
        res.status(400).json({ message: 'Invalid story ID format.' });
        return;
    }
    await storyService.incrementStoryView(storyId);
    res.status(200).json({ success: true, message: 'View recorded.' });
});

/**
 * @desc      Record a story click
 * @route     POST /api/v1/content/stories/:storyId/click
 * @access    Public
 */
export const incrementStoryClick = asyncHandler(async (req: Request, res: Response) => {
    const { storyId } = req.params;
    if (!storyService.isValidStoryId(storyId)) {
        res.status(400).json({ message: 'Invalid story ID format.' });
        return;
    }
    await storyService.incrementStoryClick(storyId);
    res.status(200).json({ success: true, message: 'Click recorded.' });
});