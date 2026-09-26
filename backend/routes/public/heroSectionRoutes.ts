import express from 'express';
const router = express.Router();
import { getPublicHeroSectionBySlug } from '../../controllers/public/heroSectionController';

/**
 * @desc    Public route to fetch a single, active hero section by its slug.
 * @route   GET /api/public/hero-sections/:slug
 * @access  Public
 */
router.route('/:slug').get(getPublicHeroSectionBySlug);

export default router;