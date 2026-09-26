/**
 * NOD Makeup — runtime configuration contract.
 *
 * THE single source of truth for service naming, canonical env keys, ports,
 * client URL resolution and CORS origin matching.
 *
 * This module is intentionally PURE (no zod/dotenv/node imports) so it can be
 * bundled safely by browsers (CRA, Next.js) as well as loaded by Node services
 * (backend, media-server). Values still come from each service's env — the
 * KEY NAMES and the LOGIC live here, in one place, instead of one copy per
 * system. When anything diverges, fix it here.
 */
export type ServiceKind = 'api' | 'media' | 'admin' | 'store';
/**
 * Canonical env keys per service. `scripts/sync-env.mjs` renders every
 * per-service .env file from the root `.env` using exactly these names, so
 * docs, loaders and generators can never drift from the code again.
 */
export declare const ENV_CONTRACT: {
    readonly api: {
        readonly envFile: "backend/.env";
        readonly defaultPort: 5001;
        readonly keys: {
            readonly port: "PORT";
            readonly gatewayUrl: "GATEWAY_URL";
            readonly mediaBaseUrl: "MEDIA_BASE_URL";
            readonly adminPanelUrl: "ADMIN_PANEL_URL";
            readonly storeUrl: "STORE_URL";
            readonly safeOrigins: "SAFE_ORIGINS";
        };
    };
    readonly media: {
        readonly envFile: "media-server/.env";
        readonly defaultPort: 5002;
        readonly keys: {
            readonly port: "PORT";
            readonly mediaBaseUrl: "MEDIA_BASE_URL";
            readonly mediaApiKey: "MEDIA_API_KEY";
            readonly safeOrigins: "SAFE_ORIGINS";
        };
    };
    readonly admin: {
        readonly envFile: "admin-panel/.env";
        readonly defaultPort: 3000;
        readonly keys: {
            readonly apiUrl: "REACT_APP_API_URL";
            readonly mediaUrl: "REACT_APP_MEDIA_URL";
        };
    };
    readonly store: {
        readonly envFile: "main-website/.env";
        readonly defaultPort: 3001;
        readonly keys: {
            readonly gatewayUrl: "NEXT_PUBLIC_API_URL";
            readonly mediaBaseUrl: "NEXT_PUBLIC_MEDIA_URL";
            readonly allowedDevOrigins: "ALLOWED_DEV_ORIGINS";
        };
    };
};
/** Service identity metadata (labels used by docs / scripts). */
export declare const SERVICES: Record<ServiceKind, {
    name: string;
    envFile: string;
    defaultPort: number;
}>;
export declare function defaultPortOf(kind: ServiceKind): number;
/** Parse a comma-separated origin list (trims, drops empties). */
export declare function parseOriginList(raw: string | null | undefined): string[];
/** Does a single allowlist entry match the given origin? */
export declare function originMatches(origin: string, entry: string): boolean;
/**
 * Decision single point for CORS:
 * - No Origin header (non-browser clients, same-page navigations) → allowed.
 * - Otherwise the origin must match an explicit allowlist entry.
 */
export declare function allowOrigin(origin: string | null | undefined, allowlist: Iterable<string> | string[]): boolean;
export interface DeriveClientBaseUrlInput {
    kind: ServiceKind;
    /** Build-time inlined URL from the service env (may be empty). */
    envUrl: string;
    /** What the page was actually opened on (browser only). */
    browserLocation?: {
        protocol?: string;
        hostname?: string;
    } | null;
}
export declare function deriveClientBaseUrl({ kind, envUrl, browserLocation }: DeriveClientBaseUrlInput): string;
