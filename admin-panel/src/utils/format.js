import { MEDIA_URL } from '../api/axiosInstance';

export const money = (value) => {
    const n = Number(value || 0);
    return new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(n).replace('EGP', 'EGP ');
};

export const shortDate = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return '—'; }
};

export const shortDateTime = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString('en-EG', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        });
    } catch { return '—'; }
};

export const timeAgo = (value) => {
    if (!value) return '—';
    const then = new Date(value).getTime();
    const sec = Math.max(1, Math.round((Date.now() - then) / 1000));
    if (sec < 60) return 'just now';
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    if (day < 30) return `${day}d ago`;
    return shortDate(value);
};

export const initials = (firstName = '', lastName = '') =>
    `${(firstName?.[0] || '').toUpperCase()}${(lastName?.[0] || '').toUpperCase()}`.trim() || 'A';

export const slugify = (text) => {
    if (typeof text !== 'string') return '';
    return text.toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
};

export const errMsg = (err, fallback = 'Something went wrong.') =>
    err?.response?.data?.message || err?.message || fallback;

export const parseDecimal = (value) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
};

/* Resolve any stored media value (relative path, or legacy host URL) onto the
   page's own media host so images load at localhost and over the LAN. */
export const mediaSrc = (src) => {
    if (!src || typeof window === 'undefined') return src;
    if (/^(data|blob|javascript):/i.test(src)) return src;
    if (/^https?:\/\//i.test(src)) {
        try {
            const url = new URL(src);
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === window.location.hostname) {
                return `${window.location.protocol}//${window.location.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}${url.search}`;
            }
        } catch { /* invalid URL — return as-is */ }
        return src;
    }
    const base = MEDIA_URL.replace(/\/+$/, '');
    return `${base}/${src.replace(/^\/+/, '')}`;
};