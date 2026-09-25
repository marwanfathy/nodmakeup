import { API_V1, PUBLIC_LIST_QUERY } from '../api/endpoints';
import type {
  Category,
  CollectionResponse,
  CollectionSummary,
  ProductDetail,
  ProductSummary,
} from '../api/types';
import { createApiClient, type ApiClientOptionsPatch , unwrap, type AxiosInstance } from './client';

/** Catalog domain client — products, categories, brands, collections. */
export const catalogApi = (baseURL: string, options: ApiClientOptionsPatch = {}) => {
  const client = createApiClient({ baseURL, ...options });

  return {
    client,

    searchProducts: (params: Record<string, unknown> = {}) =>
      client.get(API_V1.catalog.products.search, { params }),

    getProductBySlug: async (slug: string): Promise<ProductDetail> =>
      unwrap(client.get(API_V1.catalog.products.bySlug(slug))),

    getHeroProducts: async (): Promise<ProductSummary[]> =>
      unwrap(client.get(API_V1.catalog.products.hero)),

    getRelatedProducts: async (productId: string): Promise<ProductSummary[]> =>
      unwrap(client.get(API_V1.catalog.products.related(productId))),

    getPublicCategories: async (): Promise<Category[]> =>
      unwrap(client.get(`${API_V1.catalog.categories.root}?${PUBLIC_LIST_QUERY}`)),

    getPublicCollectionBySlug: async (slug: string): Promise<CollectionResponse> =>
      unwrap(client.get(API_V1.catalog.collections.bySlug(slug))),

    getPublicCollections: async (): Promise<CollectionSummary[]> =>
      unwrap(client.get(`${API_V1.catalog.collections.root}?${PUBLIC_LIST_QUERY}`)),
  };
};

export interface AdminCrudApi<T = unknown> {
  client: AxiosInstance;
  getAll: (params?: Record<string, unknown>) => Promise<unknown>;
  getById: (id: string) => Promise<unknown>;
  create: (data: T) => Promise<unknown>;
  update: (id: string, data: T) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
}

const makeCrud = (
  client: AxiosInstance,
  root: string,
  byId: (id: string) => string
): AdminCrudApi => ({
  client,
  getAll: (params = {}) => client.get(root, { params }),
  getById: (id) => client.get(byId(id)),
  create: (data) => client.post(root, data),
  update: (id, data) => client.put(byId(id), data),
  remove: (id) => client.delete(byId(id)),
});

/** Catalog admin CRUD clients. */
export const catalogAdminApi = (baseURL: string, options: ApiClientOptionsPatch = {}) => {
  const client = createApiClient({ baseURL, ...options });
  return {
    client,
    products: makeCrud(client, API_V1.catalog.products.root, API_V1.catalog.products.byId),
    productImages: makeCrud(client, API_V1.catalog.productImages.root, API_V1.catalog.productImages.byId),
    categories: makeCrud(client, API_V1.catalog.categories.root, API_V1.catalog.categories.byId),
    brands: makeCrud(client, API_V1.catalog.brands.root, API_V1.catalog.brands.byId),
    collections: makeCrud(client, API_V1.catalog.collections.root, API_V1.catalog.collections.byId),
  };
};