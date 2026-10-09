/**
 * NOD Makeup — shared DTOs.
 *
 * ALL wire types are camelCase. These mirror the storefront shapes and the
 * backend serializers — clients and servers both import from here.
 */
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
    brand: {
        name: string;
    } | null;
    variants: ProductVariantDetail[];
    discount: {
        type: 'PERCENTAGE' | 'FIXED_AMOUNT';
        value: number;
    } | null;
    category?: {
        id: string;
        name: string;
    };
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
/**
 * Why a coupon was refused, as a code rather than a sentence.
 *
 * The API also sends a human-readable `message`, but prose is the wrong thing for
 * a client to react to: it cannot be translated, and it cannot tell the UI what
 * to do next. A shopper on the Arabic page was shown an English sentence, and a
 * "reserved for another customer" reply gave them nothing to act on.
 *
 * The storefront maps each code to its own wording and to the recovery it
 * implies — a code that needs a phone focuses the phone field rather than
 * re-asking for the code. So the backend decides *what happened* and the client
 * decides *what to say*, in the reader's language.
 */
export declare const COUPON_REJECTION_REASONS: readonly ["NOT_FOUND", "LIMIT_REACHED", "PERSONALIZED_NEEDS_PHONE", "NOT_OWNED"];
export type CouponRejectionReason = (typeof COUPON_REJECTION_REASONS)[number];
/** Narrows an untrusted value (a response body) to a known rejection reason. */
export declare const isCouponRejectionReason: (value: unknown) => value is CouponRejectionReason;
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
/**
 * What a customer gets back from the public tracking lookup.
 *
 * Deliberately narrower than OrderDetails: the caller proved they know the
 * order number — but not that they own the cart session. The only traces of
 * the person that survive are the name they typed at checkout (it identifies
 * the order to the one who placed it) and a phone with its middle digits
 * already masked by the API, so the response can confirm "yes, this is my
 * order" and see where it is without ever carrying a dialable number or a
 * street address.
 */
export interface TrackingOrder {
    orderNumber: string;
    orderDate: string;
    status: string;
    shippingGovernorate: string;
    /** Customer name, echoed so the shopper recognises their own order. */
    customerName: string;
    /**
     * Customer phone, masked by the API before it leaves ("01•• ••• ••42"):
     * prefix + last two digits only. Never a dialable number.
     */
    customerPhone: string;
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
    layoutStyle: 'BACKGROUND_FULL' | 'FOREGROUND_LEFT' | 'FOREGROUND_RIGHT' | 'FOREGROUND_CENTER' | 'FOREGROUND_FLOAT_1' | 'FOREGROUND_FLOAT_2';
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
/**
 * One homepage section as the storefront receives it.
 *
 * `key` is a plain `string`, not the `LandingSectionKey` union, because this is
 * whatever came out of the database: a row can name a key that has since been
 * unregistered from the registry, and the storefront's job is to notice and skip
 * it rather than to be handed a type that says it cannot happen. The renderer
 * narrows with `isLandingSectionKey` before looking up a component.
 *
 * The mode fields are `null` rather than optional on purpose — the row always
 * has a value for them, it just may be no value.
 */
export interface LandingSectionSetting {
    key: string;
    isEnabled: boolean;
    heroMode: string | null;
    heroSlug: string | null;
}
/**
 * The saved order and visibility of every homepage section.
 *
 * `sections` is already ordered — position in the array IS the display order, so
 * clients never sort and cannot disagree with the database about it.
 */
export interface PublicLandingLayout {
    sections: LandingSectionSetting[];
}
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
export interface MediaUploadResult {
    message: string;
    url: string;
    path: string;
    thumbnailUrl?: string | null;
}
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
