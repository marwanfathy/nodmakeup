import * as Sentry from '@sentry/node';

// Sentry is strictly opt-in: no SENTRY_DSN => zero runtime cost, no handler.
export { Sentry };

let enabled = false;

export function initSentry(): boolean {
    if (enabled || !process.env.SENTRY_DSN) return enabled;
    enabled = true;
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV ?? 'development',
        serverName: process.env.SERVICE_NAME ?? 'api',
        tracesSampleRate: 0.1,
    });
    return true;
}