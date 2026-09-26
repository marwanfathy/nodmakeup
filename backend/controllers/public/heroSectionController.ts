import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { getActiveHeroSectionBySlug } from '../../services/heroSectionService';

/**
 * @desc      Get a single, active public hero section by its slug
 * @route     GET /api/v1/content/hero-sections/:slug
 * @access    Public
 */
export const getPublicHeroSectionBySlug = asyncHandler(async (req: Request, res: Response) => {
    const heroSection = await getActiveHeroSectionBySlug(req.params.slug);

    if (!heroSection) {
        res.status(404);
        throw new Error('Hero Section not found or is not active.');
    }

    res.status(200).json(heroSection);
});