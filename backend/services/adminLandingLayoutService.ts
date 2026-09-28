// Landing layout service — admin side: read the layout for editing, save it back.
//
// The registry decides which sections EXIST; this layer decides what the operator
// has said about them. So the admin read is registry-first: it returns every
// registered section even with no database row, which is what makes a newly
// registered component appear in the admin list with no admin-panel change.
//
// Rows whose key is no longer registered are returned too, flagged, rather than
// dropped. Deleting them on read would quietly discard a saved position, and
// re-registering the section later should bring that position back.
import prisma from '../config/prismaClient';
import { Prisma } from '@prisma/client';
import {
    defaultSettingFor,
    isLandingSectionKey,
    LANDING_SECTIONS,
} from '@nod/shared/dist/landing/sections';
import type { UpsertLandingLayoutInput } from '@nod/shared/dist/schemas';
import { landingConfigToStore, readLandingConfig } from './landingSettings';

const ADMIN_SELECT = {
    id: true,
    key: true,
    displayOrder: true,
    isEnabled: true,
    config: true,
} satisfies Prisma.LandingSectionSelect;

type AdminRow = Prisma.LandingSectionGetPayload<{ select: typeof ADMIN_SELECT }>;

/** One row of the admin layout list. */
export interface AdminLandingSection {
    key: string;
    labelEn: string;
    labelAr: string;
    hintEn: string;
    displayOrder: number;
    isEnabled: boolean;
    /** Present only for a section that declares modes. */
    heroMode: string | null;
    heroSlug: string | null;
    /** False when the row names a key the registry no longer knows. */
    isRegistered: boolean;
    /** True when this section exists only because the registry lists it. */
    isUnsaved: boolean;
}

/**
 * The full layout as the admin should see it: every registered section, in the
 * order the storefront will use, plus any leftover unregistered rows at the end.
 */
export async function getLandingLayoutForAdmin(): Promise<AdminLandingSection[]> {
    const rows = await prisma.landingSection.findMany({ select: ADMIN_SELECT });
    const byKey = new Map(rows.map((row) => [row.key, row]));

    const registered = LANDING_SECTIONS.map((meta, registryIndex) => {
        const row = byKey.get(meta.key);
        return {
            // Defaults first, then the row on top. The order matters in both
            // directions: the default object carries key and isEnabled:true, so
            // spreading it after the row would silently switch every saved-off
            // section back on, and a later `key` here would be flagged as
            // overwriting the one the spread already set.
            ...defaultSettingFor(meta.key),
            key: meta.key,
            labelEn: meta.labelEn,
            labelAr: meta.labelAr,
            hintEn: meta.hintEn,
            displayOrder: row?.displayOrder ?? registryIndex,
            isEnabled: row?.isEnabled ?? true,
            ...readLandingConfig(row?.config ?? null, meta.key),
            isRegistered: true,
            isUnsaved: row === undefined,
        } satisfies AdminLandingSection;
    });

    const orphans = rows
        .filter((row) => !isLandingSectionKey(row.key))
        .map((row) => ({
            key: row.key,
            labelEn: row.key,
            labelAr: row.key,
            hintEn: 'Saved for a section that is no longer registered. The storefront ignores it.',
            displayOrder: row.displayOrder,
            isEnabled: row.isEnabled,
            // An unregistered key has no registry defaults, so there is nothing to
            // merge — its stored settings are shown as-is, and null where absent.
            heroMode: null,
            heroSlug: null,
            isRegistered: false,
            isUnsaved: false,
        }) satisfies AdminLandingSection);

    return [...registered, ...orphans].sort(
        (a, b) => a.displayOrder - b.displayOrder || Number(b.isRegistered) - Number(a.isRegistered),
    );
}

/**
 * Write the whole layout.
 *
 * One transaction, because a half-written layout is a page with a section
 * missing and no way for the operator to tell that is what they saved. Upsert by
 * key rather than delete-then-insert so rows the payload omits survive — that is
 * what lets a section be re-registered later and keep its position.
 *
 * Validation of the shape has already happened in upsertLandingLayoutSchema
 * (shared/src/schemas), applied by the route's validate() middleware, so this
 * layer trusts its input and only persists.
 */
export async function upsertLandingLayout(input: UpsertLandingLayoutInput): Promise<AdminLandingSection[]> {
    const writes = input.sections.map((section, displayOrder) => {
        const config = landingConfigToStore(section);

        return prisma.landingSection.upsert({
            where: { key: section.key },
            create: { key: section.key, displayOrder, isEnabled: section.isEnabled, config },
            update: { displayOrder, isEnabled: section.isEnabled, config },
        });
    });

    await prisma.$transaction(writes);

    // Read back through the same projection the GET uses, so a save returns
    // exactly what a reload would show rather than echoing the request.
    return getLandingLayoutForAdmin();
}
