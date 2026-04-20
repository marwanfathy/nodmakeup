'use client';

import React, { FC } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, A11y } from 'swiper/modules'; // Removed Navigation
import { ProductSummary } from '../../lib/api'; 
import ProductCard from '../ProductCard/ProductCard'; 
import { ProductCardSkeleton } from '../ProductCard/ProductCardSkeleton';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination'; // Removed swiper/css/navigation

// Import our updated CSS
import './RelatedProductsSlider.css';

interface Props {
    products: ProductSummary[];
    isLoading?: boolean;
}

const RelatedProductsSlider: FC<Props> = ({ products, isLoading }) => {

    const renderContent = () => {
        // --- 1. SKELETON LOADING STATE ---
        if (isLoading) {
            return (
                <div className="related-slider-loading-grid">
                    {[...Array(5)].map((_, index) => (
                        <div key={index} className="related-skeleton-wrapper">
                             <ProductCardSkeleton />
                        </div>
                    ))}
                </div>
            );
        }

        // --- 2. EMPTY STATE ---
        if (!products || products.length === 0) {
            return null;
        }

        // --- 3. ACTUAL SLIDER ---
        return (
            <Swiper
                className="related-product-swiper"
                modules={[Pagination, A11y]} // No Navigation module
                spaceBetween={16}
                slidesPerView={1.3}
                grabCursor={true} // Changes cursor to hand, indicates draggable
                centerInsufficientSlides={true} // Centers slides if there are fewer than slidesPerView
                pagination={{ clickable: true, dynamicBullets: true }} 
                breakpoints={{
                    640: { slidesPerView: 2, spaceBetween: 20 },
                    768: { slidesPerView: 3, spaceBetween: 25 },
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

    if (!isLoading && (!products || products.length === 0)) return null;

    return (
        <div className="related-product-slider-container">
            <h2 className="related-slider-title">
                You Might Also Like
            </h2>
            <div className="related-slider-content">
                {renderContent()}
            </div>
        </div>
    );
};

export default RelatedProductsSlider;