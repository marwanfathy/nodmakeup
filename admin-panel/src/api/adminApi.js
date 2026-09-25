import client from './axiosInstance';
import { MEDIA_URL } from './axiosInstance';

const api = (method, url, body, config) => client[method](url, body, config).then(r => r.data);

const crud = (root) => ({
    getAll: (params) => api('get', root, { params }),
    getById: (id) => api('get', `${root}/${id}`),
    create: (body) => api('post', root, body),
    update: (id, body) => api('put', `${root}/${id}`, body),
    delete: (id) => api('delete', `${root}/${id}`),
});

/* ------------------------------------------------------------------ */

export const authApi = {
    login: (email, password) => api('post', '/api/v1/users/auth/login', { email, password }),
    logout: () => api('post', '/api/v1/users/auth/logout'),
    me: () => api('get', '/api/v1/users/auth/me'),
    refresh: () => api('post', '/api/v1/users/auth/refresh'),
};

export const dashboardApi = {
    getStats: () => api('get', '/api/v1/analytics/dashboard'),
};

export const analyticsApi = {
    getAnalytics: (params) => api('get', '/api/v1/analytics', { params }),
    getDashboard: () => api('get', '/api/v1/analytics/dashboard'),
    getRecentBehaviors: (params) => api('get', '/api/v1/analytics/behaviors/recent', { params }),
    getBehaviorInsights: (params) => api('get', '/api/v1/analytics/behaviors/insights', { params }),
    getVisitors: (params) => api('get', '/api/v1/analytics/visitors', { params }),
    getFunnel: (params) => api('get', '/api/v1/analytics/funnel', { params }),
};

export const productApi = {
    getAll: (params) => api('get', '/api/v1/catalog/products', { params }),
    getById: (id) => api('get', `/api/v1/catalog/products/${id}`),
    create: (body) => api('post', '/api/v1/catalog/products', body),
    update: (id, body) => api('put', `/api/v1/catalog/products/${id}`, body),
    delete: (id) => api('delete', `/api/v1/catalog/products/${id}`),
    archive: (id) => api('put', `/api/v1/catalog/products/${id}/archive`),
    unarchive: (id) => api('put', `/api/v1/catalog/products/${id}/unarchive`),
};

export const productImageApi = crud('/api/v1/catalog/product-images');

export const categoryApi = crud('/api/v1/catalog/categories');
export const brandApi = crud('/api/v1/catalog/brands');
export const collectionApi = crud('/api/v1/catalog/collections');

export const orderApi = {
    getAll: (params) => api('get', '/api/v1/orders', { params }),
    getById: (id) => api('get', `/api/v1/orders/${id}`),
    getStatuses: () => api('get', '/api/v1/orders/statuses'),
    updateStatus: (id, statusId) => api('put', `/api/v1/orders/${id}/status`, { statusId }),
    updateTransactionStatus: (id, status) => api('put', `/api/v1/orders/${id}/transaction-status`, { status }),
    sendReward: (id, payload) => api('post', `/api/v1/orders/${id}/send-reward`, payload),
};

export const discountApi = crud('/api/v1/orders/discounts');

export const storyApi = {
    getAll: () => api('get', '/api/v1/content/stories'),
    create: (payload) => api('post', '/api/v1/content/stories', payload),
    delete: (id) => api('delete', `/api/v1/content/stories/${id}`),
};

export const heroSectionApi = crud('/api/v1/content/hero-sections');

export const adminUserApi = {
    getAll: () => api('get', '/api/v1/users/admins'),
    create: (body) => api('post', '/api/v1/users/admins', body),
    delete: (id) => api('delete', `/api/v1/users/admins/${id}`),
};

export const crmApi = {
    getOverview: () => api('get', '/api/v1/crm/overview'),
    getSegments: () => api('get', '/api/v1/crm/segments'),
    getCustomers: (params) => api('get', '/api/v1/crm/customers', { params }),
    getCustomer: (id) => api('get', `/api/v1/crm/customers/${id}`),
    updateCustomer: (id, body) => api('put', `/api/v1/crm/customers/${id}`, body),
    addNote: (id, body) => api('post', `/api/v1/crm/customers/${id}/notes`, body),
    backfill: () => api('post', '/api/v1/crm/backfill'),
};

/* ---------- Media server (no auth / CSRF) ---------- */

const rebaseMedia = (json) => {
    if (json.path) json.url = json.path;
    if (json.thumbnailUrl) {
        try { json.thumbnailUrl = new URL(json.thumbnailUrl).pathname.replace(/^\/+/, ''); } catch { /* keep as-is */ }
    }
    return json;
};

const uploadTo = (path, file) => {
    const form = new FormData();
    form.append('media', file);
    return fetch(`${MEDIA_URL}${path}`, { method: 'POST', body: form })
        .then(async res => {
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Upload failed');
            return rebaseMedia(json);
        });
};

export const mediaApi = {
    uploadProductImage: (file) => uploadTo('/api/upload-product-image', file),
    uploadStory: (file) => uploadTo('/api/upload-story', file),
    uploadHeroMedia: (file) => uploadTo('/api/upload-hero-media', file),
    uploadAudio: (file) => uploadTo('/api/upload-audio', file),
    delete: (path) => fetch(`${MEDIA_URL}/api/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: path }),
    }).then(r => r.json()),
};