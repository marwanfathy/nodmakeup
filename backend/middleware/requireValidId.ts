import { Request, Response, NextFunction } from 'express';
import { protect } from './authMiddleware';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Co-mounting guard for merged admin/public resources under /api/v1.
 * All entity PKs/FKs are uuid.v4 strings. Only UUID-shaped ids proceed to the
 * admin handler; anything else (slug, orderNumber, couponCode, ...) falls
 * through to the public handler mounted at the same path.
 */
const requireValidId = (req: Request, res: Response, next: NextFunction): void => {
  const raw = req.params.id ?? req.params.orderId ?? req.params.storyId;
  if (!raw || !UUID_RE.test(raw)) {
    return next('route');
  }
  next();
};

/**
 * Guard for shared read endpoints (admin + public on the same URI).
 * - No bearer token AND no admin session cookie -> treat as a public call and
 *   fall through to the public handler mounted after this router.
 * - Bearer token OR admin JWT cookie     -> enforce admin `protect`, then the
 *   admin handler. The admin SPA authenticates via the httpOnly 'jwt' cookie
 *   (withCredentials), not a bearer header, so the cookie must count too.
 */
const protectIfToken = (req: Request, res: Response, next: NextFunction): void => {
  const hasBearer =
    typeof req.headers.authorization === 'string' &&
    req.headers.authorization.startsWith('Bearer ');
  const hasSessionCookie =
    typeof req.cookies?.['jwt'] === 'string' && req.cookies['jwt'].length > 0;
  if (!hasBearer && !hasSessionCookie) {
    return next('route');
  }
  protect(req, res, next);
};

export { requireValidId, protectIfToken };
export default requireValidId;