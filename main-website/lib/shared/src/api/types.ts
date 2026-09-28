/**
 * NOD Makeup — shared DTOs.
 *
 * ALL wire types are camelCase. These mirror the storefront shapes and the
 * backend serializers — clients and servers both import from here.
 */

// --- Generic envelopes ---
export interface ApiEnvelope<T> {
  success?: boolean;
  data: T;
  count?: number;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  error: {
    code?: string;
    message: string;
    details?: unknown;
  };
}

// --- Catalog ---
export interface ProductCardVariant {
  id: string;
  colorName: string | null;
  hexCode: string | null;
  imageUrl: string | null;
  price: number;
  effectiveSalePrice: number | null;
}

export interface ProductSummary {
  id: string;
  name: string;
  nameAr?: string | null;
  slug: string;
  shortDescription?: string;
  shortDescriptionAr?: string | null;
  isBestseller?: boolean;
  variants: ProductCardVariant[];
}

export interface ProductImage {
  id: string;
  imageUrl: string;
  altText: string | null;
}

export interface ProductVariantDetail {
  id: string;
  sku: string;
  colorName: string | null;
  size: string | null;
  stockQuantity: number;
  price: number;
  effectiveSalePrice: number | null;
  images: ProductImage[];
}

export interface ProductDetail {
  id: string;
  name: string;
  nameAr?: string | null;
  categoryId: string;
  slug: string;
  description: string | null;
  descriptionAr?: string | null;
  shortDescription: string | null;
  shortDescriptionAr?: string | null;
  brand: { name: string } | null;
  variants: ProductVariantDetail[];
  discount: { type: 'PERCENTAGE' | 'FIXED_AMOUNT'; value: number } | null;
  category?: { id: string; name: string };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
}

export interface CollectionInfo {
  id: string;
  name: string;
  slug: string;
}

export interface CollectionSummary extends CollectionInfo {
  description?: string | null;
  productCount: number;
}

export interface CollectionResponse {
  collection: CollectionInfo;
  products: ProductSummary[];
}

// --- Cart ---
export interface CartItem {
  id: string;
  quantity: number;
  variantId: string;
  sku: string;
  stockQuantity: number;
  colorName: string | null;
  size: string | null;
  productId: string;
  productName: string;
  productNameAr?: string | null;
  productSlug: string;
  imageUrl: string | null;
  originalPrice: number;
  effectiveSalePrice: number | null;
}

export interface CartSummary {
  subtotal: number;
  discountAmount: number;
  total: number;
  itemCount: number;
  freeShippingThreshold: number;
  amountLeftForFreeShipping: number;
  appliedCoupon?: {
    code: string;
    type: string;
    value: number;
  };
}

export interface Cart {
  cartSessionId: string;
  items: CartItem[];
  summary: CartSummary;
}

// --- Orders & checkout ---
export type PaymentMethodType = 'CashOnDelivery';

export interface ShippingZone {
  id: string;
  governorate: string;
  shippingCost: number | string;
}

export interface AppliedDiscount {
  discountId: string;
  name: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  value: string | number;
}

export interface OrderCreationData {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  shippingGovernorate: string;
  customerNotes?: string;
  paymentMethod: PaymentMethodType | '';
  couponCode?: string;
}

export interface OrderCreationResponse {
  orderId: string;
  orderNumber: string;
}

export interface OrderItemInfo {
  productName: string;
  productNameAr?: string | null;
  quantity: number;
  price: number;
  color: string | null;
  size: string | null;
  imageUrl: string | null;
}

export interface OrderDetails {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  status: string;
  payment: {
    method: string;
    status: string | null;
  };
  summary: {
    totalPrice: number;
    shippingCost: number;
    totalDiscount: number;
  };
  items: OrderItemInfo[];
}

// --- Content ---
export type MediaType = 'IMAGE' | 'VIDEO';

export interface StoryItem {
  id: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  mediaType: MediaType;
  createdAt: string;
}

export interface StoryBundle {
  bundleId: string;
  adminId: string;
  adminName: string;
  uploadedAt: string;
  stories: StoryItem[];
}

export interface HeroMediaItem {
  id: string;
  mediaUrl: string;
  mediaType: MediaType;
  altText?: string;
  displayOrder: number;
  layoutStyle:
    | 'BACKGROUND_FULL'
    | 'FOREGROUND_LEFT'
    | 'FOREGROUND_RIGHT'
    | 'FOREGROUND_CENTER'
    | 'FOREGROUND_FLOAT_1'
    | 'FOREGROUND_FLOAT_2';
}

export interface HeroSlide {
  id: string;
  title: string;
  subtitle?: string;
  linkUrl: string;
  thumbnailUrl: string;
  displayOrder: number;
  mediaItems: HeroMediaItem[];
}

export interface HeroSection {
  id: string;
  title: string;
  description?: string;
  slug: string;
  isActive: boolean;
  slides: HeroSlide[];
}

/**
 * The landing-page banner slot, as the public endpoint returns it.
 *
 * Each of the three strings has an Arabic twin. A null twin means "fall back to
 * the English value for this one string", not "render nothing" — which is why
 * they are nullable rather than required, and why the storefront resolves them
 * per field instead of treating the row as one language or the other.
 */
export interface LandingBanner {
  id: string;
  imageUrl: string;
  imageAlt?: string | null;
  tagline: string;
  taglineAr?: string | null;
  title: string;
  titleAr?: string | null;
  ctaLabel: string;
  ctaLabelAr?: string | null;
  ctaUrl: string;
}

// --- Analytics ---
export interface PageViewEvent {
  path: string;
  /** First-party persistent visitor id (repeat visitors). */
  visitorId?: string;
  /** Per-tab session id (live status / path-change dedupe). */
  sessionId?: string;
}

/** A single captured behavioral event (click, scroll-depth, exit link...). */
export interface BehaviorEvent {
  type: 'CLICK' | 'SCROLL' | 'EXIT_LINK' | 'VIEW' | 'ERROR';
  /** Short stable identifier, e.g. 'add_to_cart', 'product-card'. */
  target?: string;
  /** Human-readable source of truth, e.g. button/link text or data-track value. */
  label?: string;
  href?: string;
  /** e.g. scroll depth percent. */
  value?: number;
  path?: string;
  meta?: Record<string, unknown>;
}

// --- Media ---
export interface MediaUploadResult {
  message: string;
  url: string;
  path: string;
  thumbnailUrl?: string | null;
}

// --- CRM ---
export type CustomerSegment = 'NEW' | 'REPEAT' | 'LOYAL' | 'VIP';

export interface CustomerSummary {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  governorate: string | null;
  segment: CustomerSegment;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string | null;
  createdAt: string;
}

export interface CustomerOrdersResponse {
  customers: CustomerSummary[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CustomerOrderHistoryItem {
  id: string;
  orderNumber: string;
  totalPrice: number;
  totalDiscount: number;
  shippingCost: number;
  createdAt: string;
  statusName: string;
  isRewardSent: boolean;
}

export interface CustomerNoteItem {
  id: string;
  note: string;
  createdAt: string;
  author: string;
  authorId?: string | null;
}

export interface CustomerDetail {
  customer: CustomerSummary & {
    address: string | null;
    tags: unknown[];
  };
  orders: CustomerOrderHistoryItem[];
  notes: CustomerNoteItem[];
}

export interface CrmOverview {
  totalCustomers: number;
  totalOrders: number;
  totalSpent: number;
  averageLifetimeValue: number;
}

export interface SegmentCount {
  segment: CustomerSegment;
  label: string;
  count: number;
}