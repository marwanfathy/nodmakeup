// Landing layout — the admin read and write.
//
// The rules pinned here are the ones an operator would notice as data loss: a
// section that comes back on when it was switched off, a saved position thrown
// away by a save that did not mention it, and a row for a section that is no
// longer registered. Prisma is mocked, so these stay pure unit tests.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { LANDING_SECTIONS } from '@nod/shared/dist/landing/sections';
import type { UpsertLandingLayoutInput } from '@nod/shared/dist/schemas';
import { getLandingLayoutForAdmin, upsertLandingLayout } from './adminLandingLayoutService';

const db = vi.hoisted(() => ({
    rows: [] as unknown[],
    findMany: vi.fn(),
    upsert: vi.fn(),
    transaction: vi.fn(),
}));

vi.mock('../config/prismaClient', () => ({
    default: {
        landingSection: { findMany: db.findMany, upsert: db.upsert },
        $transaction: db.transaction,
    },
}));

/** A stored row, with only the fields the service selects. */
const row = (
    key: string,
    displayOrder: number,
    isEnabled = true,
    config: unknown = null,
) => ({ id: `id-${key}`, key, displayOrder, isEnabled, config });

const keysOf = async () => (await getLandingLayoutForAdmin()).map((s) => s.key);
const entryOf = async (key: string) => (await getLandingLayoutForAdmin()).find((s) => s.key === key);

beforeEach(() => {
    db.rows = [];
    db.findMany.mockReset();
    db.findMany.mockImplementation(async () => db.rows);
    db.upsert.mockReset();
    // A faithful stand-in for upsert: replace the row with this key, or insert it.
    // Without that, a save would not be visible to the read-back, and the tests
    // about "what a reload would show" would be testing the mock instead.
    db.upsert.mockImplementation(async (args: { where: { key: string }; create: object }) => {
        const index = db.rows.findIndex((r) => (r as { key: string }).key === args.where.key);
        const stored = { ...args.create, id: `id-${args.where.key}` };
        if (index === -1) db.rows.push(stored);
        else db.rows[index] = stored;
        return stored;
    });
    db.transaction.mockReset();
    db.transaction.mockImplementation(async (writes: unknown[]) => Promise.all(writes));
});

describe('getLandingLayoutForAdmin', () => {
    it('lists every registered section in registry order with no rows at all', async () => {
        expect(await keysOf()).toEqual(LANDING_SECTIONS.map((s) => s.key));
    });

    it('marks a section that exists only in the registry as unsaved', async () => {
        const list = await getLandingLayoutForAdmin();
        expect(list.every((s) => s.isUnsaved)).toBe(true);
        expect(list.every((s) => s.isRegistered)).toBe(true);
    });

    it('labels every section in both languages', async () => {
        // The admin form shows both, so a new section must arrive with an Arabic
        // name — there is nowhere else for one to come from.
        for (const meta of LANDING_SECTIONS) {
            const entry = await entryOf(meta.key);
            expect(entry?.labelEn).toBe(meta.labelEn);
            expect(entry?.labelAr).toBe(meta.labelAr);
        }
    });

    it('carries a hint for every section', async () => {
        const list = await getLandingLayoutForAdmin();
        expect(list.every((s) => s.hintEn.length > 0)).toBe(true);
    });

    it('marks a section that has a row as saved', async () => {
        db.rows = [row('hero', 0)];
        const hero = await entryOf('hero');
        expect(hero?.isUnsaved).toBe(false);
        expect((await entryOf('stories'))?.isUnsaved).toBe(true);
    });

    it('keeps a section off once the operator has switched it off', async () => {
        // The defaults object carries isEnabled:true, so a spread in the wrong
        // order here would silently switch every saved-off section back on.
        db.rows = [row('hero', 2, false)];
        expect((await entryOf('hero'))?.isEnabled).toBe(false);
    });

    it('applies the saved order', async () => {
        db.rows = [row('benefits', 0), row('hero', 1), row('stories', 2), row('banner', 3), row('collections', 4)];
        expect(await keysOf()).toEqual(['benefits', 'hero', 'stories', 'banner', 'collections']);
    });

    it('returns a saved hero mode and slug', async () => {
        db.rows = [row('hero', 0, true, { heroMode: 'slides', heroSlug: 'summer-drop' })];
        expect((await entryOf('hero'))?.heroMode).toBe('slides');
        expect((await entryOf('hero'))?.heroSlug).toBe('summer-drop');
    });

    it('shows the registry default for a hero that was never saved', async () => {
        expect((await entryOf('hero'))?.heroMode).toBe('products');
        expect((await entryOf('hero'))?.heroSlug).toBe('home');
    });

    it('shows a section with no modes as having none', async () => {
        const stories = await entryOf('stories');
        expect(stories?.heroMode).toBeNull();
        expect(stories?.heroSlug).toBeNull();
    });

    it('discards an unusable stored value rather than showing it in the form', async () => {
        // The form must not offer a choice the next public read would drop.
        db.rows = [row('hero', 0, true, { heroMode: 'carousel', heroSlug: 'Summer Drop' })];
        expect((await entryOf('hero'))?.heroMode).toBe('products');
        expect((await entryOf('hero'))?.heroSlug).toBe('home');
    });

    it('reports a row for an unregistered section instead of deleting it', async () => {
        // Deleting on read would quietly discard a saved position, and
        // re-registering the section later should bring that position back.
        db.rows = [row('trustBadges', 0, true, { heroMode: 'slides' })];
        const list = await getLandingLayoutForAdmin();
        const orphan = list.find((s) => s.key === 'trustBadges');
        expect(orphan?.isRegistered).toBe(false);
        expect(orphan?.isUnsaved).toBe(false);
        expect(orphan?.hintEn).toContain('no longer registered');
    });

    it('keeps every unregistered row', async () => {
        db.rows = [row('trustBadges', 0), row('oldPromo', 1, false)];
        expect(await keysOf()).toContain('trustBadges');
        expect(await keysOf()).toContain('oldPromo');
    });

    it('shows an unregistered row with no settings, since it has no defaults', async () => {
        db.rows = [row('trustBadges', 0, true, { heroMode: 'slides' })];
        const orphan = (await getLandingLayoutForAdmin()).find((s) => s.key === 'trustBadges');
        expect(orphan?.heroMode).toBeNull();
        expect(orphan?.heroSlug).toBeNull();
    });

    it('sorts unregistered rows after registered ones at the same position', async () => {
        // stories and hero both land on 0 — stories by registry fallback, hero by
        // its row — and the orphan shares that 0. Registered first, so the orphan
        // is visible at the end rather than interleaved with real sections.
        db.rows = [row('trustBadges', 0), row('hero', 0)];
        expect(await keysOf()).toEqual(['stories', 'hero', 'trustBadges', 'banner', 'collections', 'benefits']);
    });

    it('still honours the saved order of an unregistered row', async () => {
        db.rows = [row('trustBadges', 0), row('hero', 1), row('stories', 2), row('banner', 3), row('collections', 4), row('benefits', 5)];
        expect((await keysOf())[0]).toBe('trustBadges');
    });

    it('always includes every registered section, saved or not', async () => {
        // This is what makes a newly registered component appear in the admin
        // list with no admin-panel change: the list is built from the registry.
        db.rows = [row('hero', 0, false)];
        const list = await getLandingLayoutForAdmin();
        expect(list).toHaveLength(LANDING_SECTIONS.length);
        expect(list.filter((s) => s.isRegistered)).toHaveLength(LANDING_SECTIONS.length);
    });
});

