'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { stripLocale } from '../../lib/i18n/paths';
import OfflineScreen from './OfflineScreen';

/**
 * Turns a dropped connection into a real screen instead of a dead page.
 *
 * There is no service worker here, and that is the point: once the storefront
 * is open, the browser keeps running the bundle it already downloaded, so this
 * overlay is available offline precisely because it is not fetched. A service
 * worker would only be needed to serve the app to a *cold* offline visit.
 *
 * The dedicated /offline route renders the same screen, so this one stays out
 * of its way there rather than stacking a second copy on top.
 */
const OfflineWatcher: React.FC = () => {
  const pathname = usePathname();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  const onOfflineRoute = stripLocale(pathname) === '/offline';
  return offline && !onOfflineRoute ? <OfflineScreen overlay /> : null;
};

export default OfflineWatcher;
