// ===============================================
//  LOCALIZED PRICING + PRODUCT TEXT HELPERS
// ===============================================
// Prices: en -> "EGP 1,250.00", ar -> "1,250.00 ج.م" (Egyptian pound sign
// conventionally follows the number in Arabic). Product text prefers the
// Arabic field when present and falls back to English for any missing part.

export function formatPrice(amount: number | string, locale: string, decimals = 2): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return '';
  const value = n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return locale === 'ar' ? `${value} ج.م` : `EGP ${value}`;
}

export interface LocalizableProduct {
  name?: string | null;
  nameAr?: string | null;
  shortDescription?: string | null;
  shortDescriptionAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
}

export interface LocalizedProductText {
  name: string;
  shortDescription: string | null;
  description: string | null;
  /** True when the locale is Arabic AND the product carries Arabic fields. */
  hasArabic: boolean;
}

/** Pick the localized product text, falling back to English per-field. */
export function pickLocale(p: LocalizableProduct | null | undefined, locale: string): LocalizedProductText {
  const ar = locale === 'ar';
  const fallback = (v: string | null | undefined, arV: string | null | undefined): string | null =>
    ar ? (arV || v || null) : (v || arV || null);
  return {
    name: (ar ? (p?.nameAr || p?.name) : (p?.name || p?.nameAr)) ?? '',
    shortDescription: fallback(p?.shortDescription, p?.shortDescriptionAr),
    description: fallback(p?.description, p?.descriptionAr),
    hasArabic: ar && Boolean(p?.nameAr || p?.shortDescriptionAr || p?.descriptionAr),
  };
}