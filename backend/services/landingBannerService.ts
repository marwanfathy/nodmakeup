// Landing banner service — the public read: the active banner, if there is one.
import prisma from '../config/prismaClient';
import { Prisma } from '@prisma/client';

// Every string comes back in both languages so the storefront can resolve the
// Arabic twin per field at render time, the same way it does for
// Product.nameAr. Resolving here instead would mean a second, differently
// shaped response per locale, and the storefront already has to branch on
// locale for every other bilingual entity.
//
// Only what the storefront renders: no timestamps, no isActive. This payload is
// inlined into the server component's RSC props, so a column nothing reads is
// bytes sent to every visitor for nothing.
const PUBLIC_SELECT = {
    id: true,
    imageUrl: true,
    imageAlt: true,
    tagline: true,
    taglineAr: true,
    title: true,
    titleAr: true,
    ctaLabel: true,
    ctaLabelAr: true,
    ctaUrl: true,
} satisfies Prisma.LandingBannerSelect;

export type PublicLandingBanner = Prisma.LandingBannerGetPayload<{
    select: typeof PUBLIC_SELECT;
}>;

/**
 * The live banner, or null when there is none or it is switched off.
 *
 * The banner is a singleton slot, so `findFirst` is enough. The orderBy is
 * there to make the answer deterministic if a second row ever appears: the
 * most recently edited active banner wins, rather than an arbitrary row
 * depending on storage order.
 */
export async function getActiveLandingBanner(): Promise<PublicLandingBanner | null> {
    return prisma.landingBanner.findFirst({
        where: { isActive: true },
        select: PUBLIC_SELECT,
        orderBy: { updatedAt: 'desc' },
    });
}
