// Server-side translator for Server Components / route metadata.
// Reads the locale cookie set by the middleware, so it never needs the URL.
import { cookies } from 'next/headers';
import { messages, defaultLocale, Locale } from './messages';

export type ServerTranslator = (key: string, vars?: Record<string, string | number>) => string;

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export async function getTranslator(): Promise<{ locale: Locale; t: ServerTranslator }> {
  const store = await cookies();
  const locale: Locale = store.get('NEXT_LOCALE')?.value === 'ar' ? 'ar' : defaultLocale;
  const dict = messages[locale] as Record<string, string>;
  const en = messages.en as Record<string, string>;
  const t: ServerTranslator = (key, vars) =>
    interpolate(dict[key] ?? en[key] ?? key, vars);
  return { locale, t };
}