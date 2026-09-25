import { API_V1 } from '../api/endpoints';
import type { PageViewEvent, BehaviorEvent } from '../api/types';
import { createApiClient, type ApiClientOptionsPatch  } from './client';

/** Analytics domain client — tracking + realtime. */
export const analyticsApi = (baseURL: string, options: ApiClientOptionsPatch = {}) => {
  const client = createApiClient({ baseURL, ...options });

  return {
    client,

    trackPageView: async (event: PageViewEvent): Promise<void> => {
      try {
        await client.post(API_V1.analytics.events.pageViews, event);
      } catch {
        // Analytics never breaks the UX.
      }
    },

    /** Fire-and-forget batch of behavioral events (never rejects). */
    trackBehaviors: async (
      events: BehaviorEvent[],
      options: { visitorId?: string; sessionId?: string; useBeacon?: boolean } = {}
    ): Promise<void> => {
      const payload = { visitorId: options.visitorId, sessionId: options.sessionId, events };
      if (options.useBeacon) {
        try {
          if (navigator.sendBeacon) return void navigator.sendBeacon(baseURL + API_V1.analytics.events.behaviors, new Blob([JSON.stringify(payload)], { type: 'application/json' }));
        } catch {
          /* fall through to fetch below */
        }
      }
      try {
        await client.post(API_V1.analytics.events.behaviors, payload);
      } catch {
        // Analytics never breaks the UX.
      }
    },

    getLiveVisitorCount: () => client.get(API_V1.analytics.activeSessions),
  };
};

/** Analytics admin client — dashboard + visitors. */
export const analyticsAdminApi = (baseURL: string, options: ApiClientOptionsPatch = {}) => {
  const client = createApiClient({ baseURL, ...options });
  return {
    client,
    getDashboard: (params: Record<string, unknown> = {}) =>
      client.get(API_V1.analytics.dashboard, { params }),
    getAnalytics: (params: Record<string, unknown> = {}) =>
      client.get(API_V1.analytics.root, { params }),
    getVisitors: (params: Record<string, unknown> = {}) =>
      client.get(API_V1.analytics.visitors, { params }),
    getFunnel: (params: Record<string, unknown> = {}) =>
      client.get(API_V1.analytics.funnel, { params }),
    getLiveVisitorCount: () => client.get(API_V1.analytics.activeSessions),
    getRecentBehaviors: (params: Record<string, unknown> = {}) =>
      client.get(API_V1.analytics.behaviors.recent, { params }),
    getBehaviorInsights: (params: Record<string, unknown> = {}) =>
      client.get(API_V1.analytics.behaviors.insights, { params }),
  };
};