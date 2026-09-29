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
  | 'denied' // refused: the prompt was dismissed, or the browser/OS blocks it
  | 'unavailable' // no fix: location services off, or nothing in range
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
const POSITION_MAX_AGE_MS = 60_000;

// Split so the precise attempt gets the time it needs to actually lock onto the
// satellites, while the fallback on a device with no GPS radio still gets long
// enough to answer from the network rather than timing out as well.
const PRECISE_POSITION_TIMEOUT_MS = 12_000;
const COARSE_POSITION_TIMEOUT_MS = 6_000;

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
 *
 * Precision is asked for first, because the address a driver ends up reading is
 * only ever as good as the fix behind it. Network positioning on its own can be
 * hundreds of metres out in a city — several streets — and that is the single
 * biggest cause of a delivery address pointing at the wrong house. So a
 * GPS-grade fix is requested, with the larger share of the time budget.
 *
 * If the device has no GPS radio at all — a laptop, a desktop — that request
 * cannot be satisfied and the browser eventually gives up. Rather than leaving
 * the button dead on those machines, a second attempt asks for the network fix.
 * The retry is only reached when the first attempt failed for a reason more
 * coordinates could fix; a refusal is never retried, because the answer would be
 * the same refusal and the customer would just watch the spinner twice for
 * nothing.
 */
export function getCurrentPosition(): Promise<Coordinates> {
  if (!isGeolocationSupported()) return Promise.reject(new GeoError('unsupported'));

  // Geolocation is gated on a secure context, so over plain http (a LAN IP,
  // for instance) the browser fails with a generic error unless we say why.
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return Promise.reject(new GeoError('insecure'));
  }

  return requestPosition({
    enableHighAccuracy: true,
    timeout: PRECISE_POSITION_TIMEOUT_MS,
    maximumAge: POSITION_MAX_AGE_MS,
  }).catch((error: unknown) => {
    if (!(error instanceof GeoError)) throw error;
    if (error.reason !== 'unavailable' && error.reason !== 'timeout') throw error;

    return requestPosition({
      enableHighAccuracy: false,
      timeout: COARSE_POSITION_TIMEOUT_MS,
      maximumAge: POSITION_MAX_AGE_MS,
    }).catch((fallback: unknown) => {
      // A refusal on the retry is the real answer and outranks the first
      // attempt's "no fix" -- it is what the customer needs to be told.
      if (fallback instanceof GeoError && fallback.reason === 'denied') throw fallback;
      throw error;
    });
  });
}

/** One `getCurrentPosition` call, normalised into this module's own types. */
function requestPosition(options: PositionOptions): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy ?? 0,
        }),
      (error) => {
        // The three codes are fixed by the spec: 1 PERMISSION_DENIED,
        // 2 POSITION_UNAVAILABLE, 3 TIMEOUT. Compared as numbers rather than as
        // `error.PERMISSION_DENIED`, because that is a property on the prototype
        // and reading it off the instance is one more thing that can be undefined
        // in a browser we have not tested on.
        if (error.code === 1) reject(new GeoError('denied'));
        else if (error.code === 3) reject(new GeoError('timeout'));
        else reject(new GeoError('unavailable'));
      },
      options,
    );
  });
}

/** The coordinates on their own, for showing or storing a precise pin. */
export function formatPin({ lat, lng }: Coordinates): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** A resolved position: what to show, and which places it sits inside. */
export interface LocatedPlace {
  /**
   * A street address a driver can read, with the exact pin kept alongside it, or
   * just the pin when no address could be resolved.
   */
  address: string;
  /**
   * Place names the fix falls inside, most authoritative first. Nominatim calls
   * the governorate `state`, and for a delivery area that is the one that
   * matters — but the city is kept too, because a shopper often thinks in terms
   * of the city and the two do not always agree.
   */
  places: string[];
}

/**
 * The best available description of a position, plus the places it belongs to.
 *
 * Both come from one request: asking twice would double the wait on a button
 * whose slowest part is already the permission prompt, against a public service
 * that rate-limits.
 */
