// CRM service — customer profiles, segmentation, notes and backfill for the
// admin panel. All persistence for the CRM surface lives here; controllers
// only parse params/body and map HTTP responses.
import prisma from '../config/prismaClient';
import { AdminActionType } from '@prisma/client';
import { logAdminAction } from '../utils/logger';
import { rebuildCustomerProfiles, SEGMENT_ORDER } from './customerProfile';
import { formatDecimal } from '../utils/decimalFormat';

/** CRM overview KPIs: customers, orders, spend + lifetime value. */
export async function getCrmOverview() {
    const [totalCustomers, orders, totalSpentAgg] = await Promise.all([
        prisma.customerProfile.count(),
        prisma.order.aggregate({
            _count: { id: true },
            _sum: { totalPrice: true },
        }),
        prisma.customerProfile.aggregate({
            _sum: { totalSpent: true },
            _avg: { totalSpent: true },
        }),
    ]);

    return {
        totalCustomers,
        totalOrders: orders._count.id,
        totalSpent: formatDecimal(totalSpentAgg._sum.totalSpent),
        averageLifetimeValue: formatDecimal(totalSpentAgg._avg.totalSpent),
        orderValue: formatDecimal(orders._sum.totalPrice),
    };
}

/** Segment breakdown with counts, ordered by the canonical segment order. */
export async function getSegmentBreakdown() {
    const grouped = await prisma.customerProfile.groupBy({
        by: ['segment'],
        _count: { id: true },
    });

    const countBySegment: Record<string, number> = {};
    for (const g of grouped) {
        countBySegment[g.segment] = g._count.id;
    }

    return SEGMENT_ORDER.map((key) => ({
        segment: key,
        label: key.charAt(0) + key.slice(1).toLowerCase(),
        count: countBySegment[key] ?? 0,
    }));
}

export interface ListCustomersQuery {
    page: number;
    limit: number;
    search?: unknown;
    segment?: unknown;
}

/** Paginated customer list with search + segment filter. */
export async function listCustomers({ page, limit, search, segment }: ListCustomersQuery) {
    const where: Record<string, unknown> = {};

    if (segment && SEGMENT_ORDER.includes(segment as string)) {
        where.segment = segment;
    }

    if (search) {
        const term = String(search).trim();
        if (term) {
            where.OR = [
                { name: { contains: term } },
                { phone: { contains: term } },
                { email: { contains: term } },
            ];
        }
    }

    const [total, customers] = await Promise.all([
        prisma.customerProfile.count({ where }),
        prisma.customerProfile.findMany({
            where,
            orderBy: { lastOrderAt: { sort: 'desc', nulls: 'last' } },
            skip: (page - 1) * limit,
            take: limit,
        }),
    ]);

    return {
        customers: customers.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            governorate: c.governorate,
            segment: c.segment,
            totalOrders: c.totalOrders,
            totalSpent: formatDecimal(c.totalSpent),
            lastOrderAt: c.lastOrderAt,
            createdAt: c.createdAt,
        })),
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

/**
 * Full customer record: profile + recent order history + notes.
 * Null when the customer doesn't exist.
 */
export async function getCustomerDetail(customerId: string) {
    const customer = await prisma.customerProfile.findUnique({
        where: { id: customerId },
        include: {
            notes: {
                orderBy: { createdAt: 'desc' },
                take: 50,
                include: { admin: { select: { id: true, firstName: true, lastName: true } } },
            },
        },
    });

    if (!customer) return null;

    const orders = await prisma.order.findMany({
        where: { customerPhoneNumber: customer.phone },
        select: {
            id: true,
            orderNumber: true,
            totalPrice: true,
            totalDiscount: true,
            shippingCost: true,
            createdAt: true,
            isRewardSent: true,
            status: { select: { statusName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });

    return {
        customer: {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            governorate: customer.governorate,
            address: customer.address,
            tags: customer.tags,
            segment: customer.segment,
            totalOrders: customer.totalOrders,
            totalSpent: formatDecimal(customer.totalSpent),
            lastOrderAt: customer.lastOrderAt,
            createdAt: customer.createdAt,
        },
        orders: orders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            totalPrice: formatDecimal(o.totalPrice),
            totalDiscount: formatDecimal(o.totalDiscount),
            shippingCost: formatDecimal(o.shippingCost),
            createdAt: o.createdAt,
            statusName: o.status.statusName,
            isRewardSent: o.isRewardSent,
        })),
        notes: customer.notes.map((n) => ({
            id: n.id,
            note: n.note,
            createdAt: n.createdAt,
            author: n.admin ? `${n.admin.firstName} ${n.admin.lastName}`.trim() : 'System',
            authorId: n.adminId,
        })),
    };
}

export interface UpdateCustomerInput {
    name?: unknown;
    email?: unknown;
    governorate?: unknown;
    address?: unknown;
    tags?: unknown;
    segment?: unknown;
}

/** Update customer profile fields (whitelisted, trimmed). */
export async function updateCustomerProfile(customerId: string, input: UpdateCustomerInput) {
    const { name, email, governorate, address, tags, segment } = input;

    const data: Record<string, unknown> = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (email === null || (typeof email === 'string' && email.trim())) data.email = email || null;
    if (governorate === null || (typeof governorate === 'string' && governorate.trim())) data.governorate = governorate || null;
    if (address === null || (typeof address === 'string' && address.trim())) data.address = address || null;
    if (Array.isArray(tags)) data.tags = tags.slice(0, 20);
    if (segment && SEGMENT_ORDER.includes(segment as string)) data.segment = segment;

    const customer = await prisma.customerProfile.update({
        where: { id: customerId },
        data,
    });

    return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        governorate: customer.governorate,
        address: customer.address,
        tags: customer.tags,
        segment: customer.segment,
        totalOrders: customer.totalOrders,
        totalSpent: formatDecimal(customer.totalSpent),
        lastOrderAt: customer.lastOrderAt,
    };
}

/** Add an internal note to a customer. */
export async function addCustomerNote(customerId: string, note: string, adminId: string | undefined) {
    const created = await prisma.customerNote.create({
        data: { customerId, adminId: adminId ?? null, note: note.trim() },
        include: { admin: { select: { firstName: true, lastName: true } } },
    });

    return {
        id: created.id,
        note: created.note,
        createdAt: created.createdAt,
        author: created.admin ? `${created.admin.firstName} ${created.admin.lastName}`.trim() : 'System',
    };
}

/** Backfill / recompute profiles from past orders (single transaction). */
export async function backfillCustomerProfiles(adminId: string | undefined) {
    const written = await prisma.$transaction((tx) => rebuildCustomerProfiles(tx));

    await logAdminAction({
        adminId: adminId ?? '',
        actionType: AdminActionType.DISCOUNT_UPDATE,
        targetResource: 'CRM',
        targetId: undefined,
        details: { action: 'backfill', profiles: written },
    });

    return { success: true, profilesSynced: written };
}