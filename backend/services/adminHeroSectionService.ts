// Admin hero-section service — hero section lifecycle for the admin panel.
// Owns nested create (slides + media items), the update transaction that
// rebuilds slides, list/detail and delete.
import prisma from '../config/prismaClient';
import { HeroMediaType, HeroLayoutStyle } from '@prisma/client';
import { DomainError } from './domainError';

interface MediaItemInput {
    mediaUrl: string;
    mediaType: HeroMediaType;
    altText?: string;
    displayOrder: number;
    layoutStyle: HeroLayoutStyle;
    [key: string]: any;
}

interface HeroSlideInput {
    title: string;
    subtitle?: string;
    linkUrl: string;
    thumbnailUrl: string;
    displayOrder: number;
    mediaItems: MediaItemInput[];
    [key: string]: any;
}

/** Create a hero section with its slides + media items. */
export async function createHeroSection(input: {
    title?: string;
    description?: string;
    slug?: string;
    isActive?: boolean;
    slides?: HeroSlideInput[];
}) {
    const { title, description, slug, isActive, slides } = input;

    return prisma.heroSection.create({
        data: {
            title: title as string,
            description,
            slug: slug as string,
            isActive,
            slides: {
                create: (slides || []).map((slide) => ({
                    title: slide.title,
                    subtitle: slide.subtitle,
                    linkUrl: slide.linkUrl,
                    thumbnailUrl: slide.thumbnailUrl,
                    displayOrder: slide.displayOrder,
                    mediaItems: {
                        create: slide.mediaItems.map((item) => ({
                            mediaUrl: item.mediaUrl,
                            mediaType: item.mediaType,
                            altText: item.altText,
                            displayOrder: item.displayOrder,
                            layoutStyle: item.layoutStyle,
                        })),
                    },
                })),
            },
        },
        include: { slides: { include: { mediaItems: { orderBy: { displayOrder: 'asc' } } } } },
    });
}

/** Update a hero section: replaces core fields + rebuilds slides atomically. */
export async function updateHeroSection(input: {
    sectionId: string;
    title?: string;
    description?: string;
    slug?: string;
    isActive?: boolean;
    slides?: HeroSlideInput[];
}) {
    const { sectionId, title, description, slug, isActive, slides } = input;

    await prisma.$transaction(async (tx) => {
        await tx.heroSection.update({
            where: { id: sectionId },
            data: { title, description, slug, isActive },
        });

        await tx.heroSlide.deleteMany({ where: { heroSectionId: sectionId } });

        if (slides && slides.length > 0) {
            for (const slide of slides) {
                await tx.heroSlide.create({
                    data: {
                        heroSectionId: sectionId,
                        title: slide.title,
                        subtitle: slide.subtitle,
                        linkUrl: slide.linkUrl,
                        thumbnailUrl: slide.thumbnailUrl,
                        displayOrder: slide.displayOrder,
                        mediaItems: {
                            create: slide.mediaItems.map((item) => ({
                                mediaUrl: item.mediaUrl,
                                mediaType: item.mediaType,
                                altText: item.altText,
                                displayOrder: item.displayOrder,
                                layoutStyle: item.layoutStyle,
                            })),
                        },
                    },
                });
            }
        }
    });

    return prisma.heroSection.findUnique({
        where: { id: sectionId },
        include: { slides: { orderBy: { displayOrder: 'asc' }, include: { mediaItems: { orderBy: { displayOrder: 'asc' } } } } },
    });
}

/** Single hero section with ordered slides + media; null when missing. */
export async function getHeroSectionById(sectionId: string) {
    return prisma.heroSection.findUnique({
        where: { id: sectionId },
        include: {
            slides: {
                orderBy: { displayOrder: 'asc' },
                include: {
                    mediaItems: {
                        orderBy: { displayOrder: 'asc' },
                    },
                },
            },
        },
    });
}

/** All hero sections, most recently updated first. */
export async function listHeroSections() {
    return prisma.heroSection.findMany({ orderBy: { updatedAt: 'desc' } });
}

/** Hard-delete a hero section and its slides (cascade). */
export async function deleteHeroSection(sectionId: string) {
    await prisma.heroSection.delete({ where: { id: sectionId } });
}

// Re-exported so callers can type-check slide payloads if needed.
export type { HeroSlideInput, MediaItemInput };