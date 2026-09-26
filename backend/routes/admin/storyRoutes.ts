import express from 'express';
import asyncHandler from 'express-async-handler';
const router = express.Router();

import {
    createStory,
    getStories,
    deleteStory,
} from '../../controllers/admin/storyController';

import { getActiveStories } from '../../controllers/public/storyController';

// Only import 'protect' as the role system is gone
import { protect } from '../../middleware/authMiddleware';
import { protectIfToken } from '../../middleware/requireValidId';
import requireValidId from '../../middleware/requireValidId';

// POST a new story and GET all stories
router.route('/')
    .post(protect, createStory)
    .get(protectIfToken, asyncHandler(async (req, res, next) => {
        // Public callers fall through to the public route mounted at the same path.
        // With a token, allow the admin list, or `?public=true` for the public view.
        if (req.query.public === 'true') {
            await getActiveStories(req, res, next);
            return;
        }
        await getStories(req, res, next);
    }));

// DELETE an existing story by its ID
router.route('/:id')
    .delete(requireValidId, protect, deleteStory);

export default router;