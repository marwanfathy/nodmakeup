import type { PageViewEvent, BehaviorEvent } from '../api/types';
import { type ApiClientOptionsPatch } from './client';
/** Analytics domain client — tracking + realtime. */
export declare const analyticsApi: (baseURL: string, options?: ApiClientOptionsPatch) => {
    client: import("axios").AxiosInstance;
    trackPageView: (event: PageViewEvent) => Promise<void>;
    /** Fire-and-forget batch of behavioral events (never rejects). */
    trackBehaviors: (events: BehaviorEvent[], options?: {
        visitorId?: string;
        sessionId?: string;
        useBeacon?: boolean;
    }) => Promise<void>;
    getLiveVisitorCount: () => Promise<import("axios").AxiosResponse<any, any, {}, any>>;
};
/** Analytics admin client — dashboard + visitors. */
export declare const analyticsAdminApi: (baseURL: string, options?: ApiClientOptionsPatch) => {
    client: import("axios").AxiosInstance;
    getDashboard: (params?: Record<string, unknown>) => Promise<import("axios").AxiosResponse<any, any, {}, Record<string, unknown>>>;
    getAnalytics: (params?: Record<string, unknown>) => Promise<import("axios").AxiosResponse<any, any, {}, Record<string, unknown>>>;
    getVisitors: (params?: Record<string, unknown>) => Promise<import("axios").AxiosResponse<any, any, {}, Record<string, unknown>>>;
    getFunnel: (params?: Record<string, unknown>) => Promise<import("axios").AxiosResponse<any, any, {}, Record<string, unknown>>>;
    getLiveVisitorCount: () => Promise<import("axios").AxiosResponse<any, any, {}, any>>;
    getRecentBehaviors: (params?: Record<string, unknown>) => Promise<import("axios").AxiosResponse<any, any, {}, Record<string, unknown>>>;
    getBehaviorInsights: (params?: Record<string, unknown>) => Promise<import("axios").AxiosResponse<any, any, {}, Record<string, unknown>>>;
};
