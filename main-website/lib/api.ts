// ===============================================
//           STOREFRONT API ADAPTER
// ===============================================
// Thin facade over @nod/shared clients. Every path is a code constant from the
// shared registry (/api/v1/*); the base gateway + media URLs come ONLY from env
// (lib/config.ts). Export names + types are kept so app call sites stay intact.

import { API_URL, MEDIA_URL } from './config';
import {
  catalogApi,
  contentApi,
  cartApi,
  ordersApi,
  analyticsApi,
  mediaApi,
} from '@nod/shared';

// Attach the cart session id (if any) to every request from this browser.
const sessionHeaders = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  const sessionId = window.localStorage.getItem('fallback_cart_id');
  return sessionId ? { 'x-cart-session-id': sessionId } : {};
};

const catalog = catalogApi(API_URL, { headerProvider: sessionHeaders });
const content = contentApi(API_URL, { headerProvider: sessionHeaders });
const cart = cartApi(API_URL, { headerProvider: sessionHeaders });
const orders = ordersApi(API_URL, { headerProvider: sessionHeaders });
const analytics = analyticsApi(API_URL);
export const media = mediaApi(MEDIA_URL);

// ===============================================
//           TYPES (re-exported from shared)
// ===============================================

export type {
  ProductCardVariant,
  ProductSummary,
  ProductImage,
  ProductVariantDetail,
  ProductDetail,
  Category,
  CollectionInfo,
  CollectionResponse,
  CollectionSummary,
  CartItem,
  CartSummary,
  Cart,
  PaymentMethodType,
  ShippingZone,
  AppliedDiscount,
  OrderCreationData,
  OrderCreationResponse,
  OrderItemInfo,
  OrderDetails,
  MediaType,
  StoryItem,
  StoryBundle,
  HeroMediaItem,
  HeroSlide,
  HeroSection,
  MediaUploadResult,
} from '@nod/shared';

// Backward-compatible names (fields are camelCase now)
export type CartItemPublic = import('@nod/shared').CartItem;
export type CartObject = import('@nod/shared').Cart;
export type ApiStory = import('@nod/shared').StoryItem;
export type ApiStoryGroup = import('@nod/shared').StoryBundle;
export type HeroSectionPublic = import('@nod/shared').HeroSection;
export type HeroMediaItemPublic = import('@nod/shared').HeroMediaItem;
export type HeroSlidePublic = import('@nod/shared').HeroSlide;

// ===============================================
//           PRODUCTS & DISCOVERY API
// ===============================================

export const searchProducts = (params: Record<string, unknown> = {}) =>
  catalog.searchProducts(params);

export const getProductBySlug = (slug: string) => catalog.getProductBySlug(slug);
export const getHeroProducts = () => catalog.getHeroProducts();
export const getPublicCategories = () => catalog.getPublicCategories();
export const getPublicCollectionBySlug = (slug: string) =>
  catalog.getPublicCollectionBySlug(slug);
export const getPublicCollections = () => catalog.getPublicCollections();
export const fetchRelatedProducts = (productId: string) =>
  catalog.getRelatedProducts(productId);

// ===============================================
//           CONTENT API (stories + hero)
// ===============================================

export const getPublicStories = () => content.getActiveStories();
export const markStoryAsViewed = (storyId: string) => content.markStoryAsViewed(storyId);
export const trackStoryClick = (storyId: string) => content.trackStoryClick(storyId);
export const getPublicHeroSection = (slug: string) => content.getPublicHeroSection(slug);

// ===============================================
//           CART API
// ===============================================

export const getCart = async () => {
  const cartObj = await cart.getCart();
  if (cartObj?.cartSessionId) {
    window.localStorage.setItem('fallback_cart_id', cartObj.cartSessionId);
  }
  return cartObj;
};

export const addItemToCart = (variantId: string, quantity: number) =>
  cart.addItem(variantId, quantity);

export const updateItemQuantityInCart = (cartItemId: string, quantity: number) =>
  cart.updateItemQuantity(cartItemId, quantity);

export const removeItemFromCart = (cartItemId: string) => cart.removeItem(cartItemId);

// ===============================================
//           ORDERS & CHECKOUT API
// ===============================================

export const createOrder = (data: import('@nod/shared').OrderCreationData) =>
  orders.createOrder(data);

export const getPublicOrderDetails = (orderId: string) =>
  orders.getOrderDetails(orderId);

export const getShippingZones = () => orders.getShippingZones();

export const validateCoupon = (couponCode: string, customerPhone?: string) =>
  orders.validateCoupon(couponCode, customerPhone);

// ===============================================
//           ANALYTICS API
// ===============================================

export const trackPageView = async (
  path: string,
  visitorId: string,
  sessionId?: string | null
): Promise<void> => {
  await analytics.trackPageView({ path, visitorId, sessionId: sessionId || undefined });
};

export const trackBehaviors: typeof analytics.trackBehaviors = (events, options) =>
  analytics.trackBehaviors(events, options);

export const getLiveVisitorCount = () => analytics.getLiveVisitorCount();

// ===============================================
//           MEDIA HELPERS
// ===============================================

/** Build an absolute media URL from a relative stored path (or pass through). */
export const mediaUrl = (pathOrUrl: string | null | undefined): string =>
  media.absoluteUrl(pathOrUrl);