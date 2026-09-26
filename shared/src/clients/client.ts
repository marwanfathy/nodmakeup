import axios, { AxiosHeaders, AxiosInstance, AxiosRequestConfig } from 'axios';
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

export const createApiClient = (options: ApiClientOptions): AxiosInstance => {
  const client = axios.create({
    baseURL: options.baseURL.replace(/\/+$/, ''),
    withCredentials: options.withCredentials ?? true,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });

  client.interceptors.request.use((config) => {
    if (typeof window !== 'undefined' && options.headerProvider) {
      const extra = options.headerProvider();
      config.headers = config.headers ?? new AxiosHeaders();
      for (const [key, value] of Object.entries(extra)) {
        config.headers.set(key, value);
      }
    }
    return config;
  });

  return client;
};

/** Unwrap the `{ data }`/`{ success, data }` envelope. */
export const unwrap = async <T>(request: Promise<{ data: T | ApiEnvelope<T> }>): Promise<T> => {
  const res = await request;
  const body = res.data as ApiEnvelope<T> & T;
  if (body && typeof body === 'object' && 'data' in body && (body as ApiEnvelope<T>).data !== undefined) {
    return (body as ApiEnvelope<T>).data;
  }
  return body;
};

/** Build a config object while optionally unwrapping envelopes. */
export interface ClientConfig {
  get: (url: string, config?: AxiosRequestConfig) => Promise<unknown>;
  post: (url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<unknown>;
  put: (url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<unknown>;
  delete: (url: string, config?: AxiosRequestConfig) => Promise<unknown>;
}

export type { AxiosInstance, AxiosRequestConfig };