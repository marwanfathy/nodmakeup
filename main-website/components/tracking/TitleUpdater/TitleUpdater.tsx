'use client'; // This component must be a Client Component

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useI18n } from '../../../lib/i18n/client';
import { stripLocale } from '../../../lib/i18n/paths';

// Map canonical (locale-stripped) paths to translation keys.
const PATH_TITLE_KEYS: Record<string, string> = {
  '/': 'titles.home',
  '/home': 'titles.home',
  '/shop': 'titles.shop',
  '/collections': 'titles.collections',
  '/bestsellers': 'titles.bestsellers',
  '/about': 'titles.story',
  '/AboutUs': 'titles.story',
  '/shipping': 'help.shipping.title',
  '/returns': 'help.returns.title',
  '/terms': 'help.terms.title',
  '/privacy-policy': 'help.privacy.title',
  '/checkout': 'titles.checkout',
};

/** Strip a trailing slash (except on root) so a trailingSlash:true config
 *  or a stray "/" doesn't break the PATH_TITLE_KEYS lookup. */
function normalize(canonical: string): string {
  if (canonical.length > 1 && canonical.endsWith('/')) {
    return canonical.slice(0, -1);
  }
  return canonical;
}

const TitleUpdater = () => {
  const pathname = usePathname();
  const { t } = useI18n();
  const desiredTitleRef = useRef('');

  useEffect(() => {
    const canonical = normalize(stripLocale(pathname));
    const pageTitleKey = PATH_TITLE_KEYS[canonical];

    // Product pages get their real title from generateMetadata once the
    // product data resolves — we only ever show a placeholder here and must
    // not fight that later update.
    const isProductPage = canonical.startsWith('/product');

    let fullTitle: string;
    if (pageTitleKey) {
      fullTitle = `${t(pageTitleKey)} | ${t('titles.brand')}`;
    } else if (canonical.startsWith('/order-success')) {
      fullTitle = `${t('titles.orderConfirm')} | ${t('titles.brand')}`;
    } else if (isProductPage) {
      fullTitle = `${t('titles.product')} | ${t('titles.brand')}`;
    } else {
      fullTitle = t('titles.default');
    }

    desiredTitleRef.current = fullTitle;
    document.title = fullTitle;

    if (isProductPage) {
      // Let generateMetadata have the final word here — no enforcement.
      return;
    }

    // Next.js re-applies a route's (or the root layout's fallback) <title>
    // asynchronously, once the RSC payload for the new route finishes
    // streaming in. That can land *after* this effect already ran, silently
    // overwriting it back to the static default. Watch the <title> node
    // for the lifetime of this pathname and re-assert our value if anything
    // else touches it.
    const titleEl =
      document.querySelector('title') ??
      (() => {
        const el = document.createElement('title');
        document.head.appendChild(el);
        return el;
      })();

    const observer = new MutationObserver(() => {
      if (document.title !== desiredTitleRef.current) {
        document.title = desiredTitleRef.current;
      }
    });
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });

    return () => observer.disconnect();
  }, [pathname, t]); // Re-run whenever the URL path or locale changes.

  return null;
};

export default TitleUpdater;