"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsAdminApi = exports.analyticsApi = void 0;
const endpoints_1 = require("../api/endpoints");
const client_1 = require("./client");
/** Analytics domain client — tracking + realtime. */
const analyticsApi = (baseURL, options = {}) => {
    const client = (0, client_1.createApiClient)({ baseURL, ...options });
    return {
        client,
        trackPageView: async (event) => {
            try {
                await client.post(endpoints_1.API_V1.analytics.events.pageViews, event);
            }
            catch {
                // Analytics never breaks the UX.
            }
        },
        /** Fire-and-forget batch of behavioral events (never rejects). */
        trackBehaviors: async (events, options = {}) => {
            const payload = { visitorId: options.visitorId, sessionId: options.sessionId, events };
            if (options.useBeacon) {
                try {
                    if (navigator.sendBeacon)
                        return void navigator.sendBeacon(baseURL + endpoints_1.API_V1.analytics.events.behaviors, new Blob([JSON.stringify(payload)], { type: 'application/json' }));
                }
                catch {
                    /* fall through to fetch below */
                }
            }
            try {
                await client.post(endpoints_1.API_V1.analytics.events.behaviors, payload);
            }
            catch {
                // Analytics never breaks the UX.
            }
        },
        getLiveVisitorCount: () => client.get(endpoints_1.API_V1.analytics.activeSessions),
    };
};
exports.analyticsApi = analyticsApi;
/** Analytics admin client — dashboard + visitors. */
const analyticsAdminApi = (baseURL, options = {}) => {
    const client = (0, client_1.createApiClient)({ baseURL, ...options });
    return {
        client,
        getDashboard: (params = {}) => client.get(endpoints_1.API_V1.analytics.dashboard, { params }),
        getAnalytics: (params = {}) => client.get(endpoints_1.API_V1.analytics.root, { params }),
        getVisitors: (params = {}) => client.get(endpoints_1.API_V1.analytics.visitors, { params }),
        getFunnel: (params = {}) => client.get(endpoints_1.API_V1.analytics.funnel, { params }),
        getLiveVisitorCount: () => client.get(endpoints_1.API_V1.analytics.activeSessions),
        getRecentBehaviors: (params = {}) => client.get(endpoints_1.API_V1.analytics.behaviors.recent, { params }),
        getBehaviorInsights: (params = {}) => client.get(endpoints_1.API_V1.analytics.behaviors.insights, { params }),
    };
};
exports.analyticsAdminApi = analyticsAdminApi;
