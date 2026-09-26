import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { env } from '../../config/env';
import * as auth from '../../services/adminAuthService';
import { DomainError } from '../../services/domainError';

const cookieBase = {
    httpOnly: true,
    // Secure cookies only over HTTPS (production); dev runs on plain HTTP.
    secure: env.nodeEnv === 'production',
    sameSite: 'lax' as const,
    path: '/',
};

const setTokenCookies = (res: Response, tokens: auth.IssuedTokens) => {
    res.cookie('jwt', tokens.accessToken, { ...cookieBase, maxAge: auth.ACCESS_COOKIE_MAX_AGE });
    res.cookie('jwt_refresh', tokens.refreshToken, { ...cookieBase, maxAge: auth.REFRESH_COOKIE_MAX_AGE });
};

// @desc    Authenticate admin & get token pair (access + refresh)
const loginAdmin = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    let admin: auth.AdminProfile;
    try {
        admin = await auth.authenticateAdmin(email, password);
    } catch (err) {
        if (err instanceof DomainError) {
            res.status(err.status);
            throw new Error(err.message);
        }
        throw err;
    }

    setTokenCookies(res, auth.issueTokenPair(admin.id, admin.email));

    res.status(200).json(admin);
});

// @desc    Rotate the refresh token (silent renewal)
// @route   POST /api/admin/auth/refresh
// @access  Public (uses the jwt_refresh cookie)
const refreshAdmin = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.jwt_refresh;

    let result: { admin: auth.AdminProfile; tokens: auth.IssuedTokens };
    try {
        result = await auth.rotateRefreshSession(refreshToken);
    } catch (err) {
        if (err instanceof DomainError) {
            res.status(err.status);
            throw new Error(err.message);
        }
        throw err;
    }

    setTokenCookies(res, result.tokens);

    res.status(200).json(result.admin);
});

// @desc    Logout admin / revoke pair / clear cookies
const logoutAdmin = asyncHandler(async (req: Request, res: Response) => {
    await auth.revokeLogout(req.admin?.admin_id, req.cookies?.jwt, req.cookies?.jwt_refresh);

    res.cookie('jwt', '', { ...cookieBase, expires: new Date(0), maxAge: 0 });
    res.cookie('jwt_refresh', '', { ...cookieBase, expires: new Date(0), maxAge: 0 });
    res.status(200).json({ message: 'Logged out successfully' });
});

// @desc    Get current admin profile (Read-only, no logging needed)
// @route   GET /api/admin/auth/me
// @access  Private
const getMe = asyncHandler(async (req: Request, res: Response) => {
    if (!req.admin || !req.admin.admin_id) {
        res.status(401);
        throw new Error('Not authorized, token data missing');
    }

    const admin = await auth.getAdminProfile(req.admin.admin_id);

    if (!admin) {
        res.status(404);
        throw new Error('Admin not found in database');
    }

    res.status(200).json(admin);
});

export { loginAdmin, refreshAdmin, logoutAdmin, getMe };