/**
 * Just enough knowledge of the platform to tell a customer where the switch is.
 *
 * The only thing this decides is *which recovery steps to show* after a
 * location refusal — never whether geolocation is permitted. That split is the
 * whole point: being wrong about a sentence costs one customer a confusing
 * instruction, whereas being wrong about permission would cost the feature. So
 * the blunt instrument is fine here and is confined to here.
 *
 * Apple is one bucket rather than several. Safari is Safari on an iPhone, an iPad
 * and a Mac, iPadOS reports itself as a Mac, and all three put the per-site
 * permission behind the same page controls in the address bar. Splitting them
 * would produce three near-identical sentences and a fourth branch to keep
 * honest.
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
}
