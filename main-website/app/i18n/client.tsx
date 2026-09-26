'use client';

import React, { createContext, useContext, useCallback, useEffect, useMemo } from 'react';
import { messages, Locale } from './messages';

export type Translator = (key: string, vars?: Record<string, string | number>) => string;

interface I18nContextValue {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  t: Translator;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  dir: 'ltr',
  t: (key: string) => key,
});

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = useCallback<Translator>(
    (key, vars) => {
      const template = (messages[locale] as Record<string, string>)[key]
        ?? (messages.en as Record<string, string>)[key]
        ?? key;
      return interpolate(template, vars);
    },
    [locale],
  );

  const dir: 'ltr' | 'rtl' = locale === 'ar' ? 'rtl' : 'ltr';

  // Keep the document attributes in sync (layout.tsx renders them server-side;
  // this guards client-side navigation and any cookie/URL changes).
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const value = useMemo(() => ({ locale, dir, t }), [locale, dir, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}