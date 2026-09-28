// Landing layout — the public read.
//
// The ordering rules are the part worth pinning: they decide what the storefront
// renders, and a mistake here is a page in the wrong order rather than an error.
// Prisma is mocked, so these stay pure unit tests.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SECTION_ORDER, LANDING_SECTIONS } from '@nod/shared/dist/landing/sections';
import { getActiveLandingLayout } from './landingLayoutService';

const db = vi.hoisted(() => ({
    rows: [] as unknown[],
    findMany: vi.fn(),
}));

vi.mock('../config/prismaClient', () => ({
    default: { landingSection: { findMany: db.findMany } },
}));

/** A stored row, with only the fields the service selects. */
const row = (
    key: string,
    displayOrder: number,
    isEnabled = true,
    config: unknown = null,
) => ({ key, displayOrder, isEnabled, config });

/** The keys the storefront would render, in order. */
const keysOf = async () => (await getActiveLandingLayout()).map((s) => s.key);

/** One section's resolved setting, found by key rather than by position. */
const settingOf = async (key: string) =>
    (await getActiveLandingLayout()).find((s) => s.key === key);

beforeEach(() => {
    db.rows = [];
    db.findMany.mockReset();
    db.findMany.mockImplementation(async () => db.rows);
});

describe('getActiveLandingLayout', () => {
    it('lists every registered section, in registry order, with no rows at all', async () => {
        // A layout that has never been saved has to resolve to today's page, not to
        // an empty one — that is why the registry is the base and not the data.
        expect(await keysOf()).toEqual([...DEFAULT_SECTION_ORDER]);
        expect(await keysOf()).toHaveLength(LANDING_SECTIONS.length);
    });

    it('returns the default setting for a section that was never saved', async () => {
        expect(await settingOf('hero')).toEqual({
            key: 'hero',
            isEnabled: true,
            heroMode: 'products',
            heroSlug: 'home',
        });
    });

    it('leaves a section with no modes null rather than inventing values', async () => {
        expect(await settingOf('stories')).toEqual({
            key: 'stories',
            isEnabled: true,
            heroMode: null,
            heroSlug: null,
        });
    });

    it('applies the saved order', async () => {
        db.rows = [row('hero', 0), row('stories', 1), row('collections', 2), row('benefits', 3), row('banner', 4)];
        expect(await keysOf()).toEqual(['hero', 'stories', 'collections', 'benefits', 'banner']);
    });

    it('omits a section the operator switched off', async () => {
        db.rows = [
            row('stories', 0),
            row('banner', 1),
            row('hero', 2, false),
            row('collections', 3),
            row('benefits', 4),
        ];
        expect(await keysOf()).toEqual(['stories', 'banner', 'collections', 'benefits']);
    });

    it('falls back to the registry position for a section with no row', async () => {
        // A half-saved layout: only the hero was ever stored. The other four have
        // no row, so they keep the positions the registry gave them.
        db.rows = [row('hero', 2)];
        expect(await keysOf()).toEqual(['stories', 'banner', 'hero', 'collections', 'benefits']);
    });

    it('breaks a displayOrder tie on registry position', async () => {
        // Every row is present so nothing falls back: benefits was given the same
        // order as stories, and registry position has to put stories first. Without
        // the tie-break the two could swap between requests and the page would
        // quietly reorder itself on a reload.
        db.rows = [
            row('stories', 1),
            row('banner', 2),
            row('hero', 3),
            row('collections', 4),
            row('benefits', 1),
        ];
        expect(await keysOf()).toEqual(['stories', 'benefits', 'banner', 'hero', 'collections']);
    });

    it('does not care what order the database returned the rows in', async () => {
        // findMany is unordered, so the sort — not MySQL — is what makes the page
        // deterministic. Both reads below describe the same layout.
        db.rows = [row('hero', 0), row('stories', 1), row('banner', 2), row('collections', 3), row('benefits', 4)];
        const forward = await keysOf();
        db.rows = [...db.rows].reverse();
        expect(await keysOf()).toEqual(forward);
    });

    it('is stable across repeated reads of a half-saved layout', async () => {
        db.rows = [row('collections', 0), row('hero', 0)];
        const first = await keysOf();
        const second = await keysOf();
        expect(second).toEqual(first);
    });

    it('applies a saved hero mode and slug', async () => {
        db.rows = [
            row('hero', 0, true, { heroMode: 'slides', heroSlug: 'summer-drop' }),
            row('stories', 1),
            row('banner', 2),
            row('collections', 3),
            row('benefits', 4),
        ];
        expect(await settingOf('hero')).toEqual({
            key: 'hero',
            isEnabled: true,
            heroMode: 'slides',
            heroSlug: 'summer-drop',
        });
    });

    it('keeps the default slug when a row saved a mode but no slug', async () => {
        db.rows = [row('hero', 0, true, { heroMode: 'slides' })];
        expect((await settingOf('hero'))?.heroSlug).toBe('home');
    });

    it('falls back to the default mode for an unusable stored mode', async () => {
        db.rows = [row('hero', 0, true, { heroMode: 'carousel' })];
        expect((await settingOf('hero'))?.heroMode).toBe('products');
    });

    it('falls back to the default slug for an unusable stored slug', async () => {
        db.rows = [row('hero', 0, true, { heroSlug: '../etc/passwd' })];
        expect((await settingOf('hero'))?.heroSlug).toBe('home');
    });

    it('survives a row whose config is the wrong shape entirely', async () => {
        db.rows = [row('hero', 0, true, ['heroMode', 'slides'])];
        expect(await settingOf('hero')).toEqual({
            key: 'hero',
            isEnabled: true,
            heroMode: 'products',
            heroSlug: 'home',
        });
    });

    it('ignores a row for a section that is no longer registered', async () => {
        // Unregistered rows are the admin read's business; the storefront has no
        // renderer for them, so letting one in would break the page.
        db.rows = [row('trustBadges', 0, true, { heroMode: 'slides' })];
        expect(await keysOf()).toEqual([...DEFAULT_SECTION_ORDER]);
    });

    it('selects only what the public payload needs', async () => {
        await getActiveLandingLayout();
        // The layout is inlined into the server component's RSC props, so a
        // selected column nothing reads is bytes sent to every visitor.
        expect(db.findMany.mock.calls[0]?.[0]).toEqual({
            select: { key: true, displayOrder: true, isEnabled: true, config: true },
        });
    });
});
