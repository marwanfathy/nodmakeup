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

export const API_PREFIX = '/api/v1';

export const API_V1 = {
  catalog: {
    products: {
      root: `${API_PREFIX}/catalog/products`,
      search: `${API_PREFIX}/catalog/products/search`,
      hero: `${API_PREFIX}/catalog/products/hero`,
      related: (productId: string) => `${API_PREFIX}/catalog/products/related/${productId}`,
      bySlug: (slug: string) => `${API_PREFIX}/catalog/products/${slug}`,
      byId: (id: string) => `${API_PREFIX}/catalog/products/${id}`,
      archive: (id: string) => `${API_PREFIX}/catalog/products/${id}/archive`,
      unarchive: (id: string) => `${API_PREFIX}/catalog/products/${id}/unarchive`,
    },
    productImages: {
      root: `${API_PREFIX}/catalog/product-images`,
      byId: (id: string) => `${API_PREFIX}/catalog/product-images/${id}`,
    },
    categories: {
      root: `${API_PREFIX}/catalog/categories`,
      byId: (id: string) => `${API_PREFIX}/catalog/categories/${id}`,
    },
    brands: {
      root: `${API_PREFIX}/catalog/brands`,
      byId: (id: string) => `${API_PREFIX}/catalog/brands/${id}`,
    },
    collections: {
      root: `${API_PREFIX}/catalog/collections`,
      bySlug: (slug: string) => `${API_PREFIX}/catalog/collections/${slug}`,
      byId: (id: string) => `${API_PREFIX}/catalog/collections/${id}`,
    },
  },

  content: {
    stories: {
      root: `${API_PREFIX}/content/stories`,
      views: (storyId: string) => `${API_PREFIX}/content/stories/${storyId}/view`,
      clicks: (storyId: string) => `${API_PREFIX}/content/stories/${storyId}/click`,
      byId: (id: string) => `${API_PREFIX}/content/stories/${id}`,
    },
    heroSections: {
      root: `${API_PREFIX}/content/hero-sections`,
      bySlug: (slug: string) => `${API_PREFIX}/content/hero-sections/${slug}`,
      byId: (id: string) => `${API_PREFIX}/content/hero-sections/${id}`,
    },
  },

  orders: {
    cart: {
      root: `${API_PREFIX}/orders/cart`,
      items: `${API_PREFIX}/orders/cart/items`,
      itemsById: (cartItemId: string) => `${API_PREFIX}/orders/cart/items/${cartItemId}`,
    },
    orders: {
      root: `${API_PREFIX}/orders`,
      byId: (id: string) => `${API_PREFIX}/orders/${id}`,
      statuses: `${API_PREFIX}/orders/statuses`,
      status: (orderId: string) => `${API_PREFIX}/orders/${orderId}/status`,
      transactionStatus: (orderId: string) => `${API_PREFIX}/orders/${orderId}/transaction-status`,
      sendReward: (orderId: string) => `${API_PREFIX}/orders/${orderId}/send-reward`,
    },
    shippingZones: {
      root: `${API_PREFIX}/orders/shipping-zones`,
    },
    discounts: {
      root: `${API_PREFIX}/orders/discounts`,
      validate: `${API_PREFIX}/orders/discounts/validate`,
      byId: (id: string) => `${API_PREFIX}/orders/discounts/${id}`,
    },
  },

  users: {
    auth: {
      login: `${API_PREFIX}/users/auth/login`,
      logout: `${API_PREFIX}/users/auth/logout`,
      me: `${API_PREFIX}/users/auth/me`,
    },
    admins: {
      root: `${API_PREFIX}/users/admins`,
      byId: (id: string) => `${API_PREFIX}/users/admins/${id}`,
    },
  },

  analytics: {
    events: {
      pageViews: `${API_PREFIX}/analytics/events/page-views`,
      behaviors: `${API_PREFIX}/analytics/events/behaviors`,
    },
    activeSessions: `${API_PREFIX}/analytics/active-sessions`,
    root: `${API_PREFIX}/analytics`,
    visitors: `${API_PREFIX}/analytics/visitors`,
    funnel: `${API_PREFIX}/analytics/funnel`,
    dashboard: `${API_PREFIX}/analytics/dashboard`,
    realtime: `${API_PREFIX}/analytics/realtime`,
    behaviors: {
      recent: `${API_PREFIX}/analytics/behaviors/recent`,
      insights: `${API_PREFIX}/analytics/behaviors/insights`,
    },
  },

  crm: {
    root: `${API_PREFIX}/crm`,
    overview: `${API_PREFIX}/crm/overview`,
    segments: `${API_PREFIX}/crm/segments`,
    backfill: `${API_PREFIX}/crm/backfill`,
    customers: {
      root: `${API_PREFIX}/crm/customers`,
      byId: (id: string) => `${API_PREFIX}/crm/customers/${id}`,
      notes: (id: string) => `${API_PREFIX}/crm/customers/${id}/notes`,
    },
  },

  notify: {
    root: `${API_PREFIX}/notify`,
  },
} as const;

/** Query flag used by colliding admin/public list endpoints. */
export const PUBLIC_LIST_QUERY = 'public=true';

export type ApiEndpoints = typeof API_V1;