import { AxiosInstance, AxiosRequestConfig } from 'axios';
import type { ApiEnvelope } from '../api/types';
export interface ApiClientOptions {
    baseURL: string;
    withCredentials?: boolean;
    headers?: Record<string, string>;
    /**
     * Called for every request (browser only) to attach dynamic headers,
     * e.g. `x-cart-session-id`. Returned headers are merged per-request.
     */
    headerProvider?: () => Record<string, string>;
}
/** Client options without the base URL — used by the domain factories. */
export type ApiClientOptionsPatch = Omit<ApiClientOptions, 'baseURL'>;
export declare const createApiClient: (options: ApiClientOptions) => AxiosInstance;
/** Unwrap the `{ data }`/`{ success, data }` envelope. */
export declare const unwrap: <T>(request: Promise<{
    data: T | ApiEnvelope<T>;
}>) => Promise<T>;
/** Build a config object while optionally unwrapping envelopes. */
export interface ClientConfig {
    get: (url: string, config?: AxiosRequestConfig) => Promise<unknown>;
    post: (url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<unknown>;
    put: (url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<unknown>;
    delete: (url: string, config?: AxiosRequestConfig) => Promise<unknown>;
}
export type { AxiosInstance, AxiosRequestConfig };
