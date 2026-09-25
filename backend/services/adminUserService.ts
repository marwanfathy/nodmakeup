// Admin user service — admin-account management for the admin panel.
// Owns creation (with bcrypt hashing + duplicate email guard), listing and
// hard deletion, with audit logging of who did what.
import bcrypt from 'bcryptjs';
import prisma from '../config/prismaClient';
import { AdminActionType } from '@prisma/client';
import { logAdminAction } from '../utils/logger';
import { DomainError } from './domainError';

/** Create an admin user (guards duplicate emails). */
export async function createAdminUser(input: {
    performingAdminId: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
}) {
    const { performingAdminId, firstName, lastName, email, password } = input;

    const adminExists = await prisma.admin.findUnique({ where: { email } });
    if (adminExists) {
        throw new DomainError('Admin with this email already exists', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newAdmin = await prisma.admin.create({
        data: {
            firstName,
            lastName,
            email,
            password: hashedPassword,
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
        },
    });

    await logAdminAction({
        adminId: performingAdminId,
        actionType: AdminActionType.ADMIN_CREATE,
        targetResource: 'Admin',
        targetId: newAdmin.id,
        details: { createdAdminEmail: newAdmin.email },
    });

    return newAdmin;
}

/** All admin users (no passwords), newest first. */
export async function listAdminUsers() {
    return prisma.admin.findMany({
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });
}

/** Hard-delete an admin user. */
export async function deleteAdminUser(input: { performingAdminId: string; adminIdToDelete: string }) {
    const { performingAdminId, adminIdToDelete } = input;

    const adminToDelete = await prisma.admin.findUnique({ where: { id: adminIdToDelete } });
    if (!adminToDelete) {
        throw new DomainError('Admin to delete not found', 404);
    }

    await prisma.admin.delete({ where: { id: adminIdToDelete } });

    await logAdminAction({
        adminId: performingAdminId,
        actionType: AdminActionType.ADMIN_DELETE,
        targetResource: 'Admin',
        targetId: adminIdToDelete,
        details: { deletedAdminEmail: adminToDelete.email },
    });
}