describe('upsertLandingLayout', () => {
    const input = (sections: UpsertLandingLayoutInput['sections']): UpsertLandingLayoutInput => ({
        sections,
    });

    it('stores the payload order as the display order', async () => {
        await upsertLandingLayout(
            input([
                { key: 'benefits', isEnabled: true },
                { key: 'hero', isEnabled: true },
                { key: 'stories', isEnabled: true },
                { key: 'banner', isEnabled: true },
                { key: 'collections', isEnabled: true },
            ]),
        );
        const storedOrders = db.upsert.mock.calls.map((call) => {
            const arg = call[0] as { create: { displayOrder: number } };
            return arg.create.displayOrder;
        });
        expect(storedOrders).toEqual([0, 1, 2, 3, 4]);
    });

    it('writes a section the operator switched off as off', async () => {
        await upsertLandingLayout(input([{ key: 'hero', isEnabled: false }]));
        expect(db.upsert.mock.calls[0]?.[0]).toMatchObject({
            create: { key: 'hero', isEnabled: false },
        });
    });

    it('stores SQL NULL for a section with no settings', async () => {
        await upsertLandingLayout(input([{ key: 'stories', isEnabled: true }]));
        expect(db.upsert.mock.calls[0]?.[0].create.config).toBe(Prisma.JsonNull);
    });

    it('stores only the settings the payload carried', async () => {
        await upsertLandingLayout(
            input([{ key: 'hero', isEnabled: true, heroMode: 'slides' }]),
        );
        expect(db.upsert.mock.calls[0]?.[0].create.config).toEqual({ heroMode: 'slides' });
    });

    it('writes every section in one transaction', async () => {
        // A half-written layout is a page with a section missing and no way for
        // the operator to tell that is what they saved.
        await upsertLandingLayout(
            input([
                { key: 'hero', isEnabled: true },
                { key: 'stories', isEnabled: true },
            ]),
        );
        expect(db.transaction).toHaveBeenCalledTimes(1);
        expect(db.transaction.mock.calls[0]?.[0]).toHaveLength(2);
    });

    it('upserts by key rather than deleting rows the payload omits', async () => {
        // That is what lets a section be re-registered later and keep its position.
        await upsertLandingLayout(input([{ key: 'hero', isEnabled: true }]));
        expect(db.upsert.mock.calls[0]?.[0].where).toEqual({ key: 'hero' });
        expect(db.upsert).toHaveBeenCalledTimes(1);
    });

    it('returns what a reload would show, not the request echoed back', async () => {
        // Read through the same projection the GET uses, so a save cannot report a
        // layout the next read would disagree with.
        db.rows = [
            row('hero', 0, true, { heroMode: 'slides', heroSlug: 'summer-drop' }),
            row('stories', 1),
            row('banner', 2),
            row('collections', 3),
            row('benefits', 4),
        ];
        const saved = await upsertLandingLayout(input([{ key: 'hero', isEnabled: true, heroMode: 'slides', heroSlug: 'summer-drop' }]));
        expect(saved).toEqual(await getLandingLayoutForAdmin());
        expect((await entryOf('hero'))?.isUnsaved).toBe(false);
    });

    it('returns the registry rows a partial save did not mention', async () => {
        const saved = await upsertLandingLayout(input([{ key: 'hero', isEnabled: false }]));
        expect(saved).toHaveLength(LANDING_SECTIONS.length);
        expect(saved.filter((s) => s.isUnsaved)).toHaveLength(LANDING_SECTIONS.length - 1);
    });
});
