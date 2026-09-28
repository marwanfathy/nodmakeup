'use client';

import React, { useState, useRef, useEffect, FC } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectFade, A11y } from 'swiper/modules';
import type { Swiper as SwiperCore } from 'swiper';
import Link from 'next/link';
import Image from 'next/image';
import { getPublicHeroSection, HeroSectionPublic, HeroMediaItemPublic, mediaUrl } from '../../../lib/api';
import './HeroSlider.css';

import 'swiper/css';
import 'swiper/css/effect-fade';

interface HeroSliderProps {
  slug: string;
  /**
   * The hero section, already resolved on the server (see app/page.js and
   * lib/server-api.ts). Optional and backward-compatible: when it is absent the
   * component fetches for itself in the browser exactly as it always has, and
   * when it is present the first paint has real slides instead of a skeleton.
   *
   * `null` means the server could not load it, which falls back to the browser
   * fetch. An EMPTY section is not the same as null and is used as-is: a hero
   * with no slides is a real answer from the admin, not a reason to re-request it
   * on every visitor's first load.
   */
  initialData?: HeroSectionPublic | null;
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
        src={mediaUrl(item.mediaUrl)}
        autoPlay
        muted
        loop
        playsInline
      />
    );
  }

  return (
    <Image
      key={item.id}
      className={className}
      style={style}
      src={mediaUrl(item.mediaUrl)}
      alt={item.altText || ''}
      width={2048}
      height={1536}
      sizes="100vw"
      preload
    />
  );
};

// --- 3. MAIN COMPONENT ---
const HeroSlider: FC<HeroSliderProps> = ({ slug, initialData = null }) => {
  const swiperRef = useRef<SwiperCore | null>(null);
  // True when the server already resolved this hero section.
  //
  // null is the ONLY unresolved value, and the test is `!== null` rather than
  // `Array.isArray`: initialData is a single hero-section object, so a resolved
  // hero is object-shaped and never an array. The array test was carried over
  // from the sections that do receive arrays (stories, collections, hero
  // products) and was never true here, which meant every visitor got the skeleton
  // and then a redundant browser fetch that threw away the server's answer.
  //
  // A hero with no slides still counts as resolved, so one the operator
  // deliberately emptied is not re-requested by every browser either.
  const resolvedOnServer = initialData !== null;

  const [heroData, setHeroData] = useState<HeroSectionPublic | null>(initialData);
  const [loading, setLoading] = useState<boolean>(!resolvedOnServer);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (resolvedOnServer || !slug) return;
    const fetchHeroData = async () => {
      setLoading(true);
      try {
        // Resolves to null for a slug with no hero section, which is an ordinary
        // state rather than a fault — the render path below handles it the same
        // way it handles a hero section the operator left empty.
        setHeroData(await getPublicHeroSection(slug));
      } catch (err) {
        // Only a genuine 5xx or network failure gets here, so it is worth both an
        // error state and a log.
        setError('Could not load hero section.');
        console.error(`Failed to fetch hero section with slug "${slug}":`, err);
      } finally {
        setLoading(false);
      }
    };
    fetchHeroData();
  }, [slug, resolvedOnServer]);

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

  // No hero section for this slug. The layout can name one that was never created
  // or that has been deactivated, and the public route answers 404 for both — an
  // answer, not a failure, so it gets the same placeholder as an empty section
  // rather than a silent blank. The registry normally falls back to the product
  // hero before this is reached; this covers the slider on its own.
  if (!heroData) {
    return <div className="hero-slider-placeholder error">No hero section for this page.</div>;
  }

  const { slides } = heroData;

  // A hero section that EXISTS but has no slides is a different case, and kept
  // distinct on purpose: the operator made a hero section and left it empty, and
  // quietly rendering something else would hide that. Rendering it here would
  // mount a carousel with zero slides, so it gets a placeholder instead.
  if (slides.length === 0) {
    return <div className="hero-slider-placeholder error">No slides in this hero section.</div>;
  }

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
                <Image src={mediaUrl(slide.thumbnailUrl)} alt={slide.title} width={50} height={50} sizes="50px" />
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