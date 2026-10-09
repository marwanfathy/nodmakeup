import React from 'react';
import TrackOrderPage from './TrackOrderPage';
import { getTranslator } from '../../lib/i18n/server';

export async function generateMetadata() {
  const { t } = await getTranslator();
  return {
    title: t('track.metaTitle'),
    description: t('track.subtitle'),
  };
}

export default function TrackRoute() {
  return <TrackOrderPage />;
}
