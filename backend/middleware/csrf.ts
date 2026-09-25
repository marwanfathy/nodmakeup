import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';

// CSRF double-submit defense for the cookie-authenticated admin API.
// Enforcement is gated on a valid admin session (the signed 'jwt' cookie): only
// requests carrying credentials can be forged cross-site, so anonymous public
// routes (storefront checkout, coupons, catalog) pass through untouched.
//
// The token check is scoped to the ADMIN PANEL origin (dev port :3000, incl.
// LAN mirrors). The storefront is a separate first-party app on port :3001 that
// intentionally never mints CSRF tokens — yet it shares the admin session cookie
// in any browser where the admin is logged in, and gating on the cookie alone
// would 403 every storefront mutation from that browser. Origin-scoping keeps
// full token enforcement for admin traffic while storefront mutations (checkout,
// coupons, catalog) pass through untouched, per the intent above.
//
// A random token is mirrored in a NON-httpOnly 'csrf' cookie; every
// state-changing, authenticated ADMIN-panel request must echo it back in
// X-CSRF-Token.
export const csrfProtect = (req: Request, res: Response, next: NextFunction) => {
    // Non-browser clients send no Origin and are not CSRF targets either.
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
    if (!origin.includes(':3000')) return next();

    let authed = false;
    try {
        const token = req.cookies?.['jwt'];
        if (token) {
            jwt.verify(token, process.env.JWT_SECRET!);
            authed = true;
        }
    } catch { /* missing/expired session -> treat as anonymous */ }

    if (!authed) return next();

    const existing = req.cookies?.['csrf'];

    if (!existing || existing.length !== 48) {
        const token = randomBytes(24).toString('hex');
        res.cookie('csrf', token, {
            httpOnly: false, // must be readable by the SPA to mirror into the header
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
        });
        // First mutation before any cookie existed: mint + ask the SPA to retry.
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
            res.status(403);
            throw new Error('CSRF token was missing, refresh the page and retry.');
        }
        return next();
    }

    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const header = req.headers['x-csrf-token'];
        if (!header || header !== existing) {
            res.status(403);
            throw new Error('CSRF validation failed');
        }
    }

    next();
};