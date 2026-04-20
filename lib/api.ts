import axios, { AxiosResponse } from 'axios';
import { API_URL } from './config'; // Import the variable

// ===============================================
//           TYPE DEFINITIONS
// ===============================================

// --- Products & Discovery ---

export interface ProductCardVariant {
    id: number;
    colorName: string | null;
    hexCode: string | null;
    imageUrl: string | null;
    price: number;
    // CHANGE: Standardized to camelCase
    effectiveSalePrice: number | null; 
}

/**
 * The single source of truth for data needed to display a product card.
 * Used for hero products, collection products, search results, etc.
 */
export interface ProductSummary {
    // CHANGE: Standardized to 'id' and camelCase
    id: number; 
    name: string;
    slug: string;
    shortDescription?: string;
    isBestseller?: boolean;
    variants: ProductCardVariant[];
}

/**
 * The detailed structure for the full Product Detail Page.
 */
export interface ProductImage {
    id: number;
    imageUrl: string;
    altText: string | null;
}

export interface ProductVariantDetail {
    id: number;
    sku: string;
    colorName: string | null;
    size: string | null;
    stockQuantity: number;
    price: number;
    effectiveSalePrice: number | null; 
    images: ProductImage[];
}

export interface ProductBrand {
    name: string;
}

export interface ProductDetail {
    id: number;
    name: string;
    categoryId: number; // Ensure this exists
    slug: string;
    description: string | null;
    shortDescription: string | null;
    brand: ProductBrand | null;
    variants: ProductVariantDetail[];
    discount: {
        type: 'PERCENTAGE' | 'FIXED_AMOUNT';
        value: number;
    } | null;
    // Add this optional property to handle cases where backend sends nested object
    category?: { 
        id: number;
        name: string;
    };
}

export interface Category {
    id: number;
    name: string;
    slug: string;
}

export interface CollectionInfo {
    collection_id: number;
    name: string;
    slug: string;
}

export interface CollectionResponse {
    collection: CollectionInfo;
    products: ProductSummary[]; // Now uses the unified ProductSummary type
}


// --- Cart ---

export interface CartItemPublic {
    cart_item_id: number;
    quantity: number;
    variant_id: number;
    sku: string;
    stock_quantity: number;
    color_name: string | null;
    size: string | null;
    product_id: number;
    product_name: string;
    product_slug: string;
    image_url: string | null;
    original_price: number;
    effective_sale_price: number | null;
}

export interface CartObject {
    cart_session_id: string;
    items: CartItemPublic[];
    summary: {
        subtotal: number;
        itemCount: number;
        freeShippingThreshold?: number;     
        amountLeftForFreeShipping?: number; 
        isFreeShipping?: boolean;  
    };
    
}


// --- Orders & Checkout ---

export type PaymentMethodType = 'CashOnDelivery';

export interface ShippingZone {
    zone_id: number;
    governorate: string;
    shipping_cost: string;
    available_payment_methods: PaymentMethodType[];
}

export interface AppliedDiscount {
    discount_id: number;
    name: string;
    discount_type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
    value: string;
}

export interface OrderCreationData {
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    shipping_governorate: string;
    customer_notes?: string;
    payment_method: PaymentMethodType | '';
    coupon_code?: string;
}

export interface OrderCreationResponse {
    orderId: number;
    order_number: string;
}

export interface OrderDetails {
    order_id: number;
    order_number: string;
    total_price: number;
    payment_method: PaymentMethodType | string | null;
}


// --- Stories ---

export enum MediaType {
    IMAGE = 'IMAGE',
    VIDEO = 'VIDEO',
}

export interface ApiStory {
    story_id: number;
    media_url: string;
    thumbnail_url: string | null;
    media_type: MediaType;
    created_at: string; // Dates usually come as strings from JSON
}

export interface ApiStoryGroup {
    bundle_id: string;      // <--- NEW: Unique ID for the specific upload circle
    admin_id: number;
    admin_name: string;
    uploaded_at: string;    // <--- NEW: The timestamp for this specific bundle
    stories: ApiStory[];
}

// ===============================================
//           AXIOS INSTANCE & HELPERS
// ===============================================

// UPDATED: Using the imported API_URL from config instead of process.env/hardcoded string
const apiClient = axios.create({
    baseURL: API_URL,
    withCredentials: true,
});

const unwrapData = <T>(response: AxiosResponse<{ data: T }>): T => response.data.data;


// ===============================================
//           PRODUCTS & DISCOVERY API
// ===============================================

export const searchProducts = (params: Record<string, any> = {}) => {
    // Note: Backend for this should be updated to return ProductSummary[]
    return apiClient.get('/api/public/products/search', { params });
};

export const getProductBySlug = async (slug: string): Promise<ProductDetail> => {
    const response = await apiClient.get<{ data: ProductDetail }>(`/api/public/products/${slug}`);
    return unwrapData(response);
};

export const getHeroProducts = async (): Promise<ProductSummary[]> => {
    const response = await apiClient.get<{ data: ProductSummary[] }>('/api/public/products/hero');
    return unwrapData(response);
};


export const getPublicCategories = async (): Promise<Category[]> => {
    const response = await apiClient.get<{ data: Category[] }>('/api/public/categories');
    return unwrapData(response);
};

export const getPublicCollectionBySlug = async (slug: string): Promise<CollectionResponse> => {
    const response = await apiClient.get<{ data: CollectionResponse }>(`/api/public/collections/${slug}`);
    return unwrapData(response);
};

export const getPublicStories = async (): Promise<ApiStoryGroup[]> => {
    const response = await apiClient.get<{ data: ApiStoryGroup[] }>('/api/public/stories');
    return unwrapData(response);
};

export const markStoryAsViewed = (storyId: number) => {
    return apiClient.post(`/api/public/stories/${storyId}/view`);
};

export const trackStoryClick = (storyId: number) => {
    return apiClient.post(`/api/public/stories/${storyId}/click`);
};


// ===============================================
//           CART API
// ===============================================

export const getCart = async (): Promise<CartObject> => {
    const response = await apiClient.get<{ data: CartObject }>('/api/public/cart');
    const cart = unwrapData(response);
    if (cart.cart_session_id) {
        localStorage.setItem('fallback_cart_id', cart.cart_session_id);
    }
    return cart;
};


export const addItemToCart = async (variant_id: number, quantity: number): Promise<CartObject> => {
    const response = await apiClient.post<{ data: CartObject }>('/api/public/cart/items', { variant_id, quantity });
    return unwrapData(response);
};

export const updateItemQuantityInCart = async (cartItemId: number, quantity: number): Promise<CartObject> => {
    const response = await apiClient.put<{ data: CartObject }>(`/api/public/cart/items/${cartItemId}`, { quantity });
    return unwrapData(response);
};

export const removeItemFromCart = async (cartItemId: number): Promise<CartObject> => {
    const response = await apiClient.delete<{ data: CartObject }>(`/api/public/cart/items/${cartItemId}`);
    return unwrapData(response);
};
apiClient.interceptors.request.use((config) => {
    const fallbackId = localStorage.getItem('fallback_cart_id');
    if (fallbackId) {
        config.headers['x-cart-session-id'] = fallbackId;
    }
    return config;
});

// ===============================================
//           ORDERS & CHECKOUT API
// ===============================================

export const createOrder = async (orderData: OrderCreationData): Promise<OrderCreationResponse> => {
    const response = await apiClient.post<{ data: OrderCreationResponse }>('/api/public/orders', orderData);
    return unwrapData(response);
};

export const getPublicOrderDetails = async (orderId: string | number): Promise<OrderDetails> => {
    const response = await apiClient.get<{ data: OrderDetails }>(`/api/public/orders/${orderId}`);
    return unwrapData(response);
};

export const getShippingZones = async (): Promise<ShippingZone[]> => {
    const response = await apiClient.get<{ data: ShippingZone[] }>('/api/public/shipping-zones');
    return unwrapData(response) || [];
};

export const validateCoupon = async (coupon_code: string, customer_phone?: string): Promise<AppliedDiscount> => {
    // Construct payload dynamically
    const payload: any = { coupon_code };
    
    // If a phone number is provided (user typed it in checkout), send it for verification
    if (customer_phone) {
        payload.customer_phone = customer_phone;
    }

    const response = await apiClient.post<{ data: AppliedDiscount }>('/api/public/discounts/validate', payload);
    return unwrapData(response);
};

// ===============================================
//           ANALYTICS API
// ===============================================

export const trackPageView = async (path: string, visitorId: string): Promise<void> => {
    try {
        // This hits the Public Controller trackVisit
        await apiClient.post('/api/public/analytics/ping', { 
            path, 
            visitorId 
        });
    } catch (err) {
        // Silent fail in production to not break UX
    }
};
export const getLiveVisitorCount = async () => {
    return await apiClient.get('/api/admin/analytics/realtime-status');
};
// ==============================================
//           hero section
// ===============================================
export interface HeroMediaItemPublic {
    id: number;
    mediaUrl: string;
    mediaType: 'IMAGE' | 'VIDEO';
    altText?: string;
    displayOrder: number;
    layoutStyle: 'BACKGROUND_FULL' | 'FOREGROUND_LEFT' | 'FOREGROUND_RIGHT' | 'FOREGROUND_CENTER' | 'FOREGROUND_FLOAT_1' | 'FOREGROUND_FLOAT_2';
}

export interface HeroSlidePublic {
    id: number;
    title: string;
    subtitle?: string;
    linkUrl: string;
    thumbnailUrl: string;
    displayOrder: number;
    mediaItems: HeroMediaItemPublic[];
}

export interface HeroSectionPublic {
    id: number;
    title: string;
    description?: string;
    slug: string;
    isActive: boolean;
    slides: HeroSlidePublic[];
}

/**
 * Fetches a single, active hero section by its slug for public display.
 * @param slug The unique slug of the hero section (e.g., "homepage-main-banner").
 * @returns A promise that resolves to the HeroSectionPublic object.
 */
export const getPublicHeroSection = async (slug: string): Promise<HeroSectionPublic> => {
    const response = await apiClient.get<HeroSectionPublic>(`/api/public/hero-sections/${slug}`);
    // Note: This public endpoint returns the data directly, without a `{ data: ... }` wrapper.
    // So we return `response.data` instead of using `unwrapData`.
    return response.data;
};

/**
 * Fetches related products using the specific backend endpoint.
 * This endpoint handles category matching and excludes the current product automatically.
 * @param productId - The ID of the current product
 */
export const fetchRelatedProducts = async (productId: string | number): Promise<ProductSummary[]> => {
    try {
        const response = await apiClient.get<{ data: ProductSummary[] }>(`/api/public/products/related/${productId}`);
        return unwrapData(response);
    } catch (error) {
        console.error("API Error - fetchRelatedProducts:", error);
        return [];
    }
};
