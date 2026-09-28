import { describe, it, expect } from 'vitest';
import { upsertLandingBannerSchema, upsertLandingLayoutSchema } from './index';
import { LANDING_SECTIONS } from '../landing/sections';

// The landing banner is a singleton the admin edits, and two of its fields are
// rendered by the storefront straight from operator input: the image becomes an
// <img src> and ctaUrl becomes an <Link href>. These tests pin the two rules
// that keep that safe, plus the length caps that match the DB columns — a
// value that passes Zod but overflows a VARCHAR(120) is a 500 from MySQL at
// save time, not a validation message in the form.
const valid = {
    imageUrl: 'uploads/banner/banner-raw-1.jpg',
    tagline: 'The lineup is here',
    taglineAr: 'التشكيلة وصلت',
    title: 'NOD x the night',
    titleAr: 'نود × الليلة',
    ctaLabel: 'Shop the collection',
    ctaLabelAr: 'تسوقي المجموعة',
    ctaUrl: '/shop',
    isActive: true,
};

describe('upsertLandingBannerSchema', () => {
    it('accepts the path shape the media server actually returns', () => {
        // media-server's relativeUrl() builds "uploads/<folder>/<file>" with no
        // leading slash, and the admin panel stores that verbatim. A schema that
        // demanded a leading slash here would reject every real upload.
        for (const imageUrl of [
            'uploads/banner/banner-raw-1712.jpg',
            '/uploads/banner/banner-raw-1712.jpg',
            'https://media.nodmakeup.com/uploads/banner/x.jpg',
            'http://localhost:5002/uploads/banner/x.jpg',
        ]) {
            const result = upsertLandingBannerSchema.safeParse({ ...valid, imageUrl });
            expect(result.success, `should accept ${imageUrl}`).toBe(true);
        }
    });

    it('rejects a non-http scheme in the image path', () => {
        // Guards stored XSS: this string reaches an <img src> unescaped.
        for (const imageUrl of [
            'javascript:alert(document.cookie)',
            'JavaScript:alert(1)',
            'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
            'vbscript:msgbox(1)',
        ]) {
            const result = upsertLandingBannerSchema.safeParse({ ...valid, imageUrl });
            expect(result.success, `should reject ${imageUrl}`).toBe(false);
        }
    });

    it('rejects a ctaUrl that is not a root-relative site path', () => {
        // An absolute or protocol-relative href turns an admin edit into an open
        // redirect, and javascript: into XSS on the storefront's own origin.
        for (const ctaUrl of [
            'https://evil.example/steal',
            '//evil.example/steal',
            'javascript:alert(1)',
            'shop',
        ]) {
            const result = upsertLandingBannerSchema.safeParse({ ...valid, ctaUrl });
            expect(result.success, `should reject ${ctaUrl}`).toBe(false);
        }
    });

    it('accepts a root-relative ctaUrl with a query or hash', () => {
        // A query string is allowed to contain a URL: the storefront has no
        // redirect-from-param sink, so "/shop?next=https://…" is just a query
        // on our own page, and an operator pasting a filtered shop link is the
        // normal case this has to allow.
        for (const ctaUrl of ['/shop', '/', '/product/some-slug', '/bestsellers?sort=price']) {
            const result = upsertLandingBannerSchema.safeParse({ ...valid, ctaUrl });
            expect(result.success, `should accept ${ctaUrl}`).toBe(true);
        }
    });

    it('treats a blank Arabic twin as absent so the storefront can fall back', () => {
        // The whole point of the optional twins: an English-only edit publishes
        // without six fields, and the banner falls back per string. "" must
        // collapse to undefined, or it would win over the real fallback.
        const result = upsertLandingBannerSchema.parse({
            ...valid,
            taglineAr: '',
            titleAr: '',
            ctaLabelAr: '',
        });
        expect(result.taglineAr).toBeUndefined();
        expect(result.titleAr).toBeUndefined();
        expect(result.ctaLabelAr).toBeUndefined();
    });

    it('trims surrounding whitespace on every text field', () => {
        const result = upsertLandingBannerSchema.parse({ ...valid, tagline: '  spaced  ' });
        expect(result.tagline).toBe('spaced');
    });

    it('rejects a required field left blank', () => {
        for (const field of ['tagline', 'title', 'ctaLabel', 'imageUrl']) {
            const result = upsertLandingBannerSchema.safeParse({ ...valid, [field]: '   ' });
            expect(result.success, `should reject blank ${field}`).toBe(false);
        }
    });

    it('caps each string at its column width', () => {
        // VARCHAR(120)/(60)/(255) in the schema.prisma columns. Over-length here
        // would pass validation and then fail as a MySQL truncation error.
        // ctaUrl is built as "/" + filler so it also satisfies the path rule.
        const cases: Array<[keyof typeof valid, number, (n: number) => string]> = [
            ['tagline', 120, (n) => 'x'.repeat(n)],
            ['title', 120, (n) => 'x'.repeat(n)],
            ['ctaLabel', 60, (n) => 'x'.repeat(n)],
            ['ctaUrl', 255, (n) => `/${'x'.repeat(n - 1)}`],
            ['imageUrl', 255, (n) => 'x'.repeat(n)],
        ];
        for (const [field, max, build] of cases) {
            const over = upsertLandingBannerSchema.safeParse({ ...valid, [field]: build(max + 1) });
            expect(over.success, `should reject ${field} over ${max}`).toBe(false);

            const atLimit = upsertLandingBannerSchema.safeParse({ ...valid, [field]: build(max) });
            expect(atLimit.success, `should accept ${field} at exactly ${max}`).toBe(true);
        }
    });

    it('requires isActive to be a real boolean, not a truthy string', () => {
        expect(upsertLandingBannerSchema.safeParse({ ...valid, isActive: 'false' }).success).toBe(false);
        expect(upsertLandingBannerSchema.safeParse({ ...valid, isActive: 'true' }).success).toBe(false);
        expect(upsertLandingBannerSchema.safeParse({ ...valid, isActive: false }).success).toBe(true);
        expect(upsertLandingBannerSchema.safeParse({ ...valid, isActive: true }).success).toBe(true);
    });
});

// The homepage layout is a write that decides what a visitor sees, in what order.
// Two things make it worth pinning here rather than trusting the form:
//
//   1. The key must be a REGISTERED section. Validation reads the registry, so a
//      key that has been removed from code can never be written back — that is
//      what stops an old admin tab from re-creating a section that no longer
//      renders.
//   2. Mode settings belong to the hero section alone. A slug on the stories row
//      would persist and never be read, so it is rejected rather than stored.
//
// The hero slug is also interpolated into a request path, hence the shape tests.
describe('upsertLandingLayoutSchema', () => {
    const hero = { key: 'hero', isEnabled: true, heroMode: 'slides', heroSlug: 'home' };

    it('accepts every registered section with no extra fields', () => {
        const sections = LANDING_SECTIONS.map((s) => ({ key: s.key, isEnabled: true }));
        expect(upsertLandingLayoutSchema.safeParse({ sections }).success).toBe(true);
    });

    it('accepts the hero with a mode and slug', () => {
        for (const heroMode of ['products', 'slides'] as const) {
            const result = upsertLandingLayoutSchema.safeParse({ sections: [{ ...hero, heroMode }] });
            expect(result.success, `should accept hero mode ${heroMode}`).toBe(true);
        }
    });

    it('rejects a key that is not registered', () => {
        // The whole point of the registry being the source of truth: a section
        // unregistered in code must not be writable.
        for (const key of ['heroSlider', 'Hero', 'HÉRO', '', 'x'.repeat(65)]) {
            const result = upsertLandingLayoutSchema.safeParse({ sections: [{ key, isEnabled: true }] });
            expect(result.success, `should reject key ${JSON.stringify(key)}`).toBe(false);
        }
    });

    it('trims a key and mode that arrive with surrounding whitespace', () => {
        // Consistent with every other string in this file: an operator pasting a
        // value with a trailing space gets it accepted and stored clean, not a
        // validation error. Internally the trimmed value is what gets persisted.
        const result = upsertLandingLayoutSchema.safeParse({
            sections: [{ key: ' hero ', isEnabled: true, heroMode: ' slides ', heroSlug: ' home ' }],
        });
        expect(result.success).toBe(true);
        expect(result.success && result.data.sections[0]).toEqual({
            key: 'hero',
            isEnabled: true,
            heroMode: 'slides',
            heroSlug: 'home',
        });
    });

    it('rejects a mode that is not one of the hero section modes', () => {
        for (const heroMode of ['carousel', 'Products', 'SLIDES', '']) {
            const result = upsertLandingLayoutSchema.safeParse({ sections: [{ ...hero, heroMode }] });
            expect(result.success, `should reject hero mode ${JSON.stringify(heroMode)}`).toBe(false);
        }
    });

    it('rejects mode settings on a section that declares no modes', () => {
        // Otherwise the row silently carries a slug the storefront never reads.
        const withMode = upsertLandingLayoutSchema.safeParse({
            sections: [{ key: 'stories', isEnabled: true, heroMode: 'slides' }],
        });
        expect(withMode.success).toBe(false);

        const withSlug = upsertLandingLayoutSchema.safeParse({
            sections: [{ key: 'stories', isEnabled: true, heroSlug: 'home' }],
        });
        expect(withSlug.success).toBe(false);
    });

    it('accepts a hero slug saved before its mode is chosen', () => {
        // A slug with no mode is a real intermediate state in the admin form, not
        // a mistake. It is only rejected on sections that have no modes at all.
        const result = upsertLandingLayoutSchema.safeParse({
            sections: [{ key: 'hero', isEnabled: true, heroSlug: 'home' }],
        });
        expect(result.success).toBe(true);
    });

    it('rejects a slug that is not a safe path segment', () => {
        // The slug reaches GET /content/hero-sections/:slug. A slash would change
        // which resource is fetched; a traversal or a scheme would be worse.
        for (const heroSlug of [
            'home/../admin',
            '../etc/passwd',
            '/home',
            'Home',
            'home page',
            'home_page',
            'home--page',
            '-home',
            'home-',
            'a'.repeat(65),
        ]) {
            const result = upsertLandingLayoutSchema.safeParse({ sections: [{ ...hero, heroSlug }] });
            expect(result.success, `should reject slug ${JSON.stringify(heroSlug)}`).toBe(false);
        }
    });

    it('rejects the same section twice', () => {
        // Order comes from the array, so a duplicate key has no single position
        // and the service would write whichever came last.
        const result = upsertLandingLayoutSchema.safeParse({
            sections: [
                { key: 'hero', isEnabled: true },
                { key: 'stories', isEnabled: true },
                { key: 'hero', isEnabled: false },
            ],
        });
        expect(result.success).toBe(false);
    });

    it('rejects an unbounded section list', () => {
        // The body is a fixed set of known sections, so extra entries are always
        // a mistake or an attempt to make the service do unbounded work.
        const many = Array.from({ length: LANDING_SECTIONS.length + 6 }, (_, i) => ({
            key: `section-${i}`,
            isEnabled: true,
        }));
        expect(upsertLandingLayoutSchema.safeParse({ sections: many }).success).toBe(false);
    });

    it('requires isEnabled to be a real boolean, not a truthy string', () => {
        expect(upsertLandingLayoutSchema.safeParse({ sections: [{ key: 'hero', isEnabled: 'false' }] }).success).toBe(
            false,
        );
        expect(upsertLandingLayoutSchema.safeParse({ sections: [{ key: 'hero', isEnabled: 1 }] }).success).toBe(false);
        expect(upsertLandingLayoutSchema.safeParse({ sections: [{ key: 'hero', isEnabled: false }] }).success).toBe(true);
    });
});
