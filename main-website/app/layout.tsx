import React, { Suspense } from 'react';
import { cookies } from 'next/headers';
import type { Viewport } from 'next';
import { CartProvider } from '../contexts/CartContext';
import Nav from '../components/layout/Navbar/NavBar';
import Footer from '../components/layout/Footer/Footer'; // Ensure this path is correct based on your folder structure
import '../design-system/variables.css'; // curve/radius + color tokens. Must be
// imported here, not via @import in globals.css: a relative @import inside a
// Tailwind-processed stylesheet is dropped from the build, and an unresolved
// var(--r-*) computes to 0, which silently squares off every corner.
import './globals.css';
import '../lib/i18n/rtl.css';
import { PageTracker } from '../components/tracking/PageTracker';
import { BehaviorTracker } from '../components/tracking/BehaviorTracker';
import TitleUpdater from '../components/tracking/TitleUpdater/TitleUpdater';
import OfflineWatcher from '../components/ui/OfflineWatcher';
import { LocaleProvider } from '../lib/i18n/client';
import { defaultLocale, Locale } from '../lib/i18n/messages';

export const metadata = {
  description: 'Welcome!',
};

/**
 * `viewport-fit=cover` is what turns the notch, the status bar and the home
 * indicator into real layout constraints instead of decoration the page may
 * slide underneath. Without it the browser reports every
 * `env(safe-area-inset-*)` as 0 — so on iPhone X and on every iPhone since,
 * the safe-area padding written throughout these stylesheets silently
 * computed to nothing and the first row of the navigation sat under the
 * Dynamic Island. It has to stay `cover` for as long as any rule reads `env()`.
 *
 * It is deliberately the only setting here: no `maximum-scale`, no
 * `user-scalable: false`. Pinching to zoom is how a low-vision customer reads
 * the page, and taking it away fails them to tidy a layout the insets alone
 * already fix.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The middleware sets NEXT_LOCALE for every prefixed request; unprefixed
  // requests are redirected to /en, so this reliably resolves the locale.
  const cookieStore = await cookies();
  const locale: Locale = cookieStore.get('NEXT_LOCALE')?.value === 'ar' ? 'ar' : defaultLocale;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <head>
        {/* The two webfonts this site actually renders with. They are declared
         * in fonts/fonts.css, which NavBar.css pulls in with @import — so
         * the browser only discovers these URLs after downloading and parsing
         * the stylesheets, and Rubik in particular is used by the nav that is
         * above the fold on every page. Preloading starts the download in
         * parallel with the CSS instead of after it.
         *
         * Rubic (52 KB) is always preloaded: NavBar.css uses it on every page.
         * Cairo (128 KB) only drives text in Arabic mode (lib/i18n/rtl.css), so it
         * is preloaded only when dir is rtl — on an English page preloading it
         * would be 128 KB the visitor never renders a single glyph of.
         *
         * The `crossOrigin` is required: fonts are fetched in CORS mode, and a
         * preload without it is fetched twice (once uselessly, once for real).
         * font-display:swap in fonts.css means neither blocks first paint. */}
        <link
          rel="preload"
          href="/fonts/rubic.ce012169.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {dir === 'rtl' && (
          <link
            rel="preload"
            href="/fonts/cairo.7eea4806.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body>
        {/* Logic components wrapped in Suspense to prevent useSearchParams errors.
         * TitleUpdater lives inside LocaleProvider below (it needs real
         * translations from context, not the default `t: key => key` stub),
         * and it only calls usePathname() — not useSearchParams() — so it
         * doesn't need to stay in this boundary for CSR-bailout reasons. */}
        <Suspense fallback={null}>
          <PageTracker />
          <BehaviorTracker />
        </Suspense>

        {/* Main Application */}
        <Suspense fallback={<div className="loader-center" />}>
          <LocaleProvider locale={locale}>
            <TitleUpdater />
            <CartProvider>
              <Nav />
              <OfflineWatcher />
              <main style={{ minHeight: '80vh' }}>{children}</main>

              <Footer /> {/* <--- Footer added here */}
            </CartProvider>
          </LocaleProvider>
        </Suspense>
      </body>
    </html>
  );
}