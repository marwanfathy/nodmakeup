import type { Category, CollectionResponse, CollectionSummary, ProductDetail, ProductSummary } from '../api/types';
import { type ApiClientOptionsPatch, type AxiosInstance } from './client';
/** Catalog domain client — products, categories, brands, collections. */
export declare const catalogApi: (baseURL: string, options?: ApiClientOptionsPatch) => {
    client: AxiosInstance;
    searchProducts: (params?: Record<string, unknown>) => Promise<import("axios").AxiosResponse<any, any, {}, Record<string, unknown>>>;
    getProductBySlug: (slug: string) => Promise<ProductDetail>;
    getHeroProducts: () => Promise<ProductSummary[]>;
    getRelatedProducts: (productId: string) => Promise<ProductSummary[]>;
    getPublicCategories: () => Promise<Category[]>;
    getPublicCollectionBySlug: (slug: string) => Promise<CollectionResponse>;
    getPublicCollections: () => Promise<CollectionSummary[]>;
};
export interface AdminCrudApi<T = unknown> {
    client: AxiosInstance;
    getAll: (params?: Record<string, unknown>) => Promise<unknown>;
    getById: (id: string) => Promise<unknown>;
    create: (data: T) => Promise<unknown>;
    update: (id: string, data: T) => Promise<unknown>;
    remove: (id: string) => Promise<unknown>;
}
/** Catalog admin CRUD clients. */
export declare const catalogAdminApi: (baseURL: string, options?: ApiClientOptionsPatch) => {
    client: AxiosInstance;
    products: AdminCrudApi<unknown>;
    productImages: AdminCrudApi<unknown>;
    categories: AdminCrudApi<unknown>;
    brands: AdminCrudApi<unknown>;
    collections: AdminCrudApi<unknown>;
};
