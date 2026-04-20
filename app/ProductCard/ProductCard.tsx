'use client';

import React, { FC, useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ProductSummary } from '../../lib/api';
import { useCart } from '../contexts/CartContext';
import { ProductCardSkeleton } from './ProductCardSkeleton';
import './ProductCard.css';

interface ProductCardProps {
  product: ProductSummary;
}

const KikoProductCard: FC<ProductCardProps> = ({ product }) => {
  const { addItemToCart } = useCart();
  
  // States for button interaction
  const [addState, setAddState] = useState<'idle' | 'adding' | 'added'>('idle');

  const defaultVariant = product?.variants?.[0] || null;
  const otherVariantsCount = Math.max(0, (product?.variants?.length || 0) - 1);

  // --- Price & Discount Logic ---
  const { displayPrice, originalPrice, isOnSale, discountPercentage } = useMemo(() => {
    if (!defaultVariant) {
      return { displayPrice: 0, originalPrice: 0, isOnSale: false, discountPercentage: 0 };
    }
    const salePrice = defaultVariant.effectiveSalePrice;
    const basePrice = defaultVariant.price;
    const onSale = typeof salePrice === 'number' && salePrice < basePrice;

    return {
      displayPrice: onSale ? salePrice : basePrice,
      originalPrice: basePrice,
      isOnSale: onSale,
      // Calculate discount percentage logic
      discountPercentage: onSale ? Math.round(((basePrice - salePrice) / basePrice) * 100) : 0,
    };
  }, [defaultVariant]);

  // --- Handle Add to Cart with Feedback ---
  const handleAddToCart = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!defaultVariant) {
      return;
    }

    setAddState('adding');
    
    try {
      await addItemToCart(defaultVariant.id, 1);
      
      // Show success state
      setAddState('added');
      
      // Revert to idle after 2 seconds
      setTimeout(() => {
        setAddState('idle');
      }, 2000);
    } catch (error) {
      console.error("Failed to add to cart", error);
      setAddState('idle'); // Return to normal on error
    }
  };

  if (!product || !defaultVariant) {
     return <ProductCardSkeleton />;
  }

  return (
    <div className="kiko-product-card">
      <Link href={`/product/${product.slug}`} className="kiko-product-card__main-link">
        <div className="kiko-product-card__image-wrapper">
          
          {/* 1. SALE BADGE (P0 Priority: Clear Value Prop) */}
          {isOnSale && discountPercentage > 0 && (
            <span className="kiko-badge-sale">Save {discountPercentage}%</span>
          )}
          
          {/* Keep Bestseller if needed, but Sale is usually more important for conversion */}
          {!isOnSale && product.isBestseller && (
            <div className="kiko-product-card__bestseller-tag">
              <span>BESTSELLER</span>
            </div>
          )}

          <img
            src={defaultVariant.imageUrl || '/default-image.png'}
            alt={product.name}
            className="kiko-product-card__image"
            loading="lazy"
          />
        </div>

        <div className="kiko-product-card__details">
          {/* 2. TRUST SIGNALS (P0 Priority: Ratings) */}
          {/* Placeholder for ratings - Connect this to product.rating if available */}

          <h3 className="kiko-product-card__name">{product.name}</h3>
          <p className="kiko-product-card__description">{product.shortDescription}</p>
          
          {/* 3. PRICE VISIBILITY (P1 Priority: Typography) */}
          <div className="kiko-product-card__price">
            {isOnSale && (
              <span className="kiko-product-card__price--original">
                EGP {originalPrice.toLocaleString()}
              </span>
            )}
            <span className={`kiko-product-card__price--current ${isOnSale ? 'sale-color' : ''}`}>
              EGP {displayPrice.toLocaleString()}
            </span>
          </div>
        </div>
      </Link>

      {/* --- VARIANT SECTION --- */}
      <div className="kiko-product-card__variant-wrapper">
        {otherVariantsCount > 0 && (
          <Link href={`/product/${product.slug}`} className="kiko-product-card__variant-selector">
            <div className="selector-left">
              <div 
                className={`mini-color-swatch ${!defaultVariant.hexCode ? 'no-color' : ''}`}
                style={{ backgroundColor: defaultVariant.hexCode || undefined }} 
              />
              <span className="variant-name">
                {defaultVariant.colorName || 'Default Shade'}
              </span>
            </div>
            <div className="selector-right">
              <span className="variant-count">+{otherVariantsCount}</span>
              <span className="variant-arrow">&gt;</span>
            </div>
          </Link>
        )}
      </div>

      {/* 4. CTA FEEDBACK (P0 Priority: Visual confirmation) */}
      <div className="kiko-product-card__cta-container">
        <button
          onClick={handleAddToCart}
          className={`kiko-product-card__cta-button ${addState}`}
          disabled={addState !== 'idle'}
        >
          {addState === 'idle' && 'ADD TO BAG'}
          {addState === 'adding' && 'ADDING...'}
          {addState === 'added' && 'ADDED'}
        </button>
      </div>
    </div>
  );
};

export default KikoProductCard;