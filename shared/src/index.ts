export { API_V1, API_PREFIX, PUBLIC_LIST_QUERY, type ApiEndpoints } from './api/endpoints';
export * from './api/types';
// Runtime contract — pure (browser-safe): canonical env keys, ports, client
// URL resolution, CORS origin matching. This is the ONE source of truth.
export {
  ENV_CONTRACT,
  SERVICES,
  defaultPortOf,
  parseOriginList,
  originMatches,
  allowOrigin,
  deriveClientBaseUrl,
  type ServiceKind,
  type DeriveClientBaseUrlInput,
} from './runtime/config';
// Runtime env loader is SERVER-ONLY — importing it pulls `zod` into the
// browser bundle (crashes webpack). Import it explicitly by subpath when
// needed: `@nod/shared/dist/config/env`.
export type { ServerEnv } from './config/env';
export {
  createApiClient,
  unwrap,
  type ApiClientOptions,
  type ClientConfig,
  type AxiosInstance,
  type AxiosRequestConfig,
} from './clients/client';
export { catalogApi, catalogAdminApi, type AdminCrudApi } from './clients/catalog';export { contentApi, contentAdminApi } from './clients/content';
export { cartApi, ordersApi, ordersAdminApi } from './clients/orders';
export { analyticsApi, analyticsAdminApi } from './clients/analytics';
export { usersApi, usersAdminApi } from './clients/users';
export { crmAdminApi } from './clients/crm';
export { mediaApi, MEDIA_ROUTES } from './clients/media';
// The landing-page section registry. Browser-safe (no env, no client code) and
// exported from the barrel so all three apps read the same section list: the
// storefront maps keys to components, the admin builds its list from it, and the
// backend validates against it. Adding a section here is what registers it.
export * from './landing/sections';