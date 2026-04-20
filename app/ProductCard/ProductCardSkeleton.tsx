import React from 'react';
import './ProductCardSkeleton.css';

export const ProductCardSkeleton = () => {
  return (
    <div className="kiko-product-card skeleton-card">
      
      {/* 1. Image Placeholder */}
      <div className="kiko-product-card__image-wrapper skeleton-bg"></div>

      {/* 2. Text Details Placeholder */}
      <div className="kiko-product-card__details">
        {/* Description lines */}
        <div className="skeleton-text skeleton-desc skeleton-bg"></div>
        <div className="skeleton-text skeleton-desc-short skeleton-bg"></div>
        
        {/* Product Name */}
        <div className="skeleton-text skeleton-name skeleton-bg"></div>
        
        {/* Price */}
        <div className="skeleton-text skeleton-price skeleton-bg"></div>
      </div>

      {/* 3. Variant Selector Placeholder */}
      {/* We keep the wrapper so the spacing matches exactly */}
      <div className="kiko-product-card__variant-wrapper">
        <div className="skeleton-pill skeleton-bg"></div>
      </div>

      {/* 4. CTA Button Placeholder */}
      <div className="kiko-product-card__cta-container">
        <div className="skeleton-button skeleton-bg"></div>
      </div>
      
    </div>
  );
};