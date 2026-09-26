// Admin collection service — collection CRUD with scheduling for the admin
// panel. Owns create/list/detail/update/delete with audit logging; controllers
// validate shape (scheduling dates) and map responses.
import prisma from '../config/prismaClient';
import { AdminActionType } from '@prisma/client';
import { logAdminAction } from '../utils/logger';
import { DomainError } from './domainError';

export interface CollectionWriteInput {
    name?: string;
    slug?: string;
    description?: string;
    isPublished?: boolean;
    /** Original date or "" / null / undefined; converted to Date here. */
    publishAt?: unknown;
    endsAt?: unknown;
}

const toDateOrNull = (raw: unknown, canClear: boolean): Date | null | undefined => {
    if (raw) return new Date(raw as string);
    if (canClear && raw === null) return null;
    return undefined;
};

/** Create a collection with publish/expiry scheduling. */
export async function createCollection(input: { adminId: string } & CollectionWriteInput) {
    const { adminId, name, slug, description, isPublished, publishAt, endsAt } = input;

    const newCollection = await prisma.collection.create({
        data: {
            name: name as string,
            slug: slug as string,
            description,
            isPublished: isPublished === true, // Explicitly check for true
            publishAt: toDateOrNull(publishAt, false),
            endsAt: toDateOrNull(endsAt, false),
        },
    });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.PRODUCT_CREATE, // Using a generic type
        targetResource: 'Collection',
        targetId: newCollection.id,
        details: { data: newCollection },
    });

    return newCollection;
}

/** All collections (admin panel sees all, regardless of schedule). */
export async function listCollections() {
    return prisma.collection.findMany({ orderBy: { name: 'asc' } });
}

/** Single collection by id (throws Prisma P2025 -> 500 when missing, as before). */
export async function getCollectionById(collectionId: string) {
    return prisma.collection.findUniqueOrThrow({ where: { id: collectionId } });
}

/** Update a collection (publishAt/endsAt: date string, null to clear, absent = untouched). */
export async function updateCollection(input: { adminId: string; collectionId: string } & CollectionWriteInput) {
    const { adminId, collectionId, name, slug, description, isPublished, publishAt, endsAt } = input;

    const collectionBeforeUpdate = await prisma.collection.findUnique({ where: { id: collectionId } });
    if (!collectionBeforeUpdate) {
        throw new DomainError('Collection not found', 404);
    }

    const updatedCollection = await prisma.collection.update({
        where: { id: collectionId },
        data: {
            name: name as string,
            slug: slug as string,
            description,
            isPublished,
            publishAt: toDateOrNull(publishAt, true),
            endsAt: toDateOrNull(endsAt, true),
        },
    });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.PRODUCT_UPDATE,
        targetResource: 'Collection',
        targetId: collectionId,
        details: { from: collectionBeforeUpdate, to: updatedCollection },
    });

    return updatedCollection;
}

/** Hard-delete a collection. */
export async function deleteCollection(input: { adminId: string; collectionId: string }) {
    const { adminId, collectionId } = input;

    const collectionToDelete = await prisma.collection.findUnique({ where: { id: collectionId } });
    if (!collectionToDelete) {
        throw new DomainError('Collection not found', 404);
    }

    await prisma.collection.delete({ where: { id: collectionId } });

    await logAdminAction({
        adminId,
        actionType: AdminActionType.PRODUCT_DELETE,
        targetResource: 'Collection',
        targetId: collectionId,
        details: { deletedCollection: collectionToDelete },
    });
}