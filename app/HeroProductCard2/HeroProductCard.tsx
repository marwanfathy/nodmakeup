"use client";

import React from 'react';
import Link from 'next/link';
import { ProductSummary } from '@/lib/api';
import './HeroProductCard.css';

interface HeroProductCardProps {
  product: ProductSummary;
}

const HeroProductCard: React.FC<HeroProductCardProps> = ({ product }) => {
  if (!product) return null;

  const primaryVariant = product.variants?.[0];
  const displayImage = primaryVariant?.imageUrl || '/default-image.png';

  return (
    <div className="hero-banner-wrapper">
      <div className="hero-banner-container horizontal-layout">
        
        {/* LEFT SECTION: Pink Circle & Product */}
        <div className="hero-visual-section">
          <img src={displayImage} alt={product.name} className="hero-product-image" />
        </div>

        {/* RIGHT SECTION: Text & Actions */}
        <div className="hero-info-section">
          <div className="info-content-wrapper">
            <p className="hero-description">
              {product.shortDescription || "Ultra-hydrating lip oils infused with botanical extracts for a natural, glass-like"} 
              <span className="highlight-text"> shine.</span>
            </p>

            {/* Swatches & Divider Row */}
            <div className="swatch-divider-row">
              <div className="swatch-group">
                {product.variants?.slice(0, 3).map((v, i) => (
                  <div 
                    key={v.id} 
                    className="swatch-circle" 
                    style={{ backgroundColor: v.hexCode || '#ffb6c1', zIndex: 3-i }} 
                  />
                ))}
              </div>
              
              <div className="vertical-divider"></div>
              
              <p className="swatch-label">explore the colors <br/> options NOW!</p>
            </div>

            {/* CTA Section with Decorative Arrows */}
            <div className="cta-wrapper">
              <div className="decor-arrow arrow-left"></div>
              <Link href={`/product/${product.slug}`} className="add-to-bag-btn">
                BUY NOW
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