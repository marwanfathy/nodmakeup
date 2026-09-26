// The homepage is a server component, so it can resolve its own data before the
// HTML is sent. Three of its four sections (Stories, Hero, Collections) each
// used to fetch in a useEffect, which meant the first paint waited for the JS
// bundle to download, parse and hydrate before a single product was on screen.
//
// The three datasets are read here through lib/server-api.ts, which caches them,
// and handed down as `initial*` props. Each section uses the prop when it is
// present and keeps its own fetch as the fallback, so:
//
//   * first load          -> real markup in the HTML, no skeleton flash
//   * client navigation   -> no server payload, so the skeleton shows as before
//   * server fetch fails  -> initial* is null, the section fetches in the browser
//
// The fourth section, BenefitsBar, is static content and has nothing to fetch.

import Lan_Banner from "./Lan_banner/Lan_banner";
import './globals.css';
import BenefitsBar from './BenefitsBar/BenefitsBar';
import HeroProductSection from './HeroProductCard2/HeroSection'
import Stories from "./Stories/Stories";
import CollectionsSection from './CollectionsSection/CollectionsSection';
import {
  serverGetHeroProducts,
  serverGetPublicCollections,
  serverGetPublicStories,
} from '../lib/server-api';

const HomePage = async () => {
  // Independent reads, so run them together rather than in sequence. Each one
  // resolves to null on failure instead of throwing, so one broken endpoint
  // cannot take the homepage down with it.
  const [storyGroups, heroProducts, collections] = await Promise.all([
    serverGetPublicStories(),
    serverGetHeroProducts(),
    serverGetPublicCollections(),
  ]);

  return (
    <div>
      <Stories initialGroups={storyGroups} />
      <Lan_Banner />
      <HeroProductSection initialProducts={heroProducts} />
      <CollectionsSection variant="featured" initialCollections={collections} />
      <BenefitsBar />
    </div>
  );
};

export default HomePage;
