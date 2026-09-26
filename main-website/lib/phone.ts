// ===============================================
//  EGYPTIAN PHONE NORMALIZATION
// ===============================================
// The checkout field holds the national part only, behind a fixed +20 prefix.
// Egyptian mobiles are written nationally as 0 + 10 digits (01012345678) but
// internationally as +20 + 10 digits with the trunk 0 dropped (+201012345678),
// so `+2001…` is the classic double-zero mistake. Anything typed or pasted —
// including a full international number — is reduced to those 10 digits, which
// is what gets stored and sent to the API as E.164.

export const EG_PHONE_COUNTRY_CODE = '20';
export const EG_PHONE_PREFIX = `+${EG_PHONE_COUNTRY_CODE}`;
const EG_MOBILE_DIGITS = 10;

// An Arabic or Egyptian keyboard emits Arabic-Indic digits (٠-٩), which is how a
// phone number is normally written in Egypt. `\d` does not match them, so they
// are translated to Latin before anything is parsed. Some Arabic layouts ship
// the Persian forms (۰-۹) instead, so both sets are handled.
const ARABIC_INDIC_ZERO = 0x0660; // ٠
const PERSIAN_ZERO = 0x06f0; // ۰
const NON_LATIN_DIGITS = /[٠-٩۰-۹]/g;
const LATIN_DIGITS = /[0-9]/g;

/** Translate Arabic-Indic or Persian digits to Latin; anything else is left be. */
function toLatinDigits(value: string): string {
  return value.replace(NON_LATIN_DIGITS, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code - (code >= PERSIAN_ZERO ? PERSIAN_ZERO : ARABIC_INDIC_ZERO));
  });
}

/** Translate Latin digits to Arabic-Indic. */
export function toArabicIndicDigits(value: string): string {
  return value.replace(LATIN_DIGITS, (digit) =>
    String.fromCharCode(ARABIC_INDIC_ZERO + Number(digit)),
  );
}

/**
 * How a number should be *shown* in this locale. Latin digits stay the
 * canonical form underneath — that is what the API, the order records and the
 * admin dashboard read, and what coupon phone matching compares — so only the
 * display is localized.
 */
export function formatPhoneForLocale(value: string, locale: string): string {
  return locale === 'ar' ? toArabicIndicDigits(value) : value;
}

/** Reduce any typed/pasted value to the national digits, without the trunk 0. */
export function normalizeEgyptianPhone(raw: string): string {
  // Arabic-Indic digits first, so a native Arabic keypad is not silently
  // stripped to an empty field.
  let d = toLatinDigits(raw).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2); // international prefix: 0020…
  if (d.startsWith(EG_PHONE_COUNTRY_CODE) && d.length > EG_MOBILE_DIGITS) {
    d = d.slice(EG_PHONE_COUNTRY_CODE.length); // country code: +20…
  }
  d = d.replace(/^0+/, ''); // the national trunk 0 (and any extras)
  return d.slice(0, EG_MOBILE_DIGITS);
}

/** Egyptian mobiles are 1 + 9 digits once the trunk 0 is dropped. */
export function isValidEgyptianPhone(national: string): boolean {
  return /^1\d{9}$/.test(national);
}

/** E.164 for the API and for the store's own records. */
export function toInternationalEgyptianPhone(national: string): string {
  return `${EG_PHONE_PREFIX}${national}`;
}
