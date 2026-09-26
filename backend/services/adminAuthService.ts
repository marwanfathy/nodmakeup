// Admin auth service — authentication, token-pair issuance/rotation and
// revocation. Cookie transport stays in the controller; everything token/DB
// related (jwt signing, blocklist, sweeping, audit) lives here.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import prisma from '../config/prismaClient';
import { env } from '../config/env';
import { logAdminAction } from '../utils/logger';
import { AdminActionType } from '@prisma/client';
import { AdminJwtPayload } from '../middleware/authMiddleware';
import { DomainError } from './domainError';

// Access cookie matches JWT_EXPIRES_IN (15m). Refresh cookie: 7 days.
export const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000;
export const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const REFRESH_EXPIRES_IN = '7d';

export interface IssuedTokens {
    accessToken: string;
    refreshToken: string;
}

export interface AdminProfile {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

// Revoke a token jti so protect()/refresh reject it. The blocklist holds ONLY
// revoked jtis — never live tokens — so rotate/logout add the outgoing one here.
const revokeToken = async (jti: string | undefined, adminId: string, expiresAtMs: number) => {
    if (!jti) return;
    try {
        await prisma.tokenBlocklist.upsert({
            where: { jti },
            update: { expiresAt: new Date(expiresAtMs) },
            create: { jti, adminId, expiresAt: new Date(expiresAtMs) },
        });
    } catch {
        /* unique race: already revoked */
    }
};

const sweepExpiredTokens = async () => {
    try {
        await prisma.tokenBlocklist.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    } catch {
        /* non-fatal */
    }
};

/** Mint a fresh access + refresh pair (live tokens are never persisted). */
export function issueTokenPair(adminId: string, email: string): IssuedTokens {
    const accessToken = jwt.sign(
        { admin_id: adminId, email, typ: 'access', jti: randomUUID() },
        env.jwtSecret,
        { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] },
    );
    const refreshToken = jwt.sign(
        { admin_id: adminId, email, typ: 'refresh', jti: randomUUID() },
        env.jwtSecret,
        { expiresIn: REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    return { accessToken, refreshToken };
}

/** Validate admin credentials; logs success/failure and returns the profile. */
export async function authenticateAdmin(email: string, password: string): Promise<AdminProfile> {
    const admin = await prisma.admin.findUnique({ where: { email } });

    if (admin && (await bcrypt.compare(password, admin.password))) {
        await logAdminAction({
            adminId: admin.id,
            actionType: AdminActionType.LOGIN_SUCCESS,
        });

        return {
            id: admin.id,
            firstName: admin.firstName,
            lastName: admin.lastName,
            email: admin.email,
        };
    }

    if (admin) {
        await logAdminAction({
            adminId: admin.id,
            actionType: AdminActionType.LOGIN_FAILURE,
            details: { attempt_email: email },
        });
    }

    throw new DomainError('Invalid email or password', 401);
}

/**
 * Rotate a refresh token (silent renewal): verifies signature/type, rejects
 * revoked jtis, revokes the outgoing refresh, sweeps expired blocklist rows
 * and mints a fresh pair.
 */
export async function rotateRefreshSession(refreshToken: string): Promise<{
    admin: AdminProfile;
    tokens: IssuedTokens;
}> {
    if (!refreshToken) {
        throw new DomainError('No refresh token provided', 401);
    }

    let decoded: AdminJwtPayload;
    try {
        decoded = jwt.verify(refreshToken, env.jwtSecret) as AdminJwtPayload;
    } catch {
        throw new DomainError('Refresh token invalid or expired', 401);
    }

    if (decoded.typ !== 'refresh') {
        throw new DomainError('Not a refresh token', 401);
    }

    const blocked = await prisma.tokenBlocklist.findUnique({ where: { jti: decoded.jti ?? '' } });
    if (blocked) {
        throw new DomainError('Refresh token revoked', 401);
    }

    const admin = await prisma.admin.findUnique({ where: { id: decoded.admin_id } });
    if (!admin) {
        throw new DomainError('Admin no longer exists', 401);
    }

    // Rotation: old refresh is dead, mint a fresh pair.
    await revokeToken(decoded.jti, admin.id, Date.now() + REFRESH_COOKIE_MAX_AGE);
    await sweepExpiredTokens();

    return {
        admin: {
            id: admin.id,
            firstName: admin.firstName,
            lastName: admin.lastName,
            email: admin.email,
        },
        tokens: issueTokenPair(admin.id, admin.email),
    };
}

/** Revoke whatever tokens were readable + audit a logout. */
export async function revokeLogout(adminId: string | undefined, accessToken?: string, refreshToken?: string) {
    let accessJti: string | undefined;
    let refreshJti: string | undefined;

    try {
        const access = jwt.verify(accessToken ?? '', env.jwtSecret) as AdminJwtPayload;
        accessJti = access.jti;
    } catch {
        /* missing/expired access token is fine */
    }

    try {
        const refresh = jwt.verify(refreshToken ?? '', env.jwtSecret) as AdminJwtPayload;
        refreshJti = refresh.jti;
    } catch {
        /* missing/expired refresh token is fine */
    }

    const admin = adminId
        ? await prisma.admin.findUnique({ where: { id: adminId }, select: { id: true } })
        : null;

    // Needs a valid adminId FK.
    if (admin?.id) {
        await revokeToken(accessJti, admin.id, Date.now() + 60 * 60 * 1000);
        await revokeToken(refreshJti, admin.id, Date.now() + REFRESH_COOKIE_MAX_AGE);
    }

    if (adminId) {
        await logAdminAction({
            adminId,
            actionType: AdminActionType.LOGOUT,
        });
    }
}

/** Current admin profile (read-only); null when the admin no longer exists. */
export async function getAdminProfile(adminId: string): Promise<AdminProfile | null> {
    const admin = await prisma.admin.findUnique({
        where: { id: adminId },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
        },
    });

    if (!admin) return null;

    return {
        id: admin.id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
    };
}