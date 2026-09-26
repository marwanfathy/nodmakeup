'use client';

import { useEffect } from 'react';
import { setCsrfToken } from './api-client';

/** Re-registers the server-computed CSRF token (the layout knows the current
 *  session cookie) into the api-client module state. Module state resets to
 *  null on every full page load — and on dev HMR re-evaluations of
 *  api-client — so without this every mutation after a reload fails with
 *  "Invalid CSRF token". The token is a per-session constant, so the effect
 *  runs once per mounted session.
 */
export default function CsrfSync({ token }: { token: string }) {
  useEffect(() => {
    setCsrfToken(token);
  }, [token]);
  return null;
}