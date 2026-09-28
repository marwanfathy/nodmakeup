"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ProductSummary, mediaUrl } from '@/lib/api';
import { useI18n } from '../../../lib/i18n/client';
import { localePath } from '../../../lib/i18n/paths';
import { pickLocale } from '../../../lib/format';
import './HeroProductCard.css';

interface HeroProductCardProps {
  product: ProductSummary;
}

const HeroProductCard: React.FC<HeroProductCardProps> = ({ product }) => {
  const { locale, t } = useI18n();
  if (!product) return null;

  const localized = pickLocale(product, locale);
  const primaryVariant = product.variants?.[0];
  const displayImage = mediaUrl(primaryVariant?.imageUrl) || '/default-image.png';

  return (
    <div className="hero-banner-wrapper">
      <div className="hero-banner-container horizontal-layout">
        
        {/* LEFT SECTION: Pink Circle & Product */}
        <div className="hero-visual-section">
          <Image
            src={displayImage}
            alt={localized.name}
            className="hero-product-image"
            width={971}
            height={1619}
            sizes="(max-width: 768px) 90vw, 40vw"
            preload
          />
        </div>

        {/* RIGHT SECTION: Text & Actions */}
        <div className="hero-info-section">
          <div className="info-content-wrapper">
            <p className="hero-description">
              {localized.shortDescription || t('herocard.descFallback')}{' '}
              {/* Only tag an Arabic highlight when the sentence is actually
                  Arabic; otherwise keep "shine." so we never mix languages. */}
              <span className="highlight-text">
                {localized.hasArabic ? t('herocard.descHighlight') : t('herocard.descHighlightEn')}
              </span>
            </p>

            {/* Swatches & Divider Row */}
            <div className="swatch-divider-row">
              <div className="swatch-group">
                {product.variants?.slice(0, 3).map((v, i) => (
                  <div 
                    key={v.id} 
                    className="swatch-circle" 
                    style={{ backgroundColor: v.hexCode || '', zIndex: 3-i }} 
                  />
                ))}
              </div>
              
              <div className="vertical-divider"></div>
              
              <p className="swatch-label">{t('herocard.explore1')} <br/> {t('herocard.explore2')}</p>
            </div>

            {/* CTA Section with Decorative Arrows */}
            <div className="cta-wrapper">
              <div className="decor-arrow arrow-left"></div>
              <Link href={localePath(`/product/${product.slug}`, locale)} className="add-to-bag-btn">
                {t('herocard.buyNow')}
              </Link>
              <div className="decor-arrow arrow-right"></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default HeroProductCard;