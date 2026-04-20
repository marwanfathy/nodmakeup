"use client"; // This component must be a Client Component

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// 1. Define your titles for static URL paths.
const PATH_TITLES: { [key: string]: string } = {
  '/': 'Home',
  '/home': 'Home',
  '/shop': 'Shop All Products',
  '/collections': 'Our Collections',
  '/about': 'The Story',
  // === ADDED: Title for the static checkout page ===
  '/checkout': 'Secure Checkout', 
};

// 2. Define your brand name and a default title.
const BRAND_NAME = 'NOD';
const DEFAULT_TITLE = 'NOD | Premium Cosmetics';

const TitleUpdater = () => {
  // 3. Use the `usePathname` hook from Next.js to get the current URL path.
  const pathname = usePathname();

  useEffect(() => {
    // Find the title for the current path from the static list.
    const pageTitle = PATH_TITLES[pathname];

    let fullTitle = '';
    if (pageTitle) {
      // If a specific title is found, format it with the brand name.
      fullTitle = `${pageTitle} | ${BRAND_NAME}`;
    } else {
      // If not found in the static list, handle dynamic paths.
      
      // === ADDED: Logic for the dynamic order success page ===
      // e.g., matches /order-success/10, /order-success/11, etc.
      if (pathname.startsWith('/order-success')) {
        fullTitle = `Order Confirmation | ${BRAND_NAME}`;
      } 
      // === ADDED: Logic for the dynamic product details page ===
      // e.g., matches /products/cool-lipstick, etc.
      else if (pathname.startsWith('/product')) {
        // This provides a generic fallback title.
        // For best SEO, the specific product title should be set by the
        // `generateMetadata` function on the product page itself.
        // This client-side title acts as a fallback while data is loading.
        fullTitle = `Product Details | ${BRAND_NAME}`;
      } 
      else {
        // If no match is found, use the default title.
        fullTitle = DEFAULT_TITLE;
      }
    }

    // 4. Update the document's title directly in the browser.
    document.title = fullTitle;

  }, [pathname]); // Re-run this effect whenever the URL path changes.

  // This component does not render any visible UI.
  return null;
};

export default TitleUpdater;