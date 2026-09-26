"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogAdminApi = exports.catalogApi = void 0;
const endpoints_1 = require("../api/endpoints");
const client_1 = require("./client");
/** Catalog domain client — products, categories, brands, collections. */
const catalogApi = (baseURL, options = {}) => {
    const client = (0, client_1.createApiClient)({ baseURL, ...options });
    return {
        client,
        searchProducts: (params = {}) => client.get(endpoints_1.API_V1.catalog.products.search, { params }),
        getProductBySlug: async (slug) => (0, client_1.unwrap)(client.get(endpoints_1.API_V1.catalog.products.bySlug(slug))),
        getHeroProducts: async () => (0, client_1.unwrap)(client.get(endpoints_1.API_V1.catalog.products.hero)),
        getRelatedProducts: async (productId) => (0, client_1.unwrap)(client.get(endpoints_1.API_V1.catalog.products.related(productId))),
        getPublicCategories: async () => (0, client_1.unwrap)(client.get(`${endpoints_1.API_V1.catalog.categories.root}?${endpoints_1.PUBLIC_LIST_QUERY}`)),
        getPublicCollectionBySlug: async (slug) => (0, client_1.unwrap)(client.get(endpoints_1.API_V1.catalog.collections.bySlug(slug))),
        getPublicCollections: async () => (0, client_1.unwrap)(client.get(`${endpoints_1.API_V1.catalog.collections.root}?${endpoints_1.PUBLIC_LIST_QUERY}`)),
    };
};
exports.catalogApi = catalogApi;
const makeCrud = (client, root, byId) => ({
    client,
    getAll: (params = {}) => client.get(root, { params }),
    getById: (id) => client.get(byId(id)),
    create: (data) => client.post(root, data),
    update: (id, data) => client.put(byId(id), data),
    remove: (id) => client.delete(byId(id)),
});
/** Catalog admin CRUD clients. */
const catalogAdminApi = (baseURL, options = {}) => {
    const client = (0, client_1.createApiClient)({ baseURL, ...options });
    return {
        client,
        products: makeCrud(client, endpoints_1.API_V1.catalog.products.root, endpoints_1.API_V1.catalog.products.byId),
        productImages: makeCrud(client, endpoints_1.API_V1.catalog.productImages.root, endpoints_1.API_V1.catalog.productImages.byId),
        categories: makeCrud(client, endpoints_1.API_V1.catalog.categories.root, endpoints_1.API_V1.catalog.categories.byId),
        brands: makeCrud(client, endpoints_1.API_V1.catalog.brands.root, endpoints_1.API_V1.catalog.brands.byId),
        collections: makeCrud(client, endpoints_1.API_V1.catalog.collections.root, endpoints_1.API_V1.catalog.collections.byId),
    };
};
exports.catalogAdminApi = catalogAdminApi;
