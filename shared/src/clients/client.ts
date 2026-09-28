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

/**
 * Whether a rejected request failed because the resource is not there.
 *
 * Several public routes answer 404 for a perfectly ordinary state — a hero
 * section slug nobody has created, a deactivated section. That is an answer,
 * not a fault, so a caller that cares about absence can tell it apart from a
 * genuine 5xx or a network failure without every call site re-deriving axios's
 * error shape.
 */
export const isNotFound = (error: unknown): boolean =>
  axios.isAxiosError(error) && error.response?.status === 404;

/**
 * The JSON body of a refused request, or null.
 *
 * Exists so a caller can read a machine-readable field the API deliberately
 * sent — a `reason`, say — instead of matching on the prose in `message`. The
 * alternative is every consumer re-deriving axios's error shape, and one of them
 * inevitably casting through `any` to do it.
 *
 * Null rather than a throw for the shapes that have no body, so a caller can ask
 * the question and handle "no" without a try/catch.
 */
export const apiErrorBody = (error: unknown): Record<string, unknown> | null => {
  if (!axios.isAxiosError(error)) return null;
  const data: unknown = error.response?.data;
  return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null;
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