export async function locateFix(coords: Coordinates, locale: string): Promise<LocatedPlace> {
  const pin = formatPin(coords);
  const found = await reverseGeocode(coords, locale);
  return {
    address: found?.displayName ? `${found.displayName} (${pin})` : pin,
    places: found?.places ?? [],
  };
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

/** What the geocoder gives back that the checkout actually uses. */
interface GeocodeResult {
  /** Tidied, length-capped address for the address field. */
  displayName: string | null;
  /** Governorate, city, town… in the order Nominatim considers most specific first. */
  places: string[];
}

/**
 * OpenStreetMap's reverse geocoder. Returns null for every failure mode —
 * blocked by an extension, offline, rate limited, slow — because the caller has
 * a perfectly good fallback and an error would only cost the customer the
 * feature.
 */
/**
 * How much detail the geocoder is entitled to claim, given how good the fix is.
 *
 * This is the difference between an address that is right and one that merely
 * looks right. Nominatim at zoom 18 answers with a specific house number and a
 * building name, and it answers *confidently* for any coordinate it is handed —
 * including one that is four streets out. A network-derived fix in a city as
 * dense as Cairo is routinely that far out, so a hard-coded zoom of 18 converts
 * ordinary location error into a precise-looking address for the wrong
 * building. That is the worst outcome available: the customer reads the field
 * back, believes it, and a driver is sent to the wrong house.
 *
 * So the zoom is derived from the radius the device actually reported. A fix
 * good to a few metres earns a house number; a fix good to a kilometre gets an
 * honest "somewhere around here" answer instead of a fabricated one. The pin
 * is kept either way, so the precision that does exist is never thrown away.
 */
function zoomForAccuracy(accuracy: number): number {
  // 0 means the device declined to say, not that the fix is perfect.
  if (!Number.isFinite(accuracy) || accuracy <= 0) return 12;
  if (accuracy <= 30) return 18; // house number and building
  if (accuracy <= 100) return 17; // street
  if (accuracy <= 300) return 16; // street and surrounding blocks
  if (accuracy <= 1_000) return 15; // neighbourhood
  if (accuracy <= 5_000) return 13; // suburb
  return 11; // city
}

async function reverseGeocode(
  { lat, lng, accuracy }: Coordinates,
  locale: string,
): Promise<GeocodeResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEOCODER_TIMEOUT_MS);

  try {
    const query = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lng),
      // Building level, but only where the fix is good enough to justify it.
      zoom: String(zoomForAccuracy(accuracy)),
      addressdetails: '1',
      'accept-language': locale === 'ar' ? 'ar' : 'en',
    });

    const response = await fetch(`${GEOCODER_ENDPOINT}?${query}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as NominatimResponse;
    return {
      displayName: tidyDisplayName(payload?.display_name),
      places: collectPlaces(payload?.address),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The subset of Nominatim's address object this feature reads. */
interface NominatimResponse {
  display_name?: string;
  address?: Partial<Record<PlaceKey, string>>;
}

/** Ordered most to least authoritative: the governorate decides delivery. */
type PlaceKey = 'state' | 'city' | 'town' | 'village' | 'county' | 'state_district';

const PLACE_KEYS: readonly PlaceKey[] = ['state', 'city', 'town', 'village', 'county', 'state_district'];

/**
 * The place names a fix belongs to, most authoritative first and without
 * duplicates, so a caller can take the first one it recognises.
 */
function collectPlaces(address?: Partial<Record<PlaceKey, string>>): string[] {
  if (!address) return [];
  const seen = new Set<string>();
  const places: string[] = [];
  for (const key of PLACE_KEYS) {
    const value = address[key]?.trim();
    if (!value) continue;
    const normalized = normalizePlaceName(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    places.push(value);
  }
  return places;
}

/**
 * Words that name a level of government rather than a place. The geocoder
 * decorates them inconsistently — "Cairo" in one place, "Cairo Governorate" in
 * another, "محافظة القاهرة" in Arabic — and the delivery zones are named after
 * the bare place, so the decoration is dropped before comparing.
 */
const ADMINISTRATIVE_WORDS = ['governorate', 'gouvernorat', 'محافظة', 'إمارة'];

/**
 * Reduce a place name to something two spellings of the same place share:
 * case, Arabic diacritics and tatweel, the alef/ya/ta-marbuta variants, and any
 * administrative word wrapped around the name.
 */
export function normalizePlaceName(raw: string): string {
  let value = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // latin diacritics
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // arabic marks, tatweel
    .replace(/[أإآٱ]/g, '\u0627') // alef variants
    .replace(/\u0649/g, '\u064A') // alef maqsura
    .replace(/\u0629/g, '\u0647') // ta marbuta
    .toLowerCase()
    .trim();

  for (const word of ADMINISTRATIVE_WORDS) {
    value = value
      .replace(new RegExp(`(^|\\s)${word}(?=\\s|$)`, 'g'), ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // The Arabic definite article. Nobody types or searches "القاهرة" when they
  // mean "قاهره", and the geocoder may return either. Only stripped when
  // something substantial remains, so a name that genuinely starts with those
  // letters is not gutted.
  value = value.replace(/^ال(?=.{3,})/, '');

  return value;
}

/**
 * Whether a place the geocoder reported is the same place as one of the names a
 * delivery zone answers to.
 *
 * Deliberately exact after normalizing. A loose "contains" match would put a
 * fix in the wrong delivery zone, and the shopper would find out from the
 * shipping price rather than from us — so an unrecognized place is left
 * unselected and the customer chooses, which is the honest outcome.
 */
export function matchesPlace(place: string, candidates: readonly string[]): boolean {
  const target = normalizePlaceName(place);
  if (!target) return false;
  return candidates.some((candidate) => normalizePlaceName(candidate) === target);
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
