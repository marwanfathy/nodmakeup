import React, { Suspense } from 'react';
import { cookies } from 'next/headers';
import { CartProvider } from './contexts/CartContext';
import Nav from './navbar/NavBar';
import Footer from './Footer/Footer'; // Ensure this path is correct based on your folder structure
import './design-system/variables.css'; // curve/radius + color tokens. Must be
// imported here, not via @import in globals.css: a relative @import inside a
// Tailwind-processed stylesheet is dropped from the build, and an unresolved
// var(--r-*) computes to 0, which silently squares off every corner.
import './globals.css';
import './i18n/rtl.css';
import { PageTracker } from './PageTracker';
import { BehaviorTracker } from './BehaviorTracker';
import TitleUpdater from './TitleUpdater/TitleUpdater';
import { LocaleProvider } from './i18n/client';
import { defaultLocale, Locale } from './i18n/messages';

export const metadata = {
  description: 'Welcome!',
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
         * in app/Fonts/fonts.css, which NavBar.css pulls in with @import — so
         * the browser only discovers these URLs after downloading and parsing
         * the stylesheets, and Rubik in particular is used by the nav that is
         * above the fold on every page. Preloading starts the download in
         * parallel with the CSS instead of after it.
         *
         * Rubic (52 KB) is always preloaded: NavBar.css uses it on every page.
         * Cairo (128 KB) only drives text in Arabic mode (i18n/rtl.css), so it
         * is preloaded only when dir is rtl — on an English page preloading it
         * would be 128 KB the visitor never renders a single glyph of.
         *
         * The `crossOrigin` is required: fonts are fetched in CORS mode, and a
         * preload without it is fetched twice (once uselessly, once for real).
         * font-display:swap in fonts.css means neither blocks first paint. */}
        <link
          rel="preload"
          href="/fonts/rubic.79f7a421.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {dir === 'rtl' && (
          <link
            rel="preload"
            href="/fonts/cairo.30840268.woff2"
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
              <main style={{ minHeight: '80vh' }}>{children}</main>

              <Footer /> {/* <--- Footer added here */}
            </CartProvider>
          </LocaleProvider>
        </Suspense>
      </body>
    </html>
  );
}