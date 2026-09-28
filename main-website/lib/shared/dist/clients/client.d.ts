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
/**
 * Whether a rejected request failed because the resource is not there.
 *
 * Several public routes answer 404 for a perfectly ordinary state — a hero
 * section slug nobody has created, a deactivated section. That is an answer,
 * not a fault, so a caller that cares about absence can tell it apart from a
 * genuine 5xx or a network failure without every call site re-deriving axios's
 * error shape.
 */
export declare const isNotFound: (error: unknown) => boolean;
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
export declare const apiErrorBody: (error: unknown) => Record<string, unknown> | null;
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
