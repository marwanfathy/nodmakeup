'use client';

import React, { useState, useRef, useEffect, FC } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectFade, A11y } from 'swiper/modules';
import type { Swiper as SwiperCore } from 'swiper';
import Link from 'next/link';
import { getPublicHeroSection, HeroSectionPublic, HeroMediaItemPublic } from '../../lib/api'; 
import './HeroSlider.css';

import 'swiper/css';
import 'swiper/css/effect-fade';

interface HeroSliderProps {
  slug: string;
}

// --- 1. SKELETON COMPONENT ---
const HeroSliderSkeleton = () => {
  return (
    <section className="hero-slider-container skeleton-mode">
      {/* Left Side Skeleton */}
      <div className="hero-slider-content">
        
        {/* Main Title Skeleton */}
        <div className="skeleton-bg skeleton-title-main" style={{ order: 1 }}></div>
        
        {/* Description Skeleton (Desktop only usually) */}
        <div className="skeleton-bg skeleton-desc-main"></div>

        {/* Controls Skeleton */}
        <div className="hero-slider-controls" style={{ order: 2 }}>
          <div className="skeleton-bg skeleton-circle-big"></div>
          <div className="hero-thumbnails">
            <div className="skeleton-bg skeleton-circle-small"></div>
            <div className="skeleton-bg skeleton-circle-small"></div>
            <div className="skeleton-bg skeleton-circle-small"></div>
          </div>
        </div>

        {/* Slide Text Skeleton */}
        <div className="hero-slide-text-wrapper" style={{ order: 4 }}>
          <div className="hero-slide-text-item">
            <div className="skeleton-bg skeleton-slide-title"></div>
            <div className="skeleton-bg skeleton-slide-subtitle"></div>
            <div className="skeleton-bg skeleton-slide-subtitle" style={{ width: '60%' }}></div>
          </div>
        </div>

        {/* Button Skeleton */}
        <div className="skeleton-bg skeleton-button" style={{ order: 5 }}></div>
      </div>

      {/* Right Side Image Skeleton */}
      <div className="hero-slider-image-panel" style={{ order: 3 }}>
        <div className="skeleton-bg skeleton-image-block"></div>
      </div>
    </section>
  );
};

// --- 2. MEDIA ITEM COMPONENT ---
const MediaItem: FC<{ item: HeroMediaItemPublic }> = ({ item }) => {
  const className = `hero-slide-media hero-media-item--${item.layoutStyle.toLowerCase()}`;
  const style = { zIndex: item.displayOrder };

  if (item.mediaType === 'VIDEO') {
    return (
      <video
        key={item.id}
        className={className}
        style={style}
        src={item.mediaUrl}
        autoPlay
        muted
        loop
        playsInline
      />
    );
  }

  return (
    <img
      key={item.id}
      className={className}
      style={style}
      src={item.mediaUrl}
      alt={item.altText || ''}
    />
  );
};

// --- 3. MAIN COMPONENT ---
const HeroSlider: FC<HeroSliderProps> = ({ slug }) => {
  const swiperRef = useRef<SwiperCore | null>(null);
  const [heroData, setHeroData] = useState<HeroSectionPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const fetchHeroData = async () => {
      setLoading(true);
      try {
        const data = await getPublicHeroSection(slug);
        if (!data || !data.slides || data.slides.length === 0) {
          throw new Error("Hero section is empty or not found.");
        }
        setHeroData(data);
      } catch (err) {
        setError('Could not load hero section.');
        console.error(`Failed to fetch hero section with slug "${slug}":`, err);
      } finally {
        setLoading(false);
      }
    };
    fetchHeroData();
  }, [slug]);

  const handleSlideChange = (swiper: SwiperCore) => setActiveIndex(swiper.realIndex);
  const handleThumbnailClick = (index: number) => swiperRef.current?.slideToLoop(index);
  const togglePlayPause = () => {
    if (swiperRef.current?.autoplay.running) {
      swiperRef.current.autoplay.stop();
      setIsPlaying(false);
    } else {
      swiperRef.current?.autoplay.start();
      setIsPlaying(true);
    }
  };

  // --- RENDER SKELETON IF LOADING ---
  if (loading) return <HeroSliderSkeleton />;
  
  if (error) return <div className="hero-slider-placeholder error">{error}</div>;
  if (!heroData) return null;

  const { slides } = heroData;

  return (
    <section className="hero-slider-container">
      <div className="hero-slider-content">
        <h2 className="hero-main-title">{heroData.title}</h2>
        <h2 className="hero-main-desc">{heroData.description}</h2>
        <div className="hero-slider-controls">
          <button className="hero-play-pause" onClick={togglePlayPause}>
            {isPlaying && (
              <svg className="progress-ring" viewBox="0 0 36 36">
                <circle className="progress-background" cx="18" cy="18" r="16" />
                <circle className="progress-bar" cx="18" cy="18" r="16" />
              </svg>
            )}
            <div className="icon">{isPlaying ? '❚❚' : '▶'}</div>
          </button>
          <div className="hero-thumbnails">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                className={`hero-thumbnail ${index === activeIndex ? 'active' : ''}`}
                onClick={() => handleThumbnailClick(index)}
              >
                <img src={slide.thumbnailUrl} alt={slide.title} />
              </button>
            ))}
          </div>
        </div>
        <div className="hero-slide-text-wrapper">
          <div className="hero-slide-text-inner" style={{ transform: `translateY(-${activeIndex * 180}px)` }}>            
            {slides.map(slide => (
              <div key={slide.id} className="hero-slide-text-item">
                <h3 className="hero-slide-title">{slide.title}</h3>
                <p className="hero-slide-subtitle">{slide.subtitle || heroData.description}</p>
              </div>
            ))}
          </div>
        </div>
        <Link href={slides[activeIndex].linkUrl} className="hero-cta-button">
          Shop Now
        </Link>
      </div>

      <div className="hero-slider-image-panel">
        <Swiper
          onSwiper={(swiper) => { swiperRef.current = swiper; }}
          modules={[Autoplay, EffectFade, A11y]}
          loop={slides.length > 1}
          effect="fade"
          fadeEffect={{ crossFade: true }}
          autoplay={{ delay: 5000, disableOnInteraction: false }}
          onSlideChange={handleSlideChange}
          allowTouchMove={false}
          className="hero-swiper-instance"
        >
          {slides.map(slide => (
            <SwiperSlide key={slide.id}>
              <div className="hero-media-composition">
                {slide.mediaItems.map(item => (
                  <MediaItem key={item.id} item={item} />
                ))}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
};

export default HeroSlider;