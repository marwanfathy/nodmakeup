import { type ApiClientOptionsPatch } from './client';
/** Users domain client — auth + admins. */
export declare const usersApi: (baseURL: string, options?: ApiClientOptionsPatch) => {
    client: import("axios").AxiosInstance;
    login: (credentials: Record<string, string>) => Promise<import("axios").AxiosResponse<any, Record<string, string>, {}, any>>;
    me: () => Promise<import("axios").AxiosResponse<any, any, {}, any>>;
    logout: () => Promise<import("axios").AxiosResponse<any, any, {}, any>>;
};
/** Users admin client — admins CRUD. */
export declare const usersAdminApi: (baseURL: string, options?: ApiClientOptionsPatch) => {
    client: import("axios").AxiosInstance;
    getAll: (params?: Record<string, unknown>) => Promise<import("axios").AxiosResponse<any, any, {}, Record<string, unknown>>>;
    getById: (id: string) => Promise<import("axios").AxiosResponse<any, any, {}, any>>;
    create: (data: unknown) => Promise<import("axios").AxiosResponse<any, unknown, {}, any>>;
    update: (id: string, data: unknown) => Promise<import("axios").AxiosResponse<any, unknown, {}, any>>;
    remove: (id: string) => Promise<import("axios").AxiosResponse<any, any, {}, any>>;
};
