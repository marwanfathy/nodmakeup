import axios from 'axios';
import { deriveClientBaseUrl } from '@nod/shared/dist/runtime/config';

const browserLocation = () =>
    typeof window !== 'undefined' ? { protocol: window.location.protocol, hostname: window.location.hostname } : null;

// Canonical keys (REACT_APP_API_URL / REACT_APP_MEDIA_URL) — written by
// scripts/sync-env.mjs from the single root .env. Values are inlined by CRA.
// The resolution logic lives in @nod/shared/runtime/config (one source).
const API_URL = deriveClientBaseUrl({
    kind: 'api',
    envUrl: process.env.REACT_APP_API_URL || '',
    browserLocation: browserLocation(),
});
export const MEDIA_URL = deriveClientBaseUrl({
    kind: 'media',
    envUrl: process.env.REACT_APP_MEDIA_URL || '',
    browserLocation: browserLocation(),
});
export { API_URL };

const getCookie = (name) => {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
};

const client = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
        'X-Requested-With': 'XMLHttpRequest',
    },
});

// Mirror the double-submit CSRF cookie into the header on authenticated mutations.
client.interceptors.request.use((config) => {
    const method = (config.method || 'get').toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
        const csrf = getCookie('csrf');
        if (csrf) config.headers['X-CSRF-Token'] = csrf;
    }
    return config;
});

const refreshSession = async () => {
    try {
        await client.post('/api/v1/users/auth/refresh');
        return true;
    } catch {
        return false;
    }
};

// Session maintenance: rotate tokens on 401, echo freshly minted CSRF on 403.
let mutating = false;
client.interceptors.response.use(
    (res) => res,
    async (error) => {
        const { config, response } = error || {};
        if (!config) return Promise.reject(error);
        const status = response?.status;

        if (status === 401 && !config._refreshed) {
            if (mutating) {
                // A concurrent request is already refreshing; surface the failure.
                return Promise.reject(error);
            }
            mutating = true;
            try {
                const ok = await refreshSession();
                if (ok) {
                    config._refreshed = true;
                    const csrf = getCookie('csrf');
                    if (csrf) config.headers['X-CSRF-Token'] = csrf;
                    return client(config);
                }
            } finally {
                mutating = false;
            }
            return Promise.reject(error);
        }

        if (status === 403 && !config._csrfRetried) {
            // CSRF cookie may not exist yet: mint it via an authenticated GET, then retry once.
            config._csrfRetried = true;
            try {
                await client.get('/api/v1/users/auth/me');
                const csrf = getCookie('csrf');
                if (csrf) config.headers['X-CSRF-Token'] = csrf;
                return client(config);
            } catch {
                return Promise.reject(error);
            }
        }

        return Promise.reject(error);
    }
);

export default client;