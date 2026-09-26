// Shipping service — public shipping zones (excludes the internal default zone).
import prisma from '../config/prismaClient';
import { Prisma } from '@prisma/client';

export interface PublicShippingZone {
    id: string;
    governorate: string;
    shippingCost: Prisma.Decimal; // Decimal.toJSON() -> string on the wire (legacy contract)
}

export async function getPublicShippingZones(): Promise<PublicShippingZone[]> {
    return prisma.shippingZone.findMany({
        where: { governorate: { not: 'Default' } },
        select: { id: true, governorate: true, shippingCost: true },
        orderBy: { governorate: 'asc' },
    });
}