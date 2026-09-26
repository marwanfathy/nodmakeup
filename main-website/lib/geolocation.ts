/**
 * "Use my current location" for the checkout address field.
 *
 * The browser only ever hands us coordinates, but a delivery driver needs
 * something a human can read, so a fix is reverse-geocoded into a street
 * address. That lookup is best-effort by design: when it is blocked, offline or
 * simply too slow, the coordinates themselves are still more useful than an
 * empty box, so they become the fallback instead of an error.
 */

/** Why a position could not be obtained. Each maps to its own message. */
export type GeoFailure =
  | 'unsupported' // no geolocation in this browser
  | 'insecure' // needs a secure context (HTTPS, or localhost)
  | 'denied' // the customer refused the permission prompt
  | 'unavailable' // no fix: GPS off, or indoors with no network fix
  | 'timeout'; // the device never reported a position

export interface Coordinates {
  lat: number;
  lng: number;
  /** Radius of the fix in metres; 0 when the device does not report one. */
  accuracy: number;
}

export class GeoError extends Error {
  readonly reason: GeoFailure;

  constructor(reason: GeoFailure) {
    super(`geolocation:${reason}`);
    this.name = 'GeoError';
    this.reason = reason;
  }
}

// A fix older than this is a different street, but reusing a recent one saves
// the customer a second slow lock.
const POSITION_TIMEOUT_MS = 15_000;
const POSITION_MAX_AGE_MS = 60_000;

const GEOCODER_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
const GEOCODER_TIMEOUT_MS = 8_000;

/** `Order.shippingAddressLine1` is a VarChar(255) — never build a longer string. */
export const ADDRESS_MAX = 255;
/** House-number level detail, without the long city/country tail. */
const ADDRESS_DETAIL_MAX = 150;

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.geolocation !== 'undefined';
}

/**
 * Ask the device where it is. Rejects with a {@link GeoError} whose `reason` is
 * safe to show to the customer.
 */
export function getCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new GeoError('unsupported'));
      return;
    }
    // Geolocation is gated on a secure context, so over plain http (a LAN IP,
    // for instance) the browser fails with a generic error unless we say why.
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      reject(new GeoError('insecure'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy ?? 0,
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) reject(new GeoError('denied'));
        else if (error.code === error.TIMEOUT) reject(new GeoError('timeout'));
        else reject(new GeoError('unavailable'));
      },
      {
        enableHighAccuracy: true,
        timeout: POSITION_TIMEOUT_MS,
        maximumAge: POSITION_MAX_AGE_MS,
      },
    );
  });
}

/** The coordinates on their own, for showing or storing a precise pin. */
export function formatPin({ lat, lng }: Coordinates): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/**
 * The best available description of a position: a street address with the exact
 * pin kept alongside it, or just the pin when no address could be resolved.
 */
export async function describePosition(coords: Coordinates, locale: string): Promise<string> {
  const pin = formatPin(coords);
  const street = await reverseGeocode(coords, locale);
  return street ? `${street} (${pin})` : pin;
}

/**
 * Fill in the address without destroying what the customer already typed: an
 * empty field is filled outright, a partly filled one gains the location. The
 * result is clamped to the database column so a long note cannot break the
 * insert.
 */
export function mergeAddress(existing: string, detected: string): string {
  const base = existing.trim();
  if (!base) return detected.slice(0, ADDRESS_MAX);
  if (base.toLowerCase().includes(detected.toLowerCase())) return base;

  const room = ADDRESS_MAX - base.length - 2; // room for the ", " separator
  if (room <= 0) return base;

  const addition =
    detected.length > room ? `${detected.slice(0, room - 1).trimEnd()}…` : detected;
  return `${base}, ${addition}`;
}

/**
 * OpenStreetMap's reverse geocoder. Returns null for every failure mode —
 * blocked by an extension, offline, rate limited, slow — because the caller has
 * a perfectly good fallback and an error would only cost the customer the
 * feature.
 */
async function reverseGeocode({ lat, lng }: Coordinates, locale: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEOCODER_TIMEOUT_MS);

  try {
    const query = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lng),
      zoom: '18', // building level, where the data exists
      addressdetails: '1',
      'accept-language': locale === 'ar' ? 'ar' : 'en',
    });

    const response = await fetch(`${GEOCODER_ENDPOINT}?${query}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as { display_name?: string };
    return tidyDisplayName(payload?.display_name);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Nominatim answers with "12, El-Tahrir St, Downtown, Cairo, Cairo Governorate,
 * Egypt" — repeated names, a redundant country, and more length than the column
 * can take. Keep the first few distinct parts and stop there.
 */
function tidyDisplayName(displayName?: string): string | null {
  if (!displayName) return null;

  const seen = new Set<string>();
  const parts: string[] = [];

  for (const part of displayName.split(',')) {
    const piece = part.trim();
    const key = piece.toLowerCase();
    if (!piece || seen.has(key)) continue;
    seen.add(key);
    parts.push(piece);
    if (parts.length === 4) break;
  }

  if (parts.length === 0) return null;
  return parts.join(', ').slice(0, ADDRESS_DETAIL_MAX);
}
