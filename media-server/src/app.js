// Composition root: assemble the express app with all cross-cutting concerns.
// No route logic lives here — routes and services are standalone modules.
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { isAllowedOrigin } from './config/index.js';
import { apiKeyAuth } from './middleware/auth.js';
import { requestId } from './middleware/requestId.js';
import mediaRoutes from './routes/media.routes.js';
import healthRoutes from './routes/health.routes.js';
import uploadRoutes from './routes/upload.routes.js';

export function buildApp() {
  const app = express();

  // 1. Security & compression (parity with legacy middleware order).
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.use(express.json());

  // 2. Request logging — 'who' = client IP, 'reqId' = correlated request id
  //    (same line format as before, plus the id for request tracing).
  morgan.token('who', (req) => req.ip || req.connection?.remoteAddress || 'Unknown');
  morgan.token('reqId', (req) => req.requestId || '-');
  app.use(requestId);
  app.use(morgan('[:date[iso]] Who: :who | ReqId: :reqId | Name: :method :url | Status: :status | Time: :response-time ms'));

  // 3. CORS — strict SAFE_ORIGINS allowlist. A blocked origin gets a clean
  //    non-2xx WITHOUT ACAO (no exception thrown), same as before.
  app.use(cors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    credentials: true,
  }));

  // 4. Public media — uploads/ + thumbnails/ only; staging is never served.
  app.use(mediaRoutes);

  // 5. Op-auth for /api/* — API key for servers, trusted Origin for browsers.
  app.use(apiKeyAuth);

  // 6. Write endpoints + liveness.
  app.use(uploadRoutes);
  app.use(healthRoutes);

  return app;
}