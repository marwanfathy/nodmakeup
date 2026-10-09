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
export declare const API_PREFIX = "/api/v1";
export declare const API_V1: {
    readonly catalog: {
        readonly products: {
            readonly root: "/api/v1/catalog/products";
            readonly search: "/api/v1/catalog/products/search";
            readonly hero: "/api/v1/catalog/products/hero";
            readonly related: (productId: string) => string;
            readonly bySlug: (slug: string) => string;
            readonly byId: (id: string) => string;
            readonly archive: (id: string) => string;
            readonly unarchive: (id: string) => string;
        };
        readonly productImages: {
            readonly root: "/api/v1/catalog/product-images";
            readonly byId: (id: string) => string;
        };
        readonly categories: {
            readonly root: "/api/v1/catalog/categories";
            readonly byId: (id: string) => string;
        };
        readonly brands: {
            readonly root: "/api/v1/catalog/brands";
            readonly byId: (id: string) => string;
        };
        readonly collections: {
            readonly root: "/api/v1/catalog/collections";
            readonly bySlug: (slug: string) => string;
            readonly byId: (id: string) => string;
        };
    };
    readonly content: {
        readonly stories: {
            readonly root: "/api/v1/content/stories";
            readonly views: (storyId: string) => string;
            readonly clicks: (storyId: string) => string;
            readonly byId: (id: string) => string;
        };
        readonly heroSections: {
            readonly root: "/api/v1/content/hero-sections";
            readonly bySlug: (slug: string) => string;
            readonly byId: (id: string) => string;
        };
    };
    readonly orders: {
        readonly cart: {
            readonly root: "/api/v1/orders/cart";
            readonly items: "/api/v1/orders/cart/items";
            readonly itemsById: (cartItemId: string) => string;
        };
        readonly orders: {
            readonly root: "/api/v1/orders";
            readonly byId: (id: string) => string;
            readonly track: "/api/v1/orders/track";
            readonly statuses: "/api/v1/orders/statuses";
            readonly status: (orderId: string) => string;
            readonly transactionStatus: (orderId: string) => string;
            readonly sendReward: (orderId: string) => string;
        };
        readonly shippingZones: {
            readonly root: "/api/v1/orders/shipping-zones";
        };
        readonly discounts: {
            readonly root: "/api/v1/orders/discounts";
            readonly validate: "/api/v1/orders/discounts/validate";
            readonly byId: (id: string) => string;
        };
    };
    readonly users: {
        readonly auth: {
            readonly login: "/api/v1/users/auth/login";
            readonly logout: "/api/v1/users/auth/logout";
            readonly me: "/api/v1/users/auth/me";
        };
        readonly admins: {
            readonly root: "/api/v1/users/admins";
            readonly byId: (id: string) => string;
        };
    };
    readonly analytics: {
        readonly events: {
            readonly pageViews: "/api/v1/analytics/events/page-views";
            readonly behaviors: "/api/v1/analytics/events/behaviors";
        };
        readonly activeSessions: "/api/v1/analytics/active-sessions";
        readonly root: "/api/v1/analytics";
        readonly visitors: "/api/v1/analytics/visitors";
        readonly funnel: "/api/v1/analytics/funnel";
        readonly dashboard: "/api/v1/analytics/dashboard";
        readonly realtime: "/api/v1/analytics/realtime";
        readonly behaviors: {
            readonly recent: "/api/v1/analytics/behaviors/recent";
            readonly insights: "/api/v1/analytics/behaviors/insights";
        };
    };
    readonly crm: {
        readonly root: "/api/v1/crm";
        readonly overview: "/api/v1/crm/overview";
        readonly segments: "/api/v1/crm/segments";
        readonly backfill: "/api/v1/crm/backfill";
        readonly customers: {
            readonly root: "/api/v1/crm/customers";
            readonly byId: (id: string) => string;
            readonly notes: (id: string) => string;
        };
    };
    readonly notify: {
        readonly root: "/api/v1/notify";
    };
};
/** Query flag used by colliding admin/public list endpoints. */
export declare const PUBLIC_LIST_QUERY = "public=true";
export type ApiEndpoints = typeof API_V1;
