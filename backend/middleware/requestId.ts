import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
    namespace Express {
        interface Request {
            requestId?: string;
        }
    }
}

// x-request-id correlation: honour an inbound well-formed ID, otherwise mint one,
// then echo it on the response and pin it on req.requestId for outbox event metadata.
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export const requestId = (req: Request, res: Response, next: NextFunction) => {
    const inbound = req.headers['x-request-id'];
    const id =
        typeof inbound === 'string' && REQUEST_ID_RE.test(inbound)
            ? inbound
            : randomUUID();
    req.requestId = id;
    res.setHeader('x-request-id', id);
    next();
};