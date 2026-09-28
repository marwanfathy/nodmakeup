// Landing layout settings — reading and writing the JSON `config` column.
//
// Pure unit tests: the prisma import is type-only here, so no connection is made.
import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { landingConfigToStore, readLandingConfig } from './landingSettings';

describe('readLandingConfig', () => {
    it('returns nothing for a row with no stored settings', () => {
        expect(readLandingConfig(null, 'hero')).toEqual({});
    });

    it('keeps a valid hero mode and slug', () => {
        expect(readLandingConfig({ heroMode: 'slides', heroSlug: 'summer-drop' }, 'hero')).toEqual({
            heroMode: 'slides',
            heroSlug: 'summer-drop',
        });
    });

    it('keeps the default slug when only the mode was saved', () => {
        // The whole reason unusable values are omitted rather than nulled: a null
        // spread over the defaults would leave the hero with no slug at all.
        expect(readLandingConfig({ heroMode: 'slides' }, 'hero')).toEqual({ heroMode: 'slides' });
    });

    it('omits a mode belonging to a different section', () => {
        // `products` is the hero's, not the collections'; nothing else declares
        // modes, so a mode on any other section is not renderable and is dropped.
        expect(readLandingConfig({ heroMode: 'slides' }, 'collections')).toEqual({});
    });

    it('omits a mode that is no longer in the registry', () => {
        expect(readLandingConfig({ heroMode: 'carousel' }, 'hero')).toEqual({});
    });

    it('omits a non-string mode', () => {
        expect(readLandingConfig({ heroMode: 7 }, 'hero')).toEqual({});
        expect(readLandingConfig({ heroMode: ['slides'] }, 'hero')).toEqual({});
    });

    it.each([
        ['upper case', 'Summer'],
        ['a leading dash', '-home'],
        ['a trailing dash', 'home-'],
        ['a double dash', 'sum--drop'],
        ['an underscore', 'summer_drop'],
        ['a slash', 'summer/drop'],
        ['a dot', 'summer.drop'],
        ['a percent escape', '%2e%2e'],
        ['whitespace', 'summer drop'],
        ['empty', ''],
    ])('omits a slug that is %s', (_label, slug) => {
        // The slug is interpolated into a request path, so anything that could
        // escape the path is rejected rather than normalised.
        expect(readLandingConfig({ heroSlug: slug }, 'hero')).toEqual({});
    });

    it('accepts a single-word slug and one with separators', () => {
        expect(readLandingConfig({ heroSlug: 'home' }, 'hero')).toEqual({ heroSlug: 'home' });
        expect(readLandingConfig({ heroSlug: 'a-1-b2' }, 'hero')).toEqual({ heroSlug: 'a-1-b2' });
    });

    it.each([
        ['an array', ['heroMode', 'slides']],
        ['a bare string', 'slides'],
        ['a number', 42],
    ])('treats %s as no settings rather than reading properties off it', (_label, config) => {
        expect(readLandingConfig(config, 'hero')).toEqual({});
    });

    it('treats Prisma\'s no-JSON sentinels as no settings', () => {
        // These are what a write stores for "nothing here", and the reader has to
        // accept them — it is handed the column, not a pre-checked value.
        expect(readLandingConfig(Prisma.JsonNull, 'hero')).toEqual({});
        expect(readLandingConfig(Prisma.DbNull, 'hero')).toEqual({});
    });

    it('keeps a valid slug on a section that has no modes', () => {
        // The slug is validated by shape, not by whether the section uses it, so a
        // stray one is dropped on the public read's own terms rather than being
        // special-cased here.
        expect(readLandingConfig({ heroSlug: 'summer-drop' }, 'benefits')).toEqual({
            heroSlug: 'summer-drop',
        });
    });
});

describe('landingConfigToStore', () => {
    it('writes SQL NULL when the section carries no settings', () => {
        // An empty object would read back as "no overrides" too, but it is a
        // different thing to look at in the database and to re-validate forever.
        expect(landingConfigToStore({})).toBe(Prisma.JsonNull);
    });

    it('stores only the fields the payload actually carries', () => {
        expect(landingConfigToStore({ heroSlug: 'summer-drop' })).toEqual({
            heroSlug: 'summer-drop',
        });
    });

    it('stores both fields when both are given', () => {
        expect(landingConfigToStore({ heroMode: 'slides', heroSlug: 'summer-drop' })).toEqual({
            heroMode: 'slides',
            heroSlug: 'summer-drop',
        });
    });

    it('stores a value that the reader will accept', () => {
        // Store and read are the same rule from both ends: nothing can be written
        // that cannot come back.
        const written = landingConfigToStore({ heroMode: 'slides', heroSlug: 'summer-drop' });
        expect(readLandingConfig(written, 'hero')).toEqual({
            heroMode: 'slides',
            heroSlug: 'summer-drop',
        });
    });
});
