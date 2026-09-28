// The homepage is a server component, so it can resolve its own data before the
// HTML is sent. Four of its five sections (Stories, Hero, Collections, and the
// hero carousel) each used to fetch in a useEffect, which meant the first paint
// waited for the JS bundle to download, parse and hydrate before a single product
// was on screen.
//
// Those datasets are read here through lib/server-api.ts, which caches them, and
// handed down as `initial*` props. Each section uses the prop when it is present
// and keeps its own fetch as the fallback, so:
//
//   * first load          -> real markup in the HTML, no skeleton flash
//   * client navigation   -> no server payload, so the skeleton shows as before
//   * server fetch fails  -> initial* is null, the section fetches in the browser
//
// The fifth section, BenefitsBar, is static content and has nothing to fetch. The
// landing banner is fed the same way but has no browser-side fallback fetch: it
// ships with a built-in campaign, so a null `initialBanner` renders that copy
// rather than a skeleton.
//
// WHICH SECTIONS RENDER, AND IN WHICH ORDER, IS NOT DECIDED HERE. That comes from
// the saved layout, and the two files that make it work are:
//
//   * components/sections/registry.tsx — the key -> component map
//   * shared/src/landing/sections.ts     — which keys exist
//
// This file only supplies the data and asks the registry to render what comes
// back. Adding a section is an entry in those two files, not an edit here.

import { Fragment } from 'react';
import './globals.css';
import {
  hasSection,
  heroSlugFor,
  heroWantsSlides,
  renderLandingSection,
  resolveLandingSections,
} from '../components/sections/registry';
import {
  serverGetHeroProducts,
  serverGetHeroSection,
  serverGetLandingBanner,
  serverGetLandingLayout,
  serverGetPublicCollections,
  serverGetPublicStories,
} from '../lib/server-api';

const HomePage = async () => {
  // The layout comes first, and the rest of the reads are planned from it.
  //
  // This is a deliberate extra round trip rather than fetching everything in
  // parallel: the layout is a single tiny row behind a 60s cache, so the
  // sequential hop is paid on a cache miss only, while planning from it means a
  // section the operator switched off is never requested at all. Doing it the
  // other way round would issue every read on every render and discard the ones
  // for hidden sections — on the most-visited page in the site.
  const layout = await serverGetLandingLayout();
  const sections = resolveLandingSections(layout?.sections ?? null);

  // Independent reads, so run them together rather than in sequence. Each one
  // resolves to null on failure instead of throwing, so one broken endpoint
  // cannot take the homepage down with it — and a null means "this section
  // renders its skeleton and the browser retries", which is the pre-existing
  // behaviour, not a blank page.
  const wantsStories = hasSection(sections, 'stories');
  const wantsBanner = hasSection(sections, 'banner');
  const wantsCollections = hasSection(sections, 'collections');
  // The product hero and the carousel are alternatives, so only one of the two
  // reads is ever made.
  const wantsCarousel = heroWantsSlides(sections);
  const wantsHeroProducts = hasSection(sections, 'hero') && !wantsCarousel;

  const [storyGroups, landingBanner, collections, heroProducts, heroCarousel] = await Promise.all([
    wantsStories ? serverGetPublicStories() : null,
    wantsBanner ? serverGetLandingBanner() : null,
    wantsCollections ? serverGetPublicCollections() : null,
    wantsHeroProducts ? serverGetHeroProducts() : null,
    wantsCarousel ? serverGetHeroSection(heroSlugFor(sections)) : null,
  ]);

  const data = {
    stories: storyGroups,
    banner: landingBanner,
    heroProducts,
    heroSection: heroCarousel,
    collections,
  };

  return (
    <div>
      {/*
        The Fragment carries the key rather than the section element. The section
        is rendered by the registry, and a section that resolves to nothing (an
        unregistered key, which resolveLandingSections has already dropped) would
        leave the key nowhere to live — so it is supplied by the one place that
        knows which row this is.
      */}
      {sections.map((setting) => (
        <Fragment key={setting.key}>{renderLandingSection(setting, data)}</Fragment>
      ))}
    </div>
  );
};

export default HomePage;
