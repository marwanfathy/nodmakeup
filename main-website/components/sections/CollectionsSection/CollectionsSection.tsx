'use client';

import React, { useState, useEffect } from 'react';
import { getPublicCollections, CollectionSummary } from '../../../lib/api';
import ProductCollectionSlider from '../../product/LandingPageProductSlider/LandingPageProductSlider';
import { useI18n } from '../../../lib/i18n/client';

interface CollectionsSectionProps {
  /** 'featured' shows strip + a single bestsellers slider from the first collection. */
  variant?: 'featured' | 'all';
  /**
   * The collections, already resolved on the server (see app/page.js).
   * `null` falls back to fetching in the browser, exactly as before.
   */
  initialCollections?: CollectionSummary[] | null;
}

const CollectionsSection: React.FC<CollectionsSectionProps> = ({
  variant = 'featured',
  initialCollections = null,
}) => {
  const { t } = useI18n();
  // True when the server already resolved this data (an empty list counts as
  // resolved, so the browser does not re-request a genuinely empty section).
  const resolvedOnServer = Array.isArray(initialCollections);

  const [collections, setCollections] = useState<CollectionSummary[]>(initialCollections ?? []);
  const [ready, setReady] = useState(resolvedOnServer);

  useEffect(() => {
    if (resolvedOnServer) return;

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
  }, [resolvedOnServer]);

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
      title={t('slider.collection')}
      forceTitle
    />
  );
};

export default CollectionsSection;