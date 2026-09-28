// The storefront's half of the landing-page section registration.
//
// A section becomes part of the homepage in two steps, and this file is the
// second one:
//
//   1. shared/src/landing/sections.ts — the metadata: the key, its labels, and
//      which modes it supports. All three apps read that, so the admin list and
//      the backend's validation already know about the section.
//   2. THIS FILE — the component that key renders to, and where its data comes
//      from.
//
// The RENDERERS record below is keyed by the shared `LandingSectionKey` union, so
// step 1 without step 2 is a compile error rather than a section that silently
// never appears. That is the whole mechanism behind "register a component in
// code": write the renderer here, and the admin picks up the row, the labels and
// the on/off switch with no admin-panel edit.
//
// This module deliberately has no 'use client'. It is imported by the homepage,
// which is a server component; marking it here would push the whole render pass to
// the browser. Each section component carries its own directive where it needs
// one.

import type { ReactNode } from 'react';

import {
  DEFAULT_HERO_SLUG,
  defaultSettingFor,
  isLandingSectionKey,
  isModeFor,
  LANDING_SECTIONS,
  type LandingSectionKey,
} from '../../lib/shared/dist/landing/sections.js';
import type {
  ApiStoryGroup,
  CollectionSummary,
  HeroSectionPublic,
  LandingBanner,
  LandingSectionSetting,
  ProductSummary,
} from '../../lib/api';

import Stories from './Stories/Stories';
import LandingBannerComponent from './LandingBanner/LandingBanner';
import HeroProductSection from './Hero/HeroSection';
import HeroSlider from './Hero/HeroSlider';
import CollectionsSection from './CollectionsSection/CollectionsSection';
import BenefitsBar from './BenefitsBar/BenefitsBar';

/**
 * Everything the homepage resolved, keyed by the section that needs it.
 *
 * One object rather than eight positional props, so adding a section means adding
 * a field here and a renderer instead of editing a signature and every call site.
 * Every field is nullable: a failed fetch resolves to null, which each section
 * already treats as "load it in the browser".
 */
export interface LandingSectionData {
  stories: ApiStoryGroup[] | null;
  banner: LandingBanner | null;
  heroProducts: ProductSummary[] | null;
  heroSection: HeroSectionPublic | null;
  collections: CollectionSummary[] | null;
}

/** Renders one section. `setting` carries the mode choice, so no extra plumbing. */
type SectionRenderer = (data: LandingSectionData, setting: LandingSectionSetting) => ReactNode;

/**
 * The mode that switches the hero to the carousel.
 *
 * Named so the one place that branches on it reads as a decision rather than a
 * string comparison, and so a grep for it finds both halves of the branch. It
 * must stay in step with the `modes` list the hero declares in
 * shared/src/landing/sections.ts; `isModeFor` is what enforces that at runtime, so
 * a rename there degrades to the product hero rather than a blank section.
 */
const HERO_SLIDES = 'slides';

/**
 * key -> component.
 *
 * Exhaustiveness comes from the key type rather than a comment: registering a
 * section in shared and forgetting it here fails `tsc`.
 */
