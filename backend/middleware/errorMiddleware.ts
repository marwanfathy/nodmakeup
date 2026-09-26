import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { Sentry } from '../config/sentry';
import { reqLogger } from '../config/logger';

// Handles 404 Not Found errors
const notFound = (req: Request, res: Response, next: NextFunction) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

// Error with a statusCode attached by a thrower (res.status(n) + throw pattern).
interface HttpError extends Error {
    statusCode?: number;
    errors?: unknown;
}

const isPrismaError = (err: Error): err is Prisma.PrismaClientKnownRequestError =>
    err instanceof Prisma.PrismaClientKnownRequestError;

const reportToSentry = (err: HttpError, req: Request, statusCode: number) => {
    if (!process.env.SENTRY_DSN || statusCode < 500) return;
    Sentry.withScope((scope) => {
        scope.setTag('requestId', req.requestId ?? '-');
        scope.setTag('http.method', req.method);
        scope.setTag('http.url', req.originalUrl);
        Sentry.captureException(err);
    });
};

// Sanitized general error handler (no leaks in production).
const errorHandler = (err: HttpError, req: Request, res: Response, next: NextFunction) => {
    // Sometimes an error might come in with a 200 status code, default to 500
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    reportToSentry(err, req, statusCode);

    // Prisma driver/validation errors must NEVER leak to clients (they can expose
    // schema/PII). Map to a generic 500 and log the real cause server-side.
    if (isPrismaError(err) || err instanceof Prisma.PrismaClientValidationError) {
        reqLogger({ requestId: req.requestId ?? '-' })
            .error({ err: err.message }, `${req.method} ${req.originalUrl} -> Prisma error`);
        if (!res.headersSent) res.status(500);
        res.json({ success: false, message: 'Internal server error' });
        return;
    }

    reqLogger({ requestId: req.requestId ?? '-' })
        .error({ err: err.stack ?? err.message }, `${req.method} ${req.originalUrl} -> ${statusCode}`);

    const isProd = process.env.NODE_ENV === 'production';
    res.status(statusCode);
    res.json({
        success: false,
        // Client-authored 4xx errors carry our own safe messages even in prod
        // (login failures, stock conflicts, validation). 5xx stays generic.
        message:
            statusCode >= 500 && isProd
                ? 'Internal server error'
                : err.message,
        stack: isProd ? undefined : err.stack,
        ...(err.errors ? { details: err.errors } : {}),
    });
};

export { notFound, errorHandler };