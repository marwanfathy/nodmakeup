// media-server/src/middleware/requestId.js
// Request-id correlation: honours an inbound `x-request-id` (the backend's
// requestId middleware stamps + echoes the same header, so a media upload that
// inherits it becomes a second span in the same trace), otherwise mints one.
// Always echoes the id on the response so downstream clients can propagate it.
import { randomUUID } from 'node:crypto';

const VALID_ID = /^[A-Za-z0-9_-]{8,64}$/;

export function requestId(req, res, next) {
    const inbound = req.get('x-request-id');
    const id = inbound && VALID_ID.test(inbound) ? inbound : randomUUID();
    req.requestId = id;
    res.setHeader('x-request-id', id);
    next();
}