const RENDERERS: Record<LandingSectionKey, SectionRenderer> = {
  stories: (data) => <Stories initialGroups={data.stories} />,

  banner: (data) => <LandingBannerComponent initialBanner={data.banner} />,

  /**
   * The hero is the one section with two renderings, chosen in the admin layout.
   *
   * `slides` uses the carousel the Hero Section admin page manages, fetched by
   * slug — the layout stores which one, because an operator may keep several hero
   * sections and want this page to use a specific one.
   *
   * The mode is validated against this section's own `modes` by the backend and
   * by the layout schema, but it arrives over the wire, so it is narrowed again
   * here rather than trusted. An unrecognised mode falls back to the product
   * hero, which is the pre-existing rendering: a layout row written by a newer
   * build must not be able to blank the hero.
   *
   * A mode of `slides` is a request for a hero section, not a guarantee one
   * exists. The slug may name a section nobody has created, or one that was
   * deactivated, and the public route answers 404 for both. So the resolved data
   * gates the carousel as well as the mode: without a hero section to show, the
   * product hero is the honest rendering. Mounting the slider on a null would
   * hand it a request every browser makes to be told the same thing.
   *
   * This is a different case from a hero section that EXISTS but has no slides in
   * it. That one renders the slider's own "no slides" placeholder, because the
   * operator made a hero section and left it empty, and quietly substituting a
   * different hero would hide that. Here there is nothing to substitute for.
   */
  hero: (data, setting) =>
    setting.heroMode === HERO_SLIDES &&
    isModeFor('hero', setting.heroMode) &&
    data.heroSection !== null ? (
      <HeroSlider slug={setting.heroSlug ?? DEFAULT_HERO_SLUG} initialData={data.heroSection} />
    ) : (
      <HeroProductSection initialProducts={data.heroProducts} />
    ),
  collections: (data) => <CollectionsSection variant="featured" initialCollections={data.collections} />,

  // Static content: nothing to resolve, nothing to fetch.
  benefits: () => <BenefitsBar />,
};

/**
 * The sections to render, in order, each with the setting that governs it.
 *
 * `saved` is what the API returned, or null when the fetch failed. Null resolves
 * to the registry's own order with everything on — the page as it was before the
 * layout existed — so an unreachable API degrades to the default rather than to an
 * empty homepage.
 *
 * A key the registry does not know is dropped with a warning rather than
 * rendered: that is a row saved before the section was unregistered, and there is
 * no component to render it with. Keeping it would push an unmappable key into
 * the render loop.
 *
 * The backend already filters disabled sections out and fills in defaults, so
 * this only re-applies those rules for the fallback it owns. Re-checking rather
 * than trusting the response is deliberate: the storefront must render the same
 * page whether the answer came from the API or from the local fallback.
 */
export function resolveLandingSections(saved: LandingSectionSetting[] | null): LandingSectionSetting[] {
  if (saved === null) return LANDING_SECTIONS.map((meta) => defaultSettingFor(meta.key));

  return saved.filter((setting) => {
    if (isLandingSectionKey(setting.key)) return true;

    console.warn(`[landing] ignoring section "${setting.key}" — not in the registry`);
    return false;
  });
}

/**
 * Renders one already-resolved section. Null for a key the registry does not
 * know, which `resolveLandingSections` has already filtered out — the check is
 * repeated because this is exported and callable on its own.
 */
export function renderLandingSection(
  setting: LandingSectionSetting,
  data: LandingSectionData,
): ReactNode | null {
  if (!isLandingSectionKey(setting.key)) return null;

  return RENDERERS[setting.key](data, setting);
}

/**
 * Whether a section is in this layout.
 *
 * Used to plan the server fetches, so a section the operator switched off is not
 * requested at all — the layout decides what the page needs, not just what it
 * shows.
 */
export const hasSection = (sections: LandingSectionSetting[], key: LandingSectionKey): boolean =>
  sections.some((setting) => setting.key === key);

/**
 * Whether the hero in this layout is the carousel rather than the product card.
 *
 * Needed before the fetch, since the carousel is a second, conditional read. Same
 * narrowing as the renderer: an unrecognised mode means the product hero, so the
 * page does not fetch slides nobody will render.
 */
export const heroWantsSlides = (sections: LandingSectionSetting[]): boolean =>
  sections.some(
    (setting) => setting.key === 'hero' && setting.heroMode === HERO_SLIDES && isModeFor('hero', setting.heroMode),
  );

/**
 * Which hero section the carousel should read.
 *
 * The page needs this before it can fetch, and the renderer needs the same value
 * after — so it is resolved once here rather than in both places, which is what
 * keeps the fetch and the render from disagreeing when the layout names no slug.
 */
export const heroSlugFor = (sections: LandingSectionSetting[]): string =>
  sections.find((setting) => setting.key === 'hero')?.heroSlug ?? DEFAULT_HERO_SLUG;
