import express from 'express';
const router = express.Router();

// Import all three public controller functions
import {
    getActiveStories,
    incrementStoryView,
    incrementStoryClick,
} from '../../controllers/public/storyController';

// GET all active stories
router.route('/')
    .get(getActiveStories);

// POST to increment the view count of a story
router.route('/:storyId/view')
    .post(incrementStoryView);

// POST to increment the click count of a story
router.route('/:storyId/click')
    .post(incrementStoryClick);

export default router;