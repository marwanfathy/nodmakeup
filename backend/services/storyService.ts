// Story service — public stories: active-bundle grouping + engagement counters.
import prisma from '../config/prismaClient';
import { MediaType } from '@prisma/client';

export interface PublicStoryItem {
    id: string;
    mediaUrl: string;
    thumbnailUrl: string | null;
    mediaType: MediaType;
    createdAt: Date;
}

export interface StoryBundle {
    bundleId: string;
    adminId: string;
    adminName: string;
    uploadedAt: Date;
    stories: PublicStoryItem[];
}

const STORY_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidStoryId = (storyId: string): boolean => STORY_ID_RE.test(storyId);

/** Active stories grouped by upload bundle (newest first). */
export async function getActiveStoryBundles(): Promise<StoryBundle[]> {
    const stories = await prisma.story.findMany({
        where: { expiresAt: { gt: new Date() } },
        select: {
            id: true,
            mediaUrl: true,
            thumbnailUrl: true,
            mediaType: true,
            createdAt: true,
            bundleId: true,
            admin: {
                select: { id: true, firstName: true, lastName: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    const bundlesMap = new Map<string, StoryBundle>();

    for (const story of stories) {
        if (!bundlesMap.has(story.bundleId)) {
            bundlesMap.set(story.bundleId, {
                bundleId: story.bundleId,
                adminId: story.admin.id,
                adminName: `${story.admin.firstName} ${story.admin.lastName}`.trim(),
                uploadedAt: story.createdAt,
                stories: [],
            });
        }

        const bundle = bundlesMap.get(story.bundleId);
        if (bundle) {
            bundle.stories.push({
                id: story.id,
                mediaUrl: story.mediaUrl,
                thumbnailUrl: story.thumbnailUrl,
                mediaType: story.mediaType,
                createdAt: story.createdAt,
            });
        }
    }

    return Array.from(bundlesMap.values());
}

export async function incrementStoryView(storyId: string): Promise<void> {
    await prisma.story.update({
        where: { id: storyId },
        data: { viewCount: { increment: 1 } },
    });
}

export async function incrementStoryClick(storyId: string): Promise<void> {
    await prisma.story.update({
        where: { id: storyId },
        data: { clickCount: { increment: 1 } },
    });
}