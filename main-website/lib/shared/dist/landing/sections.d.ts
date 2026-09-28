/**
 * The landing-page section registry.
 *
 * This file is the single place a new homepage section is registered. It is the
 * answer to "how do I add a section without touching the admin panel": a new
 * section is one entry here, and three things pick it up with no further edits —
 *
 *   1. the storefront's section renderer (main-website/components/sections/registry.tsx
 *      maps each key to a React component),
 *   2. the admin layout list, which builds its rows from LANDING_SECTIONS and so
 *      shows the new section immediately, already labelled in both languages,
 *   3. the validation schema, because the key union is derived from this array
 *      rather than written out again.
 *
 * Metadata lives in `shared` rather than in main-website because all three apps
 * have to agree on the key strings: the storefront renders by key, the admin
 * lists by key, and the backend validates against the same union. The React
 * component itself cannot live here — that is the storefront's half of the
 * registration, in the file named above.
 *
 * Order in this array is the DEFAULT order, used when the database has no row
 * for a section yet. Once the operator saves a layout, the database wins.
 */
import type { LandingSectionSetting } from '../api/types';
/** The hero's two rendering modes. See `modes` on the `hero` entry below. */
export declare const HERO_MODES: readonly ["products", "slides"];
export type HeroMode = (typeof HERO_MODES)[number];
/**
 * Which hero section the `slides` mode reads, when the layout does not name one.
 * A slug rather than an id because the public hero route is slug-addressed
 * (`GET /content/hero-sections/:slug`) and a slug is what an operator types
 * into the admin form.
 */
export declare const DEFAULT_HERO_SLUG = "home";
/**
 * The one definition of what a section slug may look like.
 *
 * The value is interpolated into a request path, so it is held to the same shape
 * a slug column would be: lower-case, digits, single dashes. No slashes, no dots,
 * no percent-encoding tricks.
 *
 * Exported so the validation schema, the admin read and the public read all
 * reject the same strings — three copies of this regex would drift, and the one
 * that is more permissive decides what reaches the store.
 */
export declare const SECTION_SLUG_RE: RegExp;
export interface LandingSectionMeta {
    /** Stable identifier. Persisted in `landing_sections.key` — never rename one. */
    readonly key: string;
    readonly labelEn: string;
    readonly labelAr: string;
    /**
     * Present only when the layout can choose how this section renders. The admin
     * renders one selector per entry here; a section with no `modes` gets no
     * selector and the storefront always renders it the same way.
     */
    readonly modes?: readonly string[];
    /** The mode used when the saved layout does not name one. */
    readonly defaultMode?: string;
    /** One line explaining what the section is, shown under its row in the admin. */
    readonly hintEn: string;
}
/**
 * Default page order. Also the type source: `LandingSectionKey` is derived from
 * this array, so adding an entry here widens the key union everywhere at once.
 */
export declare const LANDING_SECTIONS: readonly [{
    readonly key: "stories";
    readonly labelEn: "Stories";
    readonly labelAr: "القصص";
    readonly hintEn: "Instagram-style story highlights fetched from the stories API.";
}, {
    readonly key: "banner";
    readonly labelEn: "Promo banner";
    readonly labelAr: "بانر ترويجي";
    readonly hintEn: "The single landing banner edited under Promo banner.";
}, {
    readonly key: "hero";
    readonly labelEn: "Hero";
    readonly labelAr: "الهيرو";
    readonly modes: readonly ["products", "slides"];
    readonly defaultMode: "products";
    readonly hintEn: string;
}, {
    readonly key: "collections";
    readonly labelEn: "Collections";
    readonly labelAr: "الكولكشنز";
    readonly hintEn: "Featured collections grid.";
}, {
    readonly key: "benefits";
    readonly labelEn: "Benefits bar";
    readonly labelAr: "شريط المزايا";
    readonly hintEn: "Static strip of service promises. Fetches nothing.";
}];
export type LandingSectionKey = (typeof LANDING_SECTIONS)[number]['key'];
/** Narrows an untrusted value (a DB row, a request body) to a registered key. */
export declare const isLandingSectionKey: (value: unknown) => value is LandingSectionKey;
/** Metadata for a registered key, or undefined for an unregistered one. */
export declare const getSectionMeta: (key: string) => LandingSectionMeta | undefined;
/** The order the storefront falls back to when the database has no layout. */
export declare const DEFAULT_SECTION_ORDER: readonly LandingSectionKey[];
/**
 * Narrows a mode against one section's own `modes` list.
 *
 * Checked per section rather than against HERO_MODES alone, so a section that
 * grows its own modes later cannot be handed a mode belonging to a different
 * one.
 */
export declare const isModeFor: (key: string, mode: unknown) => boolean;
/**
 * Whether the layout may carry mode settings for this section at all.
 *
 * Distinct from `isModeFor`: a section can declare modes without the layout
 * having picked one yet — a hero slug saved before its mode is chosen is
 * legitimate — and validation needs to tell those two cases apart.
 */
export declare const hasModes: (key: string) => boolean;
/** The mode a section renders in when the layout does not override it. */
export declare const defaultModeFor: (key: string) => string | null;
/**
 * The layout row for a section that has never been saved: on, in registry order,
 * in the mode its entry declares.
 *
 * This is the one definition of "what a section looks like with nothing stored",
 * and three callers need it — the storefront falling back to the default page
 * when it cannot reach the API, and the backend's public and admin reads. Three
 * copies of "enabled, and the hero defaults to products" would eventually disagree
 * about a section added next year, and the disagreement would only show up as a
 * section that renders differently depending on which read answered.
 *
 * Callers apply a stored value by spreading this and overriding the fields they
 * actually hold, so a stored mode never leaves the other fields defaulted.
 */
export declare const defaultSettingFor: (key: LandingSectionKey) => LandingSectionSetting;
