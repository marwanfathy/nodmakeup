"use client"; // <--- Add this line

import React, { useState, useEffect } from 'react';
import { getHeroProducts, ProductSummary } from '@/lib/api';
import HeroProductCard from './HeroProductCard';
import { useI18n } from '../i18n/client';
import './HeroProductCard.css';

interface HeroSectionProps {
  /**
   * The hero products, already resolved on the server (see app/page.js).
   * `null` falls back to fetching in the browser, exactly as before.
   */
  initialProducts?: ProductSummary[] | null;
}

const HeroProductSection: React.FC<HeroSectionProps> = ({ initialProducts = null }) => {
  const { t } = useI18n();
  // True when the server already resolved this data (an empty list counts as
  // resolved, so the browser does not re-request a genuinely empty section).
  const resolvedOnServer = Array.isArray(initialProducts);

  const [heroProducts, setHeroProducts] = useState<ProductSummary[]>(initialProducts ?? []);
  const [loading, setLoading] = useState<boolean>(!resolvedOnServer);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resolvedOnServer) return;

    const fetchHeroProducts = async () => {
      try {
        setLoading(true);
        const data = await getHeroProducts(); 
        setHeroProducts(data || []);
      } catch (err) {
        console.error("Failed to fetch hero products:", err);
        setError(t('hero.error'));
      } finally {
        setLoading(false);
      }
    };
    
    fetchHeroProducts();
  }, [t, resolvedOnServer]);

  // A weak connection can leave this pending for a long time, so the wait is a
  // skeleton of the real card's shape — never a "Loading..." label, and never a
  // layout jump when the product finally lands.
  if (loading) {
    return (
      <div className="hero-section-container">
        <div className="hero-banner-wrapper">
          <div className="hero-banner-container horizontal-layout" aria-busy="true" aria-live="polite">
            <div className="hero-visual-section">
              <div className="hero-skeleton-visual" />
            </div>
            <div className="hero-info-section">
              <div className="info-content-wrapper">
                <div className="hero-skeleton-line" style={{ width: '80%', height: 28, marginBottom: 12 }} />
                <div className="hero-skeleton-line" style={{ width: '55%', height: 28, marginBottom: 30 }} />
                <div className="hero-skeleton-swatch-row">
                  <div className="hero-skeleton-circle" />
                  <div className="hero-skeleton-circle" />
                  <div className="hero-skeleton-line" style={{ width: 90, height: 14 }} />
                </div>
                <div className="hero-skeleton-cta" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) return <div className="hero-section-container error-message">{error}</div>;
  if (heroProducts.length === 0) return null;

  const primaryHeroProduct = heroProducts[0];

  return (
    <div className="hero-section-container">
      <HeroProductCard product={primaryHeroProduct} />
    </div>
  );
};

export default HeroProductSection;