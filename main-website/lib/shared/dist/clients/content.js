"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contentAdminApi = exports.contentApi = void 0;
const endpoints_1 = require("../api/endpoints");
const client_1 = require("./client");
/** Content domain client — stories + hero sections. */
const contentApi = (baseURL, options = {}) => {
    const client = (0, client_1.createApiClient)({ baseURL, ...options });
    return {
        client,
        getActiveStories: async () => (0, client_1.unwrap)(client.get(`${endpoints_1.API_V1.content.stories.root}?${endpoints_1.PUBLIC_LIST_QUERY}`)),
        markStoryAsViewed: (storyId) => client.post(endpoints_1.API_V1.content.stories.views(storyId)),
        trackStoryClick: (storyId) => client.post(endpoints_1.API_V1.content.stories.clicks(storyId)),
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
        getPublicHeroSection: async (slug) => {
            try {
                const response = await client.get(endpoints_1.API_V1.content.heroSections.bySlug(slug));
                return response.data;
            }
            catch (error) {
                if ((0, client_1.isNotFound)(error))
                    return null;
                throw error;
            }
        },
    };
};
exports.contentApi = contentApi;
/** Content admin CRUD clients. */
const contentAdminApi = (baseURL, options = {}) => {
    const client = (0, client_1.createApiClient)({ baseURL, ...options });
    return {
        client,
        stories: {
            client,
            getAll: (params = {}) => client.get(endpoints_1.API_V1.content.stories.root, { params }),
            create: (payload) => client.post(endpoints_1.API_V1.content.stories.root, payload),
            remove: (id) => client.delete(endpoints_1.API_V1.content.stories.byId(id)),
        },
        heroSections: {
            client,
            getAll: (params = {}) => client.get(endpoints_1.API_V1.content.heroSections.root, { params }),
            getById: (id) => client.get(endpoints_1.API_V1.content.heroSections.byId(id)),
            create: (data) => client.post(endpoints_1.API_V1.content.heroSections.root, data),
            update: (id, data) => client.put(endpoints_1.API_V1.content.heroSections.byId(id), data),
            remove: (id) => client.delete(endpoints_1.API_V1.content.heroSections.byId(id)),
        },
    };
};
exports.contentAdminApi = contentAdminApi;
