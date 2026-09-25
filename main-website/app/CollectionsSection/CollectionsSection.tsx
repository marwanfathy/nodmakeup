'use client';

import React, { useState, useEffect } from 'react';
import { getPublicCollections, CollectionSummary } from '../../lib/api';
import ProductCollectionSlider from '../LandingPageProductSlider/LandingPageProductSlider';

interface CollectionsSectionProps {
  /** 'featured' shows strip + a single bestsellers slider from the first collection. */
  variant?: 'featured' | 'all';
}

const CollectionsSection: React.FC<CollectionsSectionProps> = ({
  variant = 'featured',
}) => {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPublicCollections()
      .then((data) => {
        if (cancelled) return;
        setCollections(data || []);
      })
      .catch((err) => {
        console.error('Failed to load collections:', err);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || collections.length === 0) return null;

  if (variant === 'all') {
    return (
      <>
        {collections.map((collection) => (
          <ProductCollectionSlider
            key={collection.id}
            slug={collection.slug}
            title={collection.name}
          />
        ))}
      </>
    );
  }

  const featured = collections[0];
  return (
    <ProductCollectionSlider
      slug={featured.slug}
      title="Our Bestsellers"
      forceTitle
    />
  );
};

export default CollectionsSection;