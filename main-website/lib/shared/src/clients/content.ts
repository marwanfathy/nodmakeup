import { API_V1, PUBLIC_LIST_QUERY } from '../api/endpoints';
import type { HeroSection, StoryBundle } from '../api/types';
import { createApiClient, type ApiClientOptionsPatch, isNotFound, unwrap, type AxiosInstance } from './client';

/** Content domain client — stories + hero sections. */
export const contentApi = (baseURL: string, options: ApiClientOptionsPatch = {}) => {
  const client = createApiClient({ baseURL, ...options });

  return {
    client,

    getActiveStories: async (): Promise<StoryBundle[]> =>
      unwrap(client.get(`${API_V1.content.stories.root}?${PUBLIC_LIST_QUERY}`)),

    markStoryAsViewed: (storyId: string) =>
      client.post(API_V1.content.stories.views(storyId)),

    trackStoryClick: (storyId: string) =>
      client.post(API_V1.content.stories.clicks(storyId)),

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
    getPublicHeroSection: async (slug: string): Promise<HeroSection | null> => {
      try {
        const response = await client.get<HeroSection>(API_V1.content.heroSections.bySlug(slug));
        return response.data;
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
  };
};

/** Content admin CRUD clients. */
export const contentAdminApi = (baseURL: string, options: ApiClientOptionsPatch = {}) => {
  const client = createApiClient({ baseURL, ...options });
  return {
    client,
    stories: {
      client,
      getAll: (params: Record<string, unknown> = {}) => client.get(API_V1.content.stories.root, { params }),
      create: (payload: unknown) => client.post(API_V1.content.stories.root, payload),
      remove: (id: string) => client.delete(API_V1.content.stories.byId(id)),
    },
    heroSections: {
      client,
      getAll: (params: Record<string, unknown> = {}) => client.get(API_V1.content.heroSections.root, { params }),
      getById: (id: string) => client.get(API_V1.content.heroSections.byId(id)),
      create: (data: unknown) => client.post(API_V1.content.heroSections.root, data),
      update: (id: string, data: unknown) => client.put(API_V1.content.heroSections.byId(id), data),
      remove: (id: string) => client.delete(API_V1.content.heroSections.byId(id)),
    },
  };
};