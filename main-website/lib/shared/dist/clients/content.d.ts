import type { HeroSection, StoryBundle } from '../api/types';
import { type ApiClientOptionsPatch, type AxiosInstance } from './client';
/** Content domain client — stories + hero sections. */
export declare const contentApi: (baseURL: string, options?: ApiClientOptionsPatch) => {
    client: AxiosInstance;
    getActiveStories: () => Promise<StoryBundle[]>;
    markStoryAsViewed: (storyId: string) => Promise<import("axios").AxiosResponse<any, any, {}, any>>;
    trackStoryClick: (storyId: string) => Promise<import("axios").AxiosResponse<any, any, {}, any>>;
    /**
     * The hero section for a public slug, or null when there is none.
     *
     * The route answers 404 for a slug that was never created and for one whose
     * section has been deactivated — two ordinary states, not failures. Resolving
     * them to null here means every consumer gets "no such hero section" instead
     * of having to catch and classify the error itself, and it keeps the rule
     * beside the call rather than spread across the components that make it.
     *
     * Genuine faults still throw: a 5xx or a network failure is worth surfacing.
     */
    getPublicHeroSection: (slug: string) => Promise<HeroSection | null>;
};
/** Content admin CRUD clients. */
export declare const contentAdminApi: (baseURL: string, options?: ApiClientOptionsPatch) => {
    client: AxiosInstance;
    stories: {
        client: AxiosInstance;
        getAll: (params?: Record<string, unknown>) => Promise<import("axios").AxiosResponse<any, any, {}, Record<string, unknown>>>;
        create: (payload: unknown) => Promise<import("axios").AxiosResponse<any, unknown, {}, any>>;
        remove: (id: string) => Promise<import("axios").AxiosResponse<any, any, {}, any>>;
    };
    heroSections: {
        client: AxiosInstance;
        getAll: (params?: Record<string, unknown>) => Promise<import("axios").AxiosResponse<any, any, {}, Record<string, unknown>>>;
        getById: (id: string) => Promise<import("axios").AxiosResponse<any, any, {}, any>>;
        create: (data: unknown) => Promise<import("axios").AxiosResponse<any, unknown, {}, any>>;
        update: (id: string, data: unknown) => Promise<import("axios").AxiosResponse<any, unknown, {}, any>>;
        remove: (id: string) => Promise<import("axios").AxiosResponse<any, any, {}, any>>;
    };
};
