import { NextRequest, NextResponse } from 'next/server';

const LOCALES = ['en', 'ar'];
const DEFAULT_LOCALE = 'en';
const LOCALE_COOKIE = 'NEXT_LOCALE';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split('/');
  const first = segments[1] ?? '';

  // Locale-prefixed URL (/en/..., /ar/...): persist the choice as a cookie and
  // rewrite to the canonical (unprefixed) route — the actual pages live at
  // /, /shop, /product/..., etc. The browser URL keeps the /en prefix.
  if (LOCALES.includes(first)) {
    const rest = '/' + segments.slice(2).join('/'); // '/en/shop' -> '/shop', '/en' -> '/'
    const url = request.nextUrl.clone();
    url.pathname = rest === '//' ? '/' : rest;
    const res = NextResponse.rewrite(url);
    res.cookies.set(LOCALE_COOKIE, first, { path: '/' });
    return res;
  }

  // No prefix: redirect to a locale-prefixed URL, keeping the rest of the path.
  //
  // The target is the visitor's own saved locale, not unconditionally the
  // default. This branch used to hardcode DEFAULT_LOCALE and never read the
  // cookie the branch above sets, so an Arabic visitor who landed on /ar and
  // then typed the bare domain, clicked a shared link, or opened a bookmark
  // was silently bounced to /en and lost their language. That cookie is the
  // only record of their choice, so it has to be honoured here.
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = saved && LOCALES.includes(saved) ? saved : DEFAULT_LOCALE;

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  const res = NextResponse.redirect(url);
  // Seed the cookie on a first visit so the next unprefixed hit already knows
  // the answer. Only when unset, so this never overwrites a later choice.
  if (!saved) res.cookies.set(LOCALE_COOKIE, locale, { path: '/' });
  return res;
}

export const config = {
  // Skip Next internals and static assets (public/). `avif` matters: the image
  // optimiser negotiates it, and a .avif served from public/ that fell through
  // to this middleware would be 307'd to /en/... and then 404.
  matcher: ['/((?!_next/|favicon.ico|.*\\.(?:png|jpe?g|webp|avif|svg|gif|ico|mp3|mp4|webm|woff2?|ttf|otf)$).*)'],
};