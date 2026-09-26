'use client';

import React, { useState, useEffect, FC } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, A11y } from 'swiper/modules';
import ProductCard from "../ProductCard/ProductCard";
import { ProductCardSkeleton } from '../ProductCard/ProductCardSkeleton';
// FIX: Imported 'ProductSummary' instead of the non-existent 'CollectionPoduct'
import { getPublicCollectionBySlug, ProductSummary } from '../../lib/api';
import { useScreenSize } from '../../lib/useScreenSize'; 
import { useI18n } from '../i18n/client'; 

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import './LandingPageProductSlider.css';

interface ProductCollectionSliderProps {
  slug: string;
  title?: string;
  forceTitle?: boolean;
}

const ProductCollectionSlider: FC<ProductCollectionSliderProps> = ({ slug, title, forceTitle = false }) => {
  const { t } = useI18n();
  const [collectionName, setCollectionName] = useState<string>(title || 'Featured Products');
  // FIX: Updated state type to use ProductSummary
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- Read the screen dimensions and size the slider to them ---
  // Same tiers as the old Swiper breakpoints (<640, 640, 768, 1024, 1280),
  // now driven straight from the live viewport width.
  const { width: screenWidth } = useScreenSize();
  const slidesPerView =
    screenWidth < 640 ? 2.2 /* zoomed out more on phones */
    : screenWidth < 768 ? 2
    : screenWidth < 1024 ? 3
    : screenWidth < 1280 ? 4
    : 5;
  const spaceBetween = screenWidth < 640 ? 16 : screenWidth < 768 ? 20 : 30;

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError(t('slider.noSlug'));
      return;
    }

    const fetchCollectionData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getPublicCollectionBySlug(slug);
        setCollectionName(
          forceTitle && title
            ? title
            : response.collection.name || title || t('slider.featured')
        );
        setProducts(response.products || []);
      } catch (err: unknown) {
        console.error(`Error fetching collection with slug '${slug}':`, err);
        const status =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { status?: number } }).response?.status
            : undefined;
        const errorMessage = status === 404 
          ? t('slider.notFound', { slug })
          : t('slider.loadError');
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
      return <p className="slider-placeholder">{t('slider.empty')}</p>;
    }

    return (
      <Swiper
        className="product-swiper"
        modules={[Navigation, Pagination, A11y]}
        slidesPerView={slidesPerView}
        spaceBetween={spaceBetween}
        centeredSlides={false}
        centerInsufficientSlides={true}
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