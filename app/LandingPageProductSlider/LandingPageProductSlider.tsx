'use client';

import React, { useState, useEffect, FC } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, A11y } from 'swiper/modules';
import ProductCard from "../ProductCard/ProductCard";
import { ProductCardSkeleton } from '../ProductCard/ProductCardSkeleton';
// FIX: Imported 'ProductSummary' instead of the non-existent 'CollectionPoduct'
import { getPublicCollectionBySlug, ProductSummary } from '../../lib/api'; 

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import './LandingPageProductSlider.css';

interface ProductCollectionSliderProps {
  slug: string;
  title?: string;
}

const ProductCollectionSlider: FC<ProductCollectionSliderProps> = ({ slug, title }) => {
  const [collectionName, setCollectionName] = useState<string>(title || 'Featured Products');
  // FIX: Updated state type to use ProductSummary
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError("No collection slug was provided to the component.");
      return;
    }

    const fetchCollectionData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getPublicCollectionBySlug(slug);
        setCollectionName(response.collection.name || title || 'Featured Products');
        setProducts(response.products || []);
      } catch (err: any) {
        console.error(`Error fetching collection with slug '${slug}':`, err);
        const errorMessage = err.response?.status === 404 
          ? `Sorry, the collection '${slug}' could not be found.`
          : 'Could not load this collection. Please try again later.';
        setError(errorMessage);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCollectionData();
  }, [slug, title]);

  const renderContent = () => {
    if (loading) {
      // --- SKELETON LOADING STATE ---
      return (
        <div className="product-slider-loading-grid">
          {[...Array(5)].map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      );
    }

    if (error) {
      return <p className="error-message">{error}</p>;
    }

    if (products.length === 0) {
      return <p className="slider-placeholder">No products found in this collection.</p>;
    }

    return (
      <Swiper
        className="product-swiper"
        modules={[Navigation, Pagination, A11y]}
        
        // --- MOBILE DEFAULTS (< 640px) ---
        slidesPerView={1.3} 
        spaceBetween={16}   
        centeredSlides={false}
        centerInsufficientSlides={true}

        // --- RESPONSIVE BREAKPOINTS ---
        breakpoints={{
          640: { slidesPerView: 2, spaceBetween: 20 },
          768: { slidesPerView: 3, spaceBetween: 30 },
          1024: { slidesPerView: 4, spaceBetween: 30 },
          1280: { slidesPerView: 5, spaceBetween: 30 },
        }}
      >
        {products.map((product) => (
          <SwiperSlide key={product.id}>
            <ProductCard product={product} />
          </SwiperSlide>
        ))}
      </Swiper>
    );
  };

  return (
    <div className="landing-product-slider-container">
      <h2 className="slider-title">
        {loading ? <span className="skeleton-title"></span> : collectionName}
      </h2>
      <div className="product-slider">
        {renderContent()}
      </div>
    </div>
  );
};

// --- STYLES ---
const LoadingGridStyles = () => (
  <style jsx global>{`
    /* 1. Skeleton Grid Layout */
    .product-slider-loading-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      padding-bottom: 40px;
    }

    /* 2. Skeleton Title */
    .skeleton-title {
      display: inline-block;
      width: 200px;
      height: 24px;
      background-color: #f0f0f0;
      border-radius: 4px;
    }

    /* --- RESPONSIVE BREAKPOINTS FOR GRID --- */
    @media (min-width: 768px) {
      .product-slider-loading-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 30px;
      }
    }
    @media (min-width: 1024px) {
      .product-slider-loading-grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }
    @media (min-width: 1280px) {
      .product-slider-loading-grid {
        grid-template-columns: repeat(5, 1fr);
      }
    }

    /* --- CRITICAL MOBILE FIXES (Applied Globally) --- */
    @media (max-width: 768px) {
      /* Fix the container margins */
      .landing-product-slider-container {
        margin: 2rem auto !important;
        padding-left: 10px;
        padding-right: 10px;
        width: 100%;
        box-sizing: border-box;
      }

      /* Fix the huge title font size */
      .slider-title {
        font-size: 2.2rem !important;
        margin-bottom: 1.5rem !important;
        font-weight: 400 !important;
      }

      /* Hide Navigation Arrows on Mobile */
      .product-swiper .swiper-button-next,
      .product-swiper .swiper-button-prev {
        display: none !important;
      }
    }
  `}</style>
);

const ProductCollectionSliderWithStyles = (props: ProductCollectionSliderProps) => (
  <>
    <ProductCollectionSlider {...props} />
    <LoadingGridStyles />
  </>
);

export default ProductCollectionSliderWithStyles;