"use strict";
/**
 * NOD Makeup — API endpoint registry (v1).
 *
 * THE single source of truth for every HTTP path in the project.
 * - Base prefix is `/api/v1` for every service.
 * - Paths are code constants only — NEVER read from environment variables.
 * - Shape: /api/v1/{domain}/{resource}(/:id)(/sub-resource)
 * - Resources are plural kebab-case nouns. Actions are nouns, not verbs.
 *
 * Domains (align with the M5 service boundaries):
 *   catalog, content, orders, users, analytics, media, crm, notify
 *
 * Role-collapsed routes (admin + public share the resource URI):
 *   - Admin `GET|PUT|DELETE /{id}` use numeric-ID guards so string slugs
 *     fall through to the public handler.
 *   - Admin list endpoints that collide with a public list (categories,
 *     stories) accept `?public=true` to return the public shape.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUBLIC_LIST_QUERY = exports.API_V1 = exports.API_PREFIX = void 0;
exports.API_PREFIX = '/api/v1';
exports.API_V1 = {
    catalog: {
        products: {
            root: `${exports.API_PREFIX}/catalog/products`,
            search: `${exports.API_PREFIX}/catalog/products/search`,
            hero: `${exports.API_PREFIX}/catalog/products/hero`,
            related: (productId) => `${exports.API_PREFIX}/catalog/products/related/${productId}`,
            bySlug: (slug) => `${exports.API_PREFIX}/catalog/products/${slug}`,
            byId: (id) => `${exports.API_PREFIX}/catalog/products/${id}`,
            archive: (id) => `${exports.API_PREFIX}/catalog/products/${id}/archive`,
            unarchive: (id) => `${exports.API_PREFIX}/catalog/products/${id}/unarchive`,
        },
        productImages: {
            root: `${exports.API_PREFIX}/catalog/product-images`,
            byId: (id) => `${exports.API_PREFIX}/catalog/product-images/${id}`,
        },
        categories: {
            root: `${exports.API_PREFIX}/catalog/categories`,
            byId: (id) => `${exports.API_PREFIX}/catalog/categories/${id}`,
        },
        brands: {
            root: `${exports.API_PREFIX}/catalog/brands`,
            byId: (id) => `${exports.API_PREFIX}/catalog/brands/${id}`,
        },
        collections: {
            root: `${exports.API_PREFIX}/catalog/collections`,
            bySlug: (slug) => `${exports.API_PREFIX}/catalog/collections/${slug}`,
            byId: (id) => `${exports.API_PREFIX}/catalog/collections/${id}`,
        },
    },
    content: {
        stories: {
            root: `${exports.API_PREFIX}/content/stories`,
            views: (storyId) => `${exports.API_PREFIX}/content/stories/${storyId}/view`,
            clicks: (storyId) => `${exports.API_PREFIX}/content/stories/${storyId}/click`,
            byId: (id) => `${exports.API_PREFIX}/content/stories/${id}`,
        },
        heroSections: {
            root: `${exports.API_PREFIX}/content/hero-sections`,
            bySlug: (slug) => `${exports.API_PREFIX}/content/hero-sections/${slug}`,
            byId: (id) => `${exports.API_PREFIX}/content/hero-sections/${id}`,
        },
    },
    orders: {
        cart: {
            root: `${exports.API_PREFIX}/orders/cart`,
            items: `${exports.API_PREFIX}/orders/cart/items`,
            itemsById: (cartItemId) => `${exports.API_PREFIX}/orders/cart/items/${cartItemId}`,
        },
        orders: {
            root: `${exports.API_PREFIX}/orders`,
            byId: (id) => `${exports.API_PREFIX}/orders/${id}`,
            // Public lookup by order number. Kept a POST so the identifier stays out
            // of access logs, proxy traces and browser history.
            track: `${exports.API_PREFIX}/orders/track`,
            statuses: `${exports.API_PREFIX}/orders/statuses`,
            status: (orderId) => `${exports.API_PREFIX}/orders/${orderId}/status`,
            transactionStatus: (orderId) => `${exports.API_PREFIX}/orders/${orderId}/transaction-status`,
            sendReward: (orderId) => `${exports.API_PREFIX}/orders/${orderId}/send-reward`,
        },
        shippingZones: {
            root: `${exports.API_PREFIX}/orders/shipping-zones`,
        },
        discounts: {
            root: `${exports.API_PREFIX}/orders/discounts`,
            validate: `${exports.API_PREFIX}/orders/discounts/validate`,
            byId: (id) => `${exports.API_PREFIX}/orders/discounts/${id}`,
        },
    },
    users: {
        auth: {
            login: `${exports.API_PREFIX}/users/auth/login`,
            logout: `${exports.API_PREFIX}/users/auth/logout`,
            me: `${exports.API_PREFIX}/users/auth/me`,
        },
        admins: {
            root: `${exports.API_PREFIX}/users/admins`,
            byId: (id) => `${exports.API_PREFIX}/users/admins/${id}`,
        },
    },
    analytics: {
        events: {
            pageViews: `${exports.API_PREFIX}/analytics/events/page-views`,
            behaviors: `${exports.API_PREFIX}/analytics/events/behaviors`,
        },
        activeSessions: `${exports.API_PREFIX}/analytics/active-sessions`,
        root: `${exports.API_PREFIX}/analytics`,
        visitors: `${exports.API_PREFIX}/analytics/visitors`,
        funnel: `${exports.API_PREFIX}/analytics/funnel`,
        dashboard: `${exports.API_PREFIX}/analytics/dashboard`,
        realtime: `${exports.API_PREFIX}/analytics/realtime`,
        behaviors: {
            recent: `${exports.API_PREFIX}/analytics/behaviors/recent`,
            insights: `${exports.API_PREFIX}/analytics/behaviors/insights`,
        },
    },
    crm: {
        root: `${exports.API_PREFIX}/crm`,
        overview: `${exports.API_PREFIX}/crm/overview`,
        segments: `${exports.API_PREFIX}/crm/segments`,
        backfill: `${exports.API_PREFIX}/crm/backfill`,
        customers: {
            root: `${exports.API_PREFIX}/crm/customers`,
            byId: (id) => `${exports.API_PREFIX}/crm/customers/${id}`,
            notes: (id) => `${exports.API_PREFIX}/crm/customers/${id}/notes`,
        },
    },
    notify: {
        root: `${exports.API_PREFIX}/notify`,
    },
};
/** Query flag used by colliding admin/public list endpoints. */
exports.PUBLIC_LIST_QUERY = 'public=true';
