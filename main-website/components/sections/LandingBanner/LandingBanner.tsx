"use client";

import { mediaUrl } from "../../../lib/api";
import type { LandingBanner } from "../../../lib/api";
import Image from 'next/image';
import { useI18n } from "../../../lib/i18n/client";
import { localePath } from "../../../lib/i18n/paths";
import Link from "next/link";
import "./LandingBanner.css";

// The banner as it shipped, kept as the fallback for when the admin has not
// saved one (or the API is unreachable). Every homepage visitor still gets a
// complete, correctly-worded banner in both languages with no admin action at
// all, which is why this is a real fallback rather than an empty box.
//
// This is also the one homepage section with no client-side fetch of its own.
// Stories, Hero and Collections all re-request in the browser when their
// `initial*` prop is null, because they have nothing to show until data
// arrives. The banner does: it has this copy. A refetch would fire on every page
// load for the whole minute the API is down, and could not succeed when the
// server-side read of the same endpoint had just failed.
const FALLBACK_IMAGE = '/uploads/images/WhatsApp Image 2026-04-08 at 4.52.06 AM(1).jpeg';

type LanBannerProps = {
  /** Resolved on the server; null when no banner is live or the fetch failed. */
  initialBanner?: LandingBanner | null;
};

const Lan_Banner = ({ initialBanner = null }: LanBannerProps) => {
  const { locale, t } = useI18n();
  const isArabic = locale === 'ar';

  // Resolved per string, not per row, so one untranslated line does not cost the
  // whole banner its Arabic. This is the same fallback rule lib/format.ts applies
  // to Product.nameAr, which is why the Arabic columns are optional upstream.
  const pick = (english?: string | null, arabic?: string | null) =>
    isArabic ? arabic || english : english;

  const tagline = pick(initialBanner?.tagline, initialBanner?.taglineAr) ?? t('banner.tagline');
  const title = pick(initialBanner?.title, initialBanner?.titleAr) ?? t('banner.title');
  const ctaLabel = pick(initialBanner?.ctaLabel, initialBanner?.ctaLabelAr) ?? t('banner.cta');

  // The backend already rejects a ctaUrl that is not a root-relative path, and
  // localePath prefixes the locale, so an admin can link to /shop and both /en
  // and /ar resolve correctly without the operator writing the prefix.
  const ctaHref = localePath(initialBanner?.ctaUrl || '/shop', locale);
  const imageSrc = mediaUrl(initialBanner?.imageUrl || FALLBACK_IMAGE);

  // Empty alt by default, not the old hardcoded "node Banner". The headline and
  // button are real text sitting on top of the photo, so a screen reader already
  // announces the banner's message; describing the image as well would read the
  // campaign out twice. An admin who supplies alt text gets it used.
  const imageAlt = initialBanner?.imageAlt ?? '';

  return (
    <div className="lan-banner-wrapper"> {/* New wrapper for outer spacing */}
      <div className="lan-banner-container">
        <Image
          className="lan-banner-img"
          src={imageSrc}
          alt={imageAlt}
          width={2048}
          height={1536}
          sizes="100vw"
          preload
        />

        <div className="lan-banner-overlay">
          <p className="lan-tagline">{tagline}</p>
          <h1 className="lan-title">{title}</h1>
          <Link href={ctaHref} className="lan-pill-button">{ctaLabel}</Link>
        </div>
      </div>
    </div>
  );
};

export default Lan_Banner;
