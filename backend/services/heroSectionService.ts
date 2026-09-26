// Hero section service — public, active hero section with slides + media.
import prisma from '../config/prismaClient';
import { Prisma } from '@prisma/client';

const HERO_INCLUDE = {
    slides: {
        orderBy: { displayOrder: 'asc' },
        include: {
            mediaItems: {
                orderBy: { displayOrder: 'asc' },
            },
        },
    },
} satisfies Prisma.HeroSectionInclude;

export type PublicHeroSection = Prisma.HeroSectionGetPayload<{
    include: typeof HERO_INCLUDE;
}>;

export async function getActiveHeroSectionBySlug(
    slug: string,
): Promise<PublicHeroSection | null> {
    return prisma.heroSection.findFirst({
        where: { slug, isActive: true },
        include: HERO_INCLUDE,
    });
}