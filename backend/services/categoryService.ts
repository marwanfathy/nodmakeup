// Category service — public (active) category navigation surface.
import prisma from '../config/prismaClient';

export interface PublicCategory {
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
}

export async function getPublicCategories(): Promise<PublicCategory[]> {
    const categories = await prisma.category.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true, imageUrl: true },
        orderBy: { name: 'asc' },
    });

    return categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        imageUrl: category.imageUrl,
    }));
}