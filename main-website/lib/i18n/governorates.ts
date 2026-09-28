/**
 * Localized names for the delivery zones.
 *
 * This is data rather than copy, so it is keyed by the governorate string the
 * API returns instead of living in the message catalogue. Two consumers need
 * the same table: the dropdown, which must not show English names to an Arabic
 * shopper, and location lookup, which matches the names the geocoder returns in
 * the reader's language. One table keeps those two from drifting.
 *
 * A zone with no entry here still works — it falls back to the name the API
 * sent — so adding a governorate does not require touching this file to avoid a
 * broken dropdown. It does need an entry to be readable in Arabic.
 */

export interface GovernorateLabel {
  en: string;
  ar: string;
}

export const GOVERNORATE_LABELS: Readonly<Record<string, GovernorateLabel>> = {
  Cairo: { en: 'Cairo', ar: 'القاهرة' },
  Alexandria: { en: 'Alexandria', ar: 'الإسكندرية' },
  'Port Said': { en: 'Port Said', ar: 'بورسعيد' },
};

export type Locale = 'en' | 'ar';

/** The name to show for a zone, in the reader's language. */
export function governorateLabel(governorate: string, locale: Locale): string {
  return GOVERNORATE_LABELS[governorate]?.[locale] ?? governorate;
}
