import React from 'react';
import './ProductCardSkeleton.css';

export const ProductCardSkeleton = () => {
  return (
    /*
     * The same element tree as ProductCard — main-link wrapping photo + details,
     * then the pill row, then the CTA — with each band at the height of the real
     * one. The loading state therefore occupies exactly the rows the content
     * will take, and nothing shifts when it arrives.
     */
    <div className="nod-product-card skeleton-card">
      {/* 1. Image placeholder */}
      <div className="nod-product-card__main-link">
        <div className="nod-product-card__image-wrapper skeleton-bg"></div>

        {/* 2. Text placeholder — name, description, price, in card order */}
        <div className="nod-product-card__details">
          <div className="skeleton-text skeleton-name skeleton-bg"></div>
          <div className="skeleton-text skeleton-desc">
            <span className="skeleton-line skeleton-bg"></span>
            <span className="skeleton-line skeleton-bg"></span>
          </div>
          <div className="skeleton-text skeleton-price skeleton-bg"></div>
        </div>
      </div>

      {/* 3. Variant selector placeholder — the wrapper keeps the row height */}
      <div className="nod-product-card__variant-wrapper">
        <div className="skeleton-pill skeleton-bg"></div>
      </div>

      {/* 4. CTA placeholder */}
      <div className="nod-product-card__cta-container">
        <div className="skeleton-button skeleton-bg"></div>
      </div>
    </div>
  );
};
