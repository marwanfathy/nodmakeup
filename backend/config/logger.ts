import { AsyncLocalStorage } from 'node:async_hooks';
import pino, { Logger } from 'pino';
import { Request, Response, NextFunction } from 'express';

// Per-request correlation context propagated through async chains (outbox
// writes, queue jobs) without threading a `logger` argument everywhere.
export const requestCtx = new AsyncLocalStorage<{ requestId: string }>();

export const logger: Logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    base: {
        service: process.env.SERVICE_NAME ?? 'api',
        app: (process.env.NODE_ENV ?? 'development'),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});

// A logger bound to the ambient request id (if an HTTP request is in flight).
export const reqLogger = (extra?: Record<string, unknown>): Logger => {
    const store = requestCtx.getStore();
    return logger.child({
        ...(store?.requestId ? { requestId: store.requestId } : {}),
        ...extra,
    });
};

// Middleware: pin req.requestId into the ALS context so any async work spawned
// during the request (outbox enqueue, BullMQ jobs) inherits it automatically.
export const bindRequestContext = (req: Request, _res: Response, next: NextFunction) => {
    requestCtx.run({ requestId: req.requestId ?? 'no-id' }, () => next());
};