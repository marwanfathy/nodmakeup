import { env } from '../config/env';

/**
 * Storefront order-tracking URL for an order number. The track page
 * (main-website/app/track) prefills its lookup from the `?orderNumber=`
 * query parameter, so this link lands the customer directly on their order.
 */
export const trackOrderUrl = (orderNumber: string): string =>
    `${env.storeUrl.replace(/\/+$/, '')}/track?orderNumber=${encodeURIComponent(orderNumber)}`;