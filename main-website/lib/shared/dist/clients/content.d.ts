import type { HeroSection, StoryBundle } from '../api/types';
import { type ApiClientOptionsPatch, type AxiosInstance } from './client';
/** Content domain client — stories + hero sections. */
export declare const contentApi: (baseURL: string, options?: ApiClientOptionsPatch) => {
    client: AxiosInstance;
    getActiveStories: () => Promise<StoryBundle[]>;
    markStoryAsViewed: (storyId: string) => Promise<import("axios").AxiosResponse<any, any, {}, any>>;
    trackStoryClick: (storyId: string) => Promise<import("axios").AxiosResponse<any, any, {}, any>>;
    getPublicHeroSection: (slug: string) => Promise<HeroSection>;
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
