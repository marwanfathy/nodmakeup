// Landing banner service — admin side: read the slot for editing, save into it.
//
// The banner is a singleton: there is no list, no ordering and no create-then-
// pick flow. "Saving" means "write the slot", whether or not a row exists yet,
// which is why this exposes an upsert rather than the create/update pair the
// multi-row entities use. Validation of every field happens upstream in
// upsertLandingBannerSchema (shared/src/schemas), applied by middleware/validate,
// so this layer trusts its input shape and only does persistence.
import prisma from '../config/prismaClient';
import { Prisma } from '@prisma/client';
import type { UpsertLandingBannerInput } from '@nod/shared/dist/schemas';

// The full row, including the fields the public read leaves out, so the admin
// form round-trips every value it is given.
const ADMIN_SELECT = {
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
    isActive: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.LandingBannerSelect;

export type AdminLandingBanner = Prisma.LandingBannerGetPayload<{
    select: typeof ADMIN_SELECT;
}>;

/**
 * The banner row for the edit form, whether or not it is currently live.
 *
 * A public caller asking for this gets null, because the public route answers
 * that separately and only for an active row — the admin form must be able to
 * load a switched-off banner so the operator can edit and re-enable it.
 */
export async function getLandingBannerForAdmin(): Promise<AdminLandingBanner | null> {
    return prisma.landingBanner.findFirst({ select: ADMIN_SELECT, orderBy: { updatedAt: 'desc' } });
}

/** Write the slot: update the existing row, or create the first one. */
export async function upsertLandingBanner(
    input: UpsertLandingBannerInput,
): Promise<AdminLandingBanner> {
    const data = {
        imageUrl: input.imageUrl,
        // The schema turns a blank optional field into undefined, so clearing
        // an Arabic twin in the form is an explicit null rather than "".
        imageAlt: input.imageAlt ?? null,
        tagline: input.tagline,
        taglineAr: input.taglineAr ?? null,
        title: input.title,
        titleAr: input.titleAr ?? null,
        ctaLabel: input.ctaLabel,
        ctaLabelAr: input.ctaLabelAr ?? null,
        ctaUrl: input.ctaUrl,
        isActive: input.isActive,
    };

    const existing = await prisma.landingBanner.findFirst({
        select: { id: true },
        orderBy: { updatedAt: 'desc' },
    });

    if (!existing) {
        return prisma.landingBanner.create({ data, select: ADMIN_SELECT });
    }

    return prisma.landingBanner.update({
        where: { id: existing.id },
        data,
        select: ADMIN_SELECT,
    });
}
