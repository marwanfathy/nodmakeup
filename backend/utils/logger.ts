import { Prisma, PrismaClient, AdminActionType } from '@prisma/client';
import { Request } from 'express';
import prisma from '../config/prismaClient';

// The type for the Prisma transaction client
type PrismaTransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

// Define a clear interface for the logging options
interface LogAdminActionOptions {
    adminId: string;
    actionType: AdminActionType;
    req?: Request;
    targetResource?: string;
    targetId?: string;
    details?: object;
    tx?: PrismaTransactionClient;
}

/**
 * Logs a specific action performed by an admin into the admin_logs table.
 * @param options - The logging options.
 */
export const logAdminAction = async ({
    adminId,
    actionType,
    req,
    targetResource,
    targetId,
    details,
    tx,
}: LogAdminActionOptions): Promise<void> => {
    const logData = {
        adminId,
        actionType,
        targetResource,
        targetId,
        details: details || Prisma.JsonNull,
    };

    const dbClient = tx || prisma;

    await dbClient.adminLog.create({
        data: logData,
    });
};