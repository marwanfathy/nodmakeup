import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import prisma from '../config/prismaClient';

// --- 1. Simplify the JWT payload structure ---
// typ differentiates access vs refresh tokens; jti enables revocation.
export interface AdminJwtPayload extends JwtPayload {
    admin_id: string; // UUID string
    email: string;
    typ: 'access' | 'refresh';
    jti?: string;
    // The 'role' property is now gone
}

// --- 2. Update the extended Express Request type ---
declare global {
    namespace Express {
        interface Request {
            admin?: AdminJwtPayload;
        }
    }
}

// --- 3. Upgraded 'protect' Middleware ---
const protect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.jwt;

    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AdminJwtPayload;

        // Only access tokens may call protected routes; refresh tokens are for /refresh.
        if (decoded.typ !== 'access') {
            res.status(401);
            throw new Error('Not authorized, invalid token type');
        }

        // Revocation check (TokenBlocklist). Access tokens normally aren't stored,
        // so this only blocks tokens explicitly revoked (logout/rotation).
        if (decoded.jti) {
            const blocked = await prisma.tokenBlocklist.findUnique({ where: { jti: decoded.jti } });
            if (blocked) {
                res.status(401);
                throw new Error('Not authorized, token revoked');
            }
        }

        // Attach the simplified payload to the request object
        req.admin = {
            admin_id: decoded.admin_id,
            email: decoded.email,
            typ: decoded.typ,
            jti: decoded.jti,
        };

        next();
    } catch (error) {
        res.status(401);
        throw new Error('Not authorized, token failed');
    }
});

// --- 4. The 'authorize' function is GONE ---
// We delete it completely.

// --- 5. Export only the 'protect' middleware ---
export { protect };