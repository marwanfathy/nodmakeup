import { LOCALES, defaultLocale } from './messages';

/** Strip a leading locale segment from a pathname. '/en/shop' -> '/shop' */
export function stripLocale(pathname: string): string {
  const segments = pathname.split('/');
  const first = segments[1] ?? '';
  if ((LOCALES as readonly string[]).includes(first)) {
    return '/' + segments.slice(2).join('/');
  }
  return pathname;
}

/** Prefix a canonical path with a locale. '/shop' + 'ar' -> '/ar/shop', '/' + 'en' -> '/en' */
export function localePath(path: string, locale: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  const rest = clean === '/' ? '' : clean;
  return `/${locale}${rest}`;
}

/** Swap the locale on the current pathname. '/en/shop' + 'ar' -> '/ar/shop' */
export function switchLocalePath(pathname: string, nextLocale: string): string {
  return localePath(stripLocale(pathname), nextLocale);
}

/** Read the locale from a pathname, falling back to the default locale. */
export function getLocaleFromPath(pathname: string): string {
  const first = pathname.split('/')[1] ?? '';
  return (LOCALES as readonly string[]).includes(first) ? first : defaultLocale;
}