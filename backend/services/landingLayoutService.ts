// Landing layout service — the public read: which sections the storefront should
// render, in what order, and with which settings.
import prisma from '../config/prismaClient';
import { Prisma } from '@prisma/client';
import { defaultSettingFor, LANDING_SECTIONS } from '@nod/shared/dist/landing/sections';
import type { LandingSectionSetting } from '@nod/shared/dist/api/types';
import { readLandingConfig } from './landingSettings';

// Position, visibility and settings. No timestamps: this payload is inlined into
// the server component's RSC props, so a column nothing reads is bytes sent to
// every visitor for nothing.
const PUBLIC_SELECT = {
    key: true,
    displayOrder: true,
    isEnabled: true,
    config: true,
} satisfies Prisma.LandingSectionSelect;

/**
 * The order and visibility the storefront should render.
 *
 * The registry is the base, not the database: every registered section appears
 * whether or not it has a row, so a layout that has never been saved resolves to
 * today's page instead of an empty one. A row only overrides what it actually
 * carries.
 *
 * Ordering rule: a row's displayOrder wins; a section with no row falls back to
 * its position in the registry. Ties break on registry position, which is what
 * keeps a half-saved layout deterministic — with only the hero row present, the
 * four untouched sections must not shuffle between requests.
 *
 * Only enabled sections are returned. "Hidden" is the admin's business, and
 * leaving disabled rows in the payload would mean every client re-implementing
 * the skip.
 */
export async function getActiveLandingLayout(): Promise<LandingSectionSetting[]> {
    const rows = await prisma.landingSection.findMany({ select: PUBLIC_SELECT });
    const byKey = new Map(rows.map((row) => [row.key, row]));

    const resolved = LANDING_SECTIONS.map((meta, registryIndex) => {
        const row = byKey.get(meta.key);
        return {
            setting: {
                ...defaultSettingFor(meta.key),
                ...readLandingConfig(row?.config ?? null, meta.key),
            },
            registryIndex,
            displayOrder: row?.displayOrder ?? registryIndex,
            isEnabled: row?.isEnabled ?? true,
        };
    });

    return resolved
        .sort((a, b) => a.displayOrder - b.displayOrder || a.registryIndex - b.registryIndex)
        .filter((entry) => entry.isEnabled)
        // isEnabled is a constant in this list — the filter above removed the
        // disabled ones — so the default's `true` is correct by construction
        // rather than by coincidence.
        .map((entry) => entry.setting);
}
