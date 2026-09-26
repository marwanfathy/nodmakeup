// Request-scoped helper: resolve the anonymous cart session id from the
// x-cart-session-id header (priority) or the cart_session_id cookie, minting
// and persisting a fresh session when neither is valid. Shared by the cart
// and order public controllers; cookie policy matches the legacy behavior.
import { Request, Response } from 'express';
import * as cartService from '../services/cartService';

export const getOrCreateSessionId = async (req: Request, res: Response): Promise<string> => {
    const header = req.headers['x-cart-session-id'];
    const hinted =
        header !== undefined
            ? typeof header === 'string'
                ? header
                : undefined
            : typeof req.cookies.cart_session_id === 'string'
              ? req.cookies.cart_session_id
              : undefined;

    const valid = await cartService.resolveSession(hinted);
    if (valid) return valid;

    const newSessionId = await cartService.createSession();
    res.cookie('cart_session_id', newSessionId, {
        httpOnly: true,
        secure: true,
        sameSite: 'none', // Required for Cross-site (Vercel -> Ngrok)
        maxAge: 365 * 24 * 60 * 60 * 1000,
        path: '/',
    });
    return newSessionId;
};