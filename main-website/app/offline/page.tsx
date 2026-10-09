import React from 'react';
import OfflineScreen from '../../components/ui/OfflineScreen';
import { getTranslator } from '../../lib/i18n/server';

// The screen itself pulls its copy through the locale context so it can be
// shared with the overlay; only the document title is translated here.
export async function generateMetadata() {
  const { t } = await getTranslator();
  return { title: t('offline.metaTitle') };
}

export default function OfflinePage() {
  return <OfflineScreen />;
}
