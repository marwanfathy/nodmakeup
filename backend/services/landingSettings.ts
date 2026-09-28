// Landing layout — reading the settings out of a row's JSON `config` column.
//
// One definition, because the public read and the admin read have to agree on it.
// They did not, once: each had its own copy, and a value one accepted while the
// other dropped it would mean the admin form offers a choice the storefront
// silently discards — the section renders one way, the form says another, and
// nothing reports the difference.
import { Prisma } from '@prisma/client';
import { isModeFor, SECTION_SLUG_RE } from '@nod/shared/dist/landing/sections';
import type { LandingSectionSetting } from '@nod/shared/dist/api/types';

/** The settings a stored row can override, by omission rather than by value. */
export type StoredLandingSettings = Partial<Pick<LandingSectionSetting, 'heroMode' | 'heroSlug'>>;

/**
 * Every state the `config` column can hold, in either direction.
 *
 * Wider than `JsonValue | null` on purpose: Prisma's own "no JSON here" sentinels
 * are what a write stores, and `InputJsonValue` is what it stores alongside them,
 * so this covers the column as the read sees it and as the write sees it. The
 * sentinels carry no settings — the same answer as SQL NULL — which is what makes
 * a value that survives a write provably survive the read back.
 */
export type StoredConfigColumn =
    | Prisma.JsonValue
    | Prisma.InputJsonValue
    | Prisma.NullTypes.DbNull
    | Prisma.NullTypes.JsonNull
    | null;

/**
 * The stored settings, validated, as an override of the registry's defaults.
 *
 * The column is Json, so its shape is whatever a previous write left there — a
 * hand-edited row, a row written by an older version of this code, or a section
 * that has since gained settings. Every value is re-checked rather than trusted.
 *
 * An unusable value is OMITTED, never nulled. Callers spread the result over
 * `defaultSettingFor`, so an omitted key falls back to the registry default for
 * that field alone, while a null would overwrite the default with nothing: a
 * hero with no mode, and no slug for the one it has.
 *
 * `isModeFor` is what makes a stored mode safe to act on — a mode belonging to a
 * different section, or one dropped from the registry, is discarded here instead
 * of being rendered.
 */
export function readLandingConfig(
    config: StoredConfigColumn,
    key: string,
): StoredLandingSettings {
    const record =
        config !== null && typeof config === 'object' && !Array.isArray(config)
            ? (config as Record<string, unknown>)
            : {};
    const stored: StoredLandingSettings = {};

    if (typeof record.heroMode === 'string' && isModeFor(key, record.heroMode)) {
        stored.heroMode = record.heroMode;
    }
    if (typeof record.heroSlug === 'string' && SECTION_SLUG_RE.test(record.heroSlug)) {
        stored.heroSlug = record.heroSlug;
    }

    return stored;
}

/**
 * The JSON to persist for a section's settings, or `JsonNull` for none.
 *
 * Keys the payload did not mention are not written, so a section that never has
 * settings stored gets SQL NULL rather than an empty object that would still have
 * to be re-validated on every read.
 */
export function landingConfigToStore(input: {
    heroMode?: string;
    heroSlug?: string;
}): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (input.heroMode === undefined && input.heroSlug === undefined) {
        return Prisma.JsonNull;
    }
    return {
        ...(input.heroMode !== undefined ? { heroMode: input.heroMode } : {}),
        ...(input.heroSlug !== undefined ? { heroSlug: input.heroSlug } : {}),
    };
}
