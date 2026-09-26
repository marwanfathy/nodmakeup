"use client";

import { mediaUrl } from "../../lib/api";
import Image from 'next/image';
import { useI18n } from "../i18n/client";
import { localePath } from "../i18n/paths";
import Link from "next/link";
import "./Lan_banner.css";

// Replace with your actual image path (absolute via mediaUrl)
const BannerImg = mediaUrl('/uploads/images/WhatsApp Image 2026-04-08 at 4.52.06 AM(1).jpeg')

const Lan_Banner = () => {
  const { locale, t } = useI18n();
  return (
    <div className="lan-banner-wrapper"> {/* New wrapper for outer spacing */}
      <div className="lan-banner-container">
        <Image
          className="lan-banner-img"
          src={BannerImg}
          alt="node Banner"
          width={2048}
          height={1536}
          sizes="100vw"
          preload
        />
        
        <div className="lan-banner-overlay">
          <p className="lan-tagline">{t('banner.tagline')}</p>
          <h1 className="lan-title">{t('banner.title')}</h1>
          <Link href={localePath('/shop', locale)} className="lan-pill-button">{t('banner.cta')}</Link>
        </div>
      </div>
    </div>
  );
};

export default Lan_Banner;