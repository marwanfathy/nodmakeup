// Admin story service — story creation (single or batch), listing and
// deletion for the admin panel. Owns input normalization + case-insensitive
// media-type matching, the bundle transaction, and audit logging.
import prisma from '../config/prismaClient';
import { MediaType, AdminActionType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logAdminAction } from '../utils/logger';
import { DomainError } from './domainError';

// Match a string to the MediaType enum, ignoring case. Null when invalid.
const getValidMediaType = (input: unknown): MediaType | null => {
    if (!input) return null;
    const validValues = Object.values(MediaType) as string[];
    const match = validValues.find((v) => v.toLowerCase() === input.toString().toLowerCase());
    return match ? (match as MediaType) : null;
};

/**
 * Create stories (single item or a batch sharing one bundle id). Validation
 * failures are client errors (400); the bundle transaction is atomic.
 */
export async function createStories(input: { adminId: string; body: unknown }) {
    const { adminId, body } = input;

    // 1. Normalize input: treat everything as an array.
    const rawInput = Array.isArray(body) ? body : [body];

    if (rawInput.length === 0) {
        throw new DomainError('No story data provided', 400);
    }

    // 2. One UNIQUE bundle id for this upload request; stories live 24h.
    const bundleId = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // 3. Validate and prepare data.
    const storiesData = rawInput.map((item: any, index: number) => {
        const { mediaUrl, mediaType, thumbnailUrl } = item;

        if (!mediaUrl || !mediaType) {
            throw new DomainError(`Item at index ${index} missing mediaUrl or mediaType`, 400);
        }

        const validMediaType = getValidMediaType(mediaType);
        if (!validMediaType) {
            throw new DomainError(
                `Item at index ${index} has invalid mediaType: '${mediaType}'. Expected: ${Object.values(MediaType).join(', ')}`,
                400,
            );
        }

        return {
            adminId,
            mediaUrl,
            mediaType: validMediaType, // Use the correct Enum value from database
            thumbnailUrl: thumbnailUrl || null,
            expiresAt,
            bundleId,
        };
    });

    // 4. Create stories in a transaction, auditing each one.
    return prisma.$transaction(async (tx) => {
        const results = [];
        for (const data of storiesData) {
            const story = await tx.story.create({ data });
            results.push(story);

            await logAdminAction({
                adminId,
                actionType: AdminActionType.STORY_CREATE,
                targetResource: 'Story',
                targetId: story.id,
                details: {
                    mediaUrl: story.mediaUrl,
                    bundleId: story.bundleId,
                    type: story.mediaType,
                    isBatch: rawInput.length > 1,
                },
            });
        }
        return results;
    });
}

/** All stories with the uploading admin's name, newest first. */
export async function listStories() {
    return prisma.story.findMany({
        include: {
            admin: {
                select: {
                    firstName: true,
                    lastName: true,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
}

/** Hard-delete a story. */
export async function deleteStory(input: { adminId: string; storyId: string }) {
    const { adminId, storyId } = input;

    const storyToDelete = await prisma.story.findUnique({ where: { id: storyId } });
    if (!storyToDelete) {
        throw new DomainError('Story not found', 404);
    }

    await prisma.story.delete({ where: { id: storyId } });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.STORY_DELETE,
        targetResource: 'Story',
        targetId: storyId,
        details: { deletedMediaUrl: storyToDelete.mediaUrl },
    });
}