import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import * as heroSections from '../../services/adminHeroSectionService';
import { call } from './domainCall';

/**
 * @desc      Create a new Hero Section
 * @route     POST /api/v1/content/hero-sections
 * @access    Private
 */
export const createHeroSection = asyncHandler(async (req: Request, res: Response) => {
    const { title, description, slug, isActive, slides } = req.body;

    const newHeroSection = await heroSections.createHeroSection({ title, description, slug, isActive, slides });

    res.status(201).json(newHeroSection);
});

/**
 * @desc      Update a Hero Section
 * @route     PUT /api/v1/content/hero-sections/:id
 * @access    Private
 */
export const updateHeroSection = asyncHandler(async (req: Request, res: Response) => {
    const { title, description, slug, isActive, slides } = req.body;
    const sectionId = req.params.id;

    res.status(200).json(
        await call(res, () => heroSections.updateHeroSection({ sectionId, title, description, slug, isActive, slides })),
    );
});

/**
 * @desc      Get a single Hero Section by ID for editing
 * @route     GET /api/v1/content/hero-sections/:id
 * @access    Private
 */
export const getHeroSectionById = asyncHandler(async (req: Request, res: Response) => {
    const heroSection = await heroSections.getHeroSectionById(req.params.id);
    if (!heroSection) {
        res.status(404);
        throw new Error('Hero Section not found');
    }
    res.status(200).json(heroSection);
});

/**
 * @desc      Get all Hero Sections
 * @route     GET /api/v1/content/hero-sections
 * @access    Private
 */
export const getHeroSections = asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(await heroSections.listHeroSections());
});

/**
 * @desc      Delete a Hero Section
 * @route     DELETE /api/v1/content/hero-sections/:id
 * @access    Private
 */
export const deleteHeroSection = asyncHandler(async (req: Request, res: Response) => {
    await call(res, () => heroSections.deleteHeroSection(req.params.id));
    res.status(200).json({ message: 'Hero Section deleted successfully' });
});