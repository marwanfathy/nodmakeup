import { API_V1 } from '../api/endpoints';
import { createApiClient, type ApiClientOptionsPatch } from './client';

/** Users domain client — auth + admins. */
export const usersApi = (baseURL: string, options: ApiClientOptionsPatch = {}) => {
  const client = createApiClient({ baseURL, ...options });

  return {
    client,

    login: (credentials: Record<string, string>) =>
      client.post(API_V1.users.auth.login, credentials),

    me: () => client.get(API_V1.users.auth.me),

    logout: () => client.post(API_V1.users.auth.logout),
  };
};

/** Users admin client — admins CRUD. */
export const usersAdminApi = (baseURL: string, options: ApiClientOptionsPatch = {}) => {
  const client = createApiClient({ baseURL, ...options });
  return {
    client,
    getAll: (params: Record<string, unknown> = {}) => client.get(API_V1.users.admins.root, { params }),
    getById: (id: string) => client.get(API_V1.users.admins.byId(id)),
    create: (data: unknown) => client.post(API_V1.users.admins.root, data),
    update: (id: string, data: unknown) => client.put(API_V1.users.admins.byId(id), data),
    remove: (id: string) => client.delete(API_V1.users.admins.byId(id)),
  };
};