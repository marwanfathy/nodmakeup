'use client';

import React, { useState, useEffect, useRef, useCallback, FC } from 'react';
import { ProductImage } from '../../lib/api'; // Adjust path to your api.ts file
import './ProductImageGallery.css'; // Your existing CSS for the gallery

// 1. DEFINE THE COMPONENT'S PROPS WITH TYPESCRIPT
interface ProductImageGalleryProps {
  images: ProductImage[];
  productName: string;
}

const ProductImageGallery: FC<ProductImageGalleryProps> = ({ images, productName }) => {
  const fallbackImage = '/default-image.png'; // A single source for the fallback image

  // 2. STATE IS NOW STRONGLY TYPED
  const [activeImage, setActiveImage] = useState<ProductImage | null>(null);
  const [isZooming, setIsZooming] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const mainImageContainerRef = useRef<HTMLDivElement>(null);
  const zoomFactor = 2.5;

  // 3. SIMPLIFIED EFFECT TO UPDATE THE ACTIVE IMAGE
  // When the `images` prop changes (because a new variant was selected),
  // this effect updates the active image to the first one in the new list.
  useEffect(() => {
    if (images && images.length > 0) {
      setActiveImage(images[0]);
    } else {
      setActiveImage(null); // Handle the case where a variant has no images
    }
    setIsZooming(false); // Reset zoom on variant change
  }, [images]);

  // --- Handlers for Zoom Functionality (now type-safe) ---

  const handleMouseEnter = useCallback(() => {
    if (activeImage && activeImage.imageUrl !== fallbackImage) {
      setIsZooming(true);
    }
  }, [activeImage]);

  const handleMouseLeave = useCallback(() => {
    setIsZooming(false);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZooming || !mainImageContainerRef.current) return;
    const container = mainImageContainerRef.current;
    const { left, top, width, height } = container.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;
    setMousePosition({ x, y });
  }, [isZooming]);

  const calculateBackgroundPosition = useCallback(() => {
    if (!mainImageContainerRef.current) return '50% 50%';
    const { width, height } = mainImageContainerRef.current.getBoundingClientRect();
    if (width === 0 || height === 0) return '50% 50%';
    const bgX = (mousePosition.x / width) * 100;
    const bgY = (mousePosition.y / height) * 100;
    return `${bgX}% ${bgY}%`;
  }, [mousePosition]);

  const mainImageUrl = activeImage?.imageUrl || fallbackImage;

  return (
    <div className="product-gallery-column">
      <div
        ref={mainImageContainerRef}
        className={`main-image-container ${isZooming ? 'zooming' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        <img
          key={mainImageUrl} // Use key to force re-render on image change
          className="main-image"
          src={mainImageUrl}
          alt={activeImage?.altText || productName}
          onError={(e) => {
            // Handle broken image links gracefully
            const target = e.target as HTMLImageElement;
            if (target.src !== fallbackImage) {
              target.src = fallbackImage;
            }
          }}
        />
        {/* The zoom preview div */}
        <div
          className="inline-zoom-preview"
          style={{
            backgroundImage: isZooming ? `url(${mainImageUrl})` : 'none',
            backgroundPosition: calculateBackgroundPosition(),
            backgroundSize: `${100 * zoomFactor}%`,
          }}
        />
      </div>

      {/* 4. SIMPLIFIED THUMBNAIL GALLERY */}
      {/* Only render thumbnails if there is more than one image to show */}
      {images && images.length > 1 && (
        <div className="thumbnail-gallery">
          {images.map(image => (
            <button
              key={image.id}
              className={`thumbnail-button ${activeImage?.id === image.id ? 'active' : ''}`}
              onClick={() => setActiveImage(image)}
            >
              <img src={image.imageUrl} alt={image.altText || `Thumbnail for ${productName}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// PropTypes are no longer needed as TypeScript handles this.

export default ProductImageGallery;