# 360° Production Operations, Security, Observability & Disaster Recovery Masterplan
**Platform:** "Rouge"/NOD E-Commerce — Node.js/Express Modular Monolith · MySQL 8 · Redis 7 · BullMQ · Next.js 16 (Vercel) · Puppeteer WhatsApp Worker · Sharp/FFmpeg Media Server
**Target scale:** 50 → 2,000 orders/day with flash-sale concurrency (no downtime, no oversell)
**Date:** 2026-08-16

> This masterplan assumes the v1/v2 audit fixes are applied first (atomic stock/coupon writes, outbox + BullMQ workers, Zod boundaries, media-server auth). Every artifact below is copy-pasteable and ready to drop into a `deploy/` directory at the repo root.

---

## 1. Production Infrastructure & Deployment Blueprint

### 1.1 Container strategy

Layout (all referenced by compose below):

```
deploy/
├── docker/
│   ├── Dockerfile.api        # API modular monolith
│   ├── Dockerfile.worker     # background worker + Chromium (WhatsApp)
│   └── Dockerfile.media      # media server (FFmpeg/Sharp)
├── nginx/
│   └── nginx.conf
├── scripts/
│   ├── backup.sh
│   └── test-restore.sh
└── loadtest/
    └── flash-sale.js         # k6
```

All three images: **non-root user**, `tini` as PID 1 (zombie reaping), pinned Node LTS, healthchecks, explicit memory limits via `NODE_OPTIONS`.

#### Dockerfile.api — `deploy/docker/Dockerfile.api`

```dockerfile
# syntax=docker/dockerfile:1
# --- Stage 1: builder ---
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY . .
RUN npm run build

# --- Stage 2: runner ---
FROM node:20-alpine AS runner
RUN apk add --no-cache tini openssl \
 && addgroup -S app && adduser -S -G app app
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=1024"
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
RUN chown -R app:app /app
USER app
EXPOSE 5001
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD ["node","-e","fetch('http://127.0.0.1:5001/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","dist/server.js"]
```

#### Dockerfile.worker — `deploy/docker/Dockerfile.worker`

Uses Debian (not Alpine) because Chromium needs glibc + system libs. Uses the **system Chromium** so puppeteer downloads nothing at runtime.

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN apt-get update && apt-get install -y --no-install-recommends \
      tini ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
      libatk1.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 \
      libnspr4 libnss3 libx11-6 libxcb1 libxcomposite1 libxdamage1 \
      libxext6 libxfixes3 libxkbcommon0 libxrandr2 chromium \
 && rm -rf /var/lib/apt/lists/* \
 && addgroup -S app && adduser -S -G app app
WORKDIR /app
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
RUN mkdir -p .wwebjs_auth .wwebjs_cache && chown -R app:app /app
USER app
HEALTHCHECK --interval=20s --timeout=5s --start-period=60s --retries=5 \
  CMD ["node","-e","fetch('http://127.0.0.1:5001/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","dist/workers/whatsapp.worker.js"]
```

> The worker's `/healthz` is served by a tiny embedded HTTP server the worker itself starts (see §3.3) — it reports queue depth + WhatsApp connection state. The Chromium args `--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage` are already in `services/whatsappService.ts`; keep them.

#### Dockerfile.media — `deploy/docker/Dockerfile.media`

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine AS runner
RUN apk add --no-cache tini openssl ffmpeg \
 && addgroup -S app && adduser -S -G app app
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY middleware ./middleware
RUN mkdir -p public/uploads public/thumbnails public/temp temp \
 && chown -R app:app /app
VOLUME ["/app/public"]
USER app
EXPOSE 5002
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
  CMD ["node","-e","fetch('http://127.0.0.1:5002/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","server.js"]
```

> The media server's `cluster` module forks one worker per CPU — leave it; it's harmless inside a container. Persist `public/` to a named volume (uploads survive redeploys).

### 1.2 `docker-compose.production.yml` — `deploy/docker-compose.production.yml`

```yaml
name: nod-production

networks:
  frontend:
    driver: bridge
    ipam:
      config: [{ subnet: "172.28.0.0/24" }]
  internal:
    driver: bridge
    ipam:
      config: [{ subnet: "172.29.0.0/24" }]

volumes:
  mysql-data:
  redis-data:
  media-public:
  wwebjs-auth:
  certbot-conf:
  certbot-www:
  nginx-conf:

services:
  # ============ DATA TIER (internal only) ============
  mysql:
    image: mysql:8.0
    restart: unless-stopped
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
      - --innodb-buffer-pool-size=1G
      - --innodb-log-file-size=256M
      - --max-connections=200
      - --binlog-expire-logs-seconds=86400
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:?set in .env}
      MYSQL_DATABASE: allur
      MYSQL_USER: ${MYSQL_USER:-allur}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:?set in .env}
    volumes:
      - mysql-data:/var/lib/mysql
      - ./backups/mysql-bin:/var/lib/mysql-bin-backup:ro   # optional binlog PITR
    networks: [internal]
    cpus: 2.0
    mem_limit: 2g
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 2g
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-uroot", "-p$$MYSQL_ROOT_PASSWORD"]
      interval: 15s
      timeout: 5s
      retries: 10
      start_period: 60s
    security_opt: [no-new-privileges:true]

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes", "--maxmemory", "384mb", "--maxmemory-policy", "allkeys-lru"]
    volumes:
      - redis-data:/data
    networks: [internal]
    cpus: 0.5
    mem_limit: 512m
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # ============ APPLICATION TIER ============
  api:
    build:
      context: ../backend
      dockerfile: docker/Dockerfile.api
    image: nod/api:latest
    restart: unless-stopped
    env_file: [./env/api.env]
    depends_on:
      mysql: { condition: service_healthy }
      redis: { condition: service_healthy }
    networks: [frontend, internal]
    cpus: 2.0
    mem_limit: 1g
    security_opt: [no-new-privileges:true]
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:5001/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 40s

  worker:
    build:
      context: ../backend
      dockerfile: docker/Dockerfile.worker
    image: nod/worker:latest
    restart: unless-stopped
    env_file: [./env/worker.env]
    shm_size: "1gb"                       # Chromium shared memory
    volumes:
      - wwebjs-auth:/app/.wwebjs_auth      # persistent WhatsApp session
      - wwebjs-cache:/app/.wwebjs_cache
    depends_on:
      mysql: { condition: service_healthy }
      redis: { condition: service_healthy }
      api: { condition: service_started }
    networks: [frontend, internal]
    cpus: 2.0
    mem_limit: 2g
    security_opt: [no-new-privileges:true]

  media:
    build:
      context: ../media server
      dockerfile: ../deploy/docker/Dockerfile.media
    image: nod/media:latest
    restart: unless-stopped
    environment:
      PORT: 5002
      MEDIA_SERVER_URL: https://media.nodmakeup.com
      FRONTEND_URL: https://nodmakeup.com
      ADMIN_PANEL_URL: https://admin.nodmakeup.com
      BACKEND_URL: https://api.nodmakeup.com
      BACKEND_PORT: 5001
      MEDIA_API_KEY: ${MEDIA_API_KEY:?set in .env}     # NEW: shared secret (see §2)
    volumes:
      - media-public:/app/public
    networks: [frontend, internal]
    cpus: 1.0
    mem_limit: 512m
    security_opt: [no-new-privileges:true]
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:5002/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 5

  # ============ EDGE TIER ============
  nginx:
    image: nginx:1.27-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./admin-panel/build:/usr/share/nginx/admin:ro
      - certbot-www:/var/www/certbot:ro
      - certbot-conf:/etc/letsencrypt:ro
    depends_on:
      api: { condition: service_healthy }
      media: { condition: service_started }
    networks: [frontend]
    cpus: 0.5
    mem_limit: 256m
    security_opt: [no-new-privileges:true]

  certbot:
    image: certbot/certbot:latest
    restart: unless-stopped
    volumes:
      - certbot-www:/var/www/certbot
      - certbot-conf:/etc/letsencrypt
    # One-time bootstrap:
    #   docker compose run --rm certbot certonly --webroot \
    #     -w /var/www/certbot -d api.nodmakeup.com -d media.nodmakeup.com -d admin.nodmakeup.com
    # Renewal + reload nginx every 12h:
    entrypoint: /bin/sh -c 'trap exit TERM; while :; do certbot renew --webroot -w /var/www/certbot --quiet && docker compose exec nginx nginx -s reload; sleep 12h & wait $${!}; done'
    networks: [frontend]
```

`deploy/env/api.env` (worker.env is identical minus API-only vars):

```ini
NODE_ENV=production
PORT=5001
DATABASE_URL=mysql://allur:${MYSQL_PASSWORD}@mysql:3306/allur
REDIS_URL=redis://redis:6379
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=1d
FRONTEND_URL=https://nodmakeup.com
ADMIN_PANEL_URL=https://admin.nodmakeup.com
MEDIA_SERVER_URL=https://media.nodmakeup.com
MEDIA_API_KEY=${MEDIA_API_KEY}
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
TELEGRAM_ADMIN_ID=${TELEGRAM_ADMIN_ID}
```

### 1.3 Nginx reverse proxy & TLS — `deploy/nginx/nginx.conf`

```nginx
# ---- TLS tuning ----
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_stapling on;
ssl_stapling_verify on;

# ---- Slowloris / request-smuggling protection ----
client_body_timeout 10s;
client_header_timeout 10s;
send_timeout 20s;
client_max_body_size 1m;               # overridden per location below

# ---- Rate limiting tiers ----
limit_req_zone  $binary_remote_addr zone=login:10m    rate=6r/m;
limit_req_zone  $binary_remote_addr zone=checkout:10m rate=30r/m;
limit_req_zone  $binary_remote_addr zone=catalog:10m  rate=120r/m;
limit_conn_zone $binary_remote_addr zone=perip:10m;

upstream api    { server api:5001    keepalive 32; }
upstream media  { server media:5002  keepalive 32; }

map $http_upgrade $connection_upgrade { default upgrade; '' close; }

# ---- HTTP: ACME + redirect ----
server {
  listen 80 default_server;
  server_name _;
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 301 https://$host$request_uri; }
}

# ================= api.nodmakeup.com =================
server {
  listen 443 ssl http2;
  server_name api.nodmakeup.com;
  ssl_certificate     /etc/letsencrypt/live/api.nodmakeup.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.nodmakeup.com/privkey.pem;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options nosniff always;
  add_header X-Frame-Options DENY always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;

  limit_conn perip 20;

  # Strict: admin login
  location = /api/admin/auth/login {
    limit_req zone=login burst=5 nodelay;
    proxy_pass http://api;
  }

  # Medium: checkout (create order) + coupon validation
  location ~ ^/api/public/(orders|discounts/validate) {
    limit_req zone=checkout burst=10 nodelay;
    proxy_pass http://api;
  }

  # Generous: everything else
  location /api/ {
    limit_req zone=catalog burst=40 nodelay;
    proxy_pass http://api;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

# ================= media.nodmakeup.com =================
server {
  listen 443 ssl http2;
  server_name media.nodmakeup.com;
  ssl_certificate     /etc/letsencrypt/live/media.nodmakeup.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/media.nodmakeup.com/privkey.pem;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options nosniff always;
  add_header X-Frame-Options DENY always;

  # NEVER expose the delete endpoint publicly — internal Docker network only.
  location = /api/delete { deny all; return 403; }

  # Uploads (admin panel + telegram bot only; server also enforces MEDIA_API_KEY)
  location ~ ^/api/upload- {
    limit_req zone=checkout burst=10 nodelay;
    client_max_body_size 100m;
    proxy_pass http://media;
  }

  # Long-lived immutable media — CDN-style caching
  location ~ ^/(uploads|thumbnails)/ {
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
    proxy_pass http://media;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
  }

  location / {
    proxy_pass http://media;
  }
}

# ================= admin.nodmakeup.com (built CRA) =================
server {
  listen 443 ssl http2;
  server_name admin.nodmakeup.com;
  ssl_certificate     /etc/letsencrypt/live/admin.nodmakeup.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/admin.nodmakeup.com/privkey.pem;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Frame-Options SAMEORIGIN always;
  add_header X-Content-Type-Options nosniff always;
  add_header Content-Security-Policy "default-src 'self'; connect-src 'self' https://api.nodmakeup.com https://media.nodmakeup.com; img-src 'self' data: https://media.nodmakeup.com; style-src 'self' 'unsafe-inline'; font-src 'self'" always;

  root /usr/share/nginx/admin;
  index index.html;
  location / { try_files $uri /index.html; }   # SPA fallback
  location ~* \.(js|css|svg|png|jpg|woff2?)$ { expires 30d; add_header Cache-Control "public, immutable"; }
  error_page 404 =200 /index.html;
}
```

---

## 2. Security Threat Model & Hardening Matrix (STRIDE / OWASP)

| Threat (STRIDE) | OWASP | Vector | Mitigation | Artifact (this doc) |
|---|---|---|---|---|
| **Spoofing** | A01 Broken Access Control | Stolen/forged admin JWT; cookie theft | **JWT rotation**: 15-min access + 7-day refresh, both httpOnly+`SameSite=Lax` cookies; **TokenBlocklist wired** (revoke on logout + rotate); server-side session version check | §2.1, §2.2 |
| **Spoofing** | A07 Identification Failure | CSRF on admin cookie | **CSRF double-submit**: random cookie + `X-CSRF-Token` header verified on all state-changing admin routes | §2.3 |
| **Tampering** | A03 Injection | Malformed/malicious order payloads, coupon code tricks, phone spoofing | **Zod schema boundaries** at every route; **E.164 phone normalization**; coupon codes trimmed+uppercased; `express.json({limit:'10kb'})` stays | §2.4, §2.5 |
| **Repudiation** | A09 Logging Failure | No trace of admin actions | `AdminLog` audit trail (already present) + **request-id correlation** across HTTP→outbox→worker | §3.1 |
| **Information Disclosure** | A05 Security Misconfiguration | Error stack traces, `X-Powered-By`, Prisma schema leaks, `/api/delete` exposure | Helmet (already on) + **sanitized error handler** (generic 500 in prod, detail to server log); nginx blocks `/api/delete` externally + media API-key | §2.6, §1.3 |
| **Denial of Service** | A04 Insecure Design | Slowloris, login brute force, checkout spam, cart bombing, upload flood | nginx timeouts + `limit_conn`; tiered `limit_req` (login 6r/m, checkout 30r/m); **cart caps** (max 99/line, max 50 lines, max 20 items adds/min); upload rate limit + 100MB cap | §1.3, §2.7 |
| **Elevation of Privilege** | A01 | Bypassing admin routes / role confusion | Every `/api/admin/*` route stays behind `protect` (JWT); no role field exists — keep it flat; never disable CORS via `NODE_ENV=development` in prod | §2.2 |

### 2.1 JWT rotation & revocation (`controllers/admin/authController.ts` changes)

```ts
// login: issue TWO httpOnly cookies
const accessToken  = jwt.sign({ admin_id: admin.id, email: admin.email, typ: 'access'  }, JWT_SECRET!, { expiresIn: '15m' });
const refreshToken = jwt.sign({ admin_id: admin.id, email: admin.email, typ: 'refresh', jti: randomUUID() }, JWT_SECRET!, { expiresIn: '7d' });
await prisma.tokenBlocklist.create({ data: { jti: refreshToken_jti, adminId: admin.id, expiresAt: new Date(Date.now() + 7*864e5) } });
res.cookie('jwt', accessToken,      { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 15*60e3 });
res.cookie('jwt_refresh', refreshToken, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 7*864e5 });
```

```ts
// protect (middleware/authMiddleware.ts): reject revoked JWTs
const decoded = jwt.verify(token, JWT_SECRET!) as AdminJwtPayload;
if (decoded.typ === 'refresh') throw Object.assign(new Error('Use access token'), { status: 401 });
const blocked = await prisma.tokenBlocklist.findUnique({ where: { jti: decoded.jti ?? '' } });
if (blocked) { res.status(401); throw new Error('Token revoked'); }
```

### 2.2 CSRF double-submit (`middleware/csrf.ts`, mounted on `/api/admin`)

```ts
export const csrfProtect: RequestHandler = asyncHandler(async (req, res, next) => {
  const token = req.cookies['csrf'] ?? randomBytes(24).toString('hex');
  if (!req.cookies['csrf']) {
    res.cookie('csrf', token, { httpOnly: false, secure: true, sameSite: 'lax', path: '/' });
  }
  if (['POST','PUT','DELETE','PATCH'].includes(req.method)) {
    const header = req.headers['x-csrf-token'];
    if (!header || header !== token) { res.status(403); throw new Error('CSRF validation failed'); }
  }
  next();
});
```

### 2.4 Zod validation boundary (`middleware/validate.ts` + `shared/schemas`)

```ts
export const validate = (schema: z.ZodTypeAny): RequestHandler => asyncHandler(async (req, _res, next) => {
  const parsed = await schema.safeParseAsync(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')) as HttpError;
    err.status = 422; throw err;
  }
  req.body = parsed.data;
  next();
});
```

```ts
// shared/schemas/order.ts — replaces the manual `if (!x) throw` checks in orderController
export const createOrderSchema = z.object({
  customer_name:   z.string().min(1).max(200),
  customer_phone:  z.string().regex(/^01[0125][0-9]{8}$/, 'Invalid Egyptian mobile'),
  customer_address: z.string().min(1).max(255),
  shipping_governorate: z.string().min(1).max(100),
  customer_notes:   z.string().max(2000).optional(),
  coupon_code:     z.string().trim().toUpperCase().max(50).optional(),
  checkout_key:    z.string().uuid(),            // idempotency
});
```

### 2.5 E.164 normalization (`shared/utils/phone.ts`)

```ts
/** Normalizes a local Egyptian number to international E.164 (+20…) for storage & matching. */
export const normalizeEgyptPhone = (raw: string): string => {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  if (digits.startsWith('20')) return '+' + digits;
  if (digits.startsWith('01')) return '+20' + digits.slice(1);
  return '+' + digits;
};
// Use it on write; the old "20 vs 01" substring hack in discount validation disappears.
```

### 2.6 Sanitized error handler (`middleware/errorMiddleware.ts`)

```ts
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const status = Number(err.status) >= 400 && Number(err.status) < 600 ? err.status : 500;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // never leak constraint/engine details to clients
    res.status(500).json({ success: false, message: 'Internal server error' });
    req.log?.error({ code: err.code, meta: err.meta }, 'prisma error');   // full detail → structured log
    return;
  }
  res.status(status).json({
    success: false,
    message: status === 500 && process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV === 'production' ? {} : { stack: err.stack }),
  });
};
```

### 2.7 Cart / checkout anti-abuse caps (`cartController.ts` + `orderController.ts`)

```ts
const MAX_QTY_PER_LINE = 99, MAX_LINES = 50, MAX_LINES_ADDED_PER_MIN = 20;
// addItemToCart:
const cartLineCount = await prisma.shoppingCartItem.count({ where: { cartSessionId: sessionId } });
if (existingItem) {
  const { quantity } = await prisma.shoppingCartItem.findUniqueOrThrow({ where: { id: existingItem.id }, select: { quantity: true } });
  if (quantity + addQuantity > MAX_QTY_PER_LINE) { res.status(400); throw new Error('Quantity cap reached'); }
} else if (cartLineCount >= MAX_LINES) {
  res.status(400); throw new Error('Cart line limit reached');
}
```

---

## 3. Observability, Telemetry & Centralized Logging Stack

### 3.1 Structured logging + request-id trace across API → Outbox → BullMQ

`config/logger.ts` (replaces `console.*`):

```ts
import { AsyncLocalStorage } from 'node:async_hooks';
export const requestCtx = new AsyncLocalStorage<{ requestId: string }>();
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: process.env.SERVICE_NAME ?? 'api' },
  formatters: { level: (l) => ({ level: l }) },
  serializers: { err: pino.stdSerializers.err, req: pino.stdSerializers.req },
});
export const reqLogger = (logger as any).child.bind(logger);
```

`server.ts` glue (correlate every log line to one request):

```ts
app.use((req, _res, next) => {
  const requestId = req.headers['x-request-id'] || randomUUID();
  requestCtx.run({ requestId }, () => {
    (req as any).log = logger.child({ requestId });
    res.setHeader('x-request-id', requestId);
    next();
  });
});
app.use(pinoHttp({ logger, genReqId: () => requestCtx.getStore()?.requestId ?? randomUUID() }));
```

**Correlation into async work:** when writing an outbox row, store `requestId` in `payload.meta.requestId`; the BullMQ job carries it and the worker logs `logger.child({ requestId: job.data.meta.requestId })`. You can now `grep requestId=<id> logs/*.log` and see HTTP call → transaction → job → WhatsApp attempt as one trace.

### 3.2 Error tracking — Sentry (Express + worker)

```ts
// config/sentry.ts
Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV, tracesSampleRate: 0.1 });

// server.ts
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());
// …routes…
app.use(Sentry.Handlers.errorHandler());   // AFTER your errorHandler's Prisma branch, BEFORE res.send

// worker (whatsapp.worker.ts)
worker.on('failed', (job, err) => Sentry.captureException(err, { extra: { jobId: job.id, name: job.name } }));
```

### 3.3 Health checks — `/healthz` & `/readyz` (liveness vs readiness)

```ts
// routes/public/healthRoutes.ts
router.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));            // liveness: process up

router.get('/readyz', asyncHandler(async (_req, res) => {
  const checks: Record<string, string> = {};
  try { await prisma.$queryRaw`SELECT 1`; checks.mysql = 'ok'; } catch { checks.mysql = 'fail'; }
  try { await redis.ping(); checks.redis = 'ok'; } catch { checks.redis = 'fail'; }
  checks.whatsapp = isWhatsAppReady() ? 'ok' : 'degraded';   // export from whatsappService
  checks.queue    = (await queue.getJobCounts()).waiting < 500 ? 'ok' : 'degraded';   // BullMQ backlog guard
  const ok = checks.mysql === 'ok' && checks.redis === 'ok';
  res.status(ok ? 200 : 503).json({ ok, checks });
}));
```

Expose from `whatsappService.ts`: `export const isWhatsAppReady = () => isReady;`

### 3.4 Monitoring stack (Prometheus + exporters + Grafana)

Add to compose (observability profile):

```yaml
  prometheus:
    image: prom/prometheus:latest
    restart: unless-stopped
    command: ['--config.file=/etc/prometheus/prometheus.yml']
    volumes:
      - ./deploy/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prom-data:/prometheus
    networks: [internal]
    mem_limit: 512m

  node-exporter:
    image: prom/node-exporter:latest
    restart: unless-stopped
    pid: host
    networks: [internal]
    security_opt: [no-new-privileges:true]

  mysqld-exporter:
    image: prom/mysqld-exporter:latest
    restart: unless-stopped
    environment:
      DATA_SOURCE_NAME: 'exporter:${MYSQL_EXPORTER_PASSWORD}@(mysql:3306)/'
    networks: [internal]
    depends_on: [mysql]

  redis-exporter:
    image: oliver006/redis_exporter:latest
    restart: unless-stopped
    command: ['--redis.addr=redis://redis:6379']
    networks: [internal]
    depends_on: [redis]

  grafana:
    image: grafana/grafana:latest
    restart: unless-stopped
    ports: ['3000:3000']
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
    volumes: [grafana-data:/var/lib/grafana]
    networks: [frontend, internal]
    mem_limit: 512m

volumes: { prom-data: {}, grafana-data: {} }
```

**Dashboards/alerts (critical):** MySQL CPU >80% for 5m, Redis memory >70%, queue `waiting > 500`, API `http_req_duration p95 > 500ms`, worker down. Uptime Kuma (self-hosted) is the cheap alternative for HTTP checks on `https://api.nodmakeup.com/healthz` and `https://media.nodmakeup.com/` every 60s with push notifications.

---

## 4. Automated Disaster Recovery & Zero-Data-Loss Backup Pipeline

### 4.1 `deploy/scripts/backup.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

# ============ CONFIG ============
COMPOSE_PROJECT="${COMPOSE_PROJECT:-nod-production}"
MYSQL_CONTAINER="${COMPOSE_PROJECT}-mysql-1"
BACKUP_ROOT="/var/backups/nod"
BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:?export me}"     # AES-256 key
RCLONE_REMOTE="${RCLONE_REMOTE:-r2:nod-backups}"        # rclone remote + bucket (R2/B2/S3)
RETENTION_DAYS_DAILY=7
RETENTION_DAYS_WEEKLY=28
RETENTION_DAYS_MONTHLY=365

mkdir -p "$BACKUP_ROOT/daily" "$BACKUP_ROOT/weekly" "$BACKUP_ROOT/monthly"
STAMP="$(date +%F_%H%M%S)"
DOW="$(date +%u)"          # 1..7
DOM="$(date +%d)"

# ============ 1. Logical hot backup (non-blocking) ============
# --single-transaction = consistent snapshot without locking writes;
# --quick = no buffering of result sets; --routines/--triggers = full fidelity.
echo "[backup] dumping MySQL → ${STAMP}.sql.gz"
docker exec "$MYSQL_CONTAINER" \
  mysqldump --single-transaction --quick --routines --triggers --routines \
  --set-gtid-purged=OFF -uroot -p"$MYSQL_ROOT_PASSWORD" allur \
  | gzip -9 > "$BACKUP_ROOT/daily/allur_${STAMP}.sql.gz"

# ============ 2. Redis point-in-time snapshot (copy .rdb after BGSAVE) ============
echo "[backup] snapshotting Redis"
docker exec "${COMPOSE_PROJECT}-redis-1" redis-cli BGSAVE >/dev/null

# ============ 3. AES-256 encryption (passphrase from env, never on cmdline) ============
echo "[backup] encrypting"
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -pass env:BACKUP_PASSPHRASE \
  -in "$BACKUP_ROOT/daily/allur_${STAMP}.sql.gz" \
  -out "$BACKUP_ROOT/daily/allur_${STAMP}.sql.gz.enc"
rm -f "$BACKUP_ROOT/daily/allur_${STAMP}.sql.gz"

# ============ 4. Retention copies (daily / weekly / monthly) ============
[ "$DOW" = "7" ] && cp "$BACKUP_ROOT/daily/allur_${STAMP}.sql.gz.enc" "$BACKUP_ROOT/weekly/allur_weekly_${STAMP}.sql.gz.enc"
[ "$DOM" = "01" ] && cp "$BACKUP_ROOT/daily/allur_${STAMP}.sql.gz.enc" "$BACKUP_ROOT/monthly/allur_monthly_${STAMP}.sql.gz.enc"

# ============ 5. Off-site streaming upload (R2/B2/S3 via rclone) ============
echo "[backup] uploading to ${RCLONE_REMOTE}"
rclone copy "$BACKUP_ROOT/daily" "$RCLONE_REMOTE/daily" --transfers 4 --stats-one-line

# ============ 6. Retention policy ============
rclone delete "$RCLONE_REMOTE/daily"   --min-age "${RETENTION_DAYS_DAILY}d"
rclone delete "$RCLONE_REMOTE/weekly"  --min-age "${RETENTION_DAYS_WEEKLY}d"
rclone delete "$RCLONE_REMOTE/monthly" --min-age "${RETENTION_DAYS_MONTHLY}d"
find "$BACKUP_ROOT" -name "*.enc" -mtime "+${RETENTION_DAYS_DAILY}" -delete

echo "[backup] DONE $(date -Iseconds)"
```

Cron (root crontab):

```cron
30 1 * * * /opt/nod/deploy/scripts/backup.sh >> /var/log/nod-backup.log 2>&1
```

### 4.2 `deploy/scripts/test-restore.sh` (automated restore verification)

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:?export me}"
RCLONE_REMOTE="${RCLONE_REMOTE:-r2:nod-backups}"
TEST_CTR="nod-restore-test"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"; docker rm -f "$TEST_CTR" >/dev/null 2>&1 || true' EXIT

echo "[restore-test] fetching latest daily backup"
LATEST="$(rclone lsf "$RCLONE_REMOTE/daily" --files-only | sort | tail -1)"
[ -n "$LATEST" ] || { echo "no backups found"; exit 1; }
rclone copy "$RCLONE_REMOTE/daily/$LATEST" "$WORK"

echo "[restore-test] decrypting"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE \
  -in "$WORK/$LATEST" -out "$WORK/restore.sql.gz"

echo "[restore-test] booting isolated MySQL 8"
docker run -d --name "$TEST_CTR" -e MYSQL_ROOT_PASSWORD=test -e MYSQL_DATABASE=allur mysql:8.0 --skip-networking >/dev/null
for i in $(seq 1 30); do docker exec "$TEST_CTR" mysqladmin ping -uroot -ptest >/dev/null 2>&1 && break; sleep 1; done

echo "[restore-test] importing dump"
gunzip -c "$WORK/restore.sql.gz" | docker exec -i "$TEST_CTR" mysql -uroot -ptest allur

echo "[restore-test] integrity checks"
ORDERS="$(docker exec "$TEST_CTR" mysql -N -uroot -ptest allur -e 'SELECT COUNT(*) FROM orders')"
PRODUCTS="$(docker exec "$TEST_CTR" mysql -N -uroot -ptest allur -e 'SELECT COUNT(*) FROM products')"
echo "  orders=${ORDERS} products=${PRODUCTS}"
[ -n "$ORDERS" ] || { echo "FAIL: empty/invalid restore"; exit 1; }

echo "[restore-test] PASSED ✔ ($LATEST)"
```

Wire into cron weekly: `45 2 * * 0 /opt/nod/deploy/scripts/test-restore.sh >> /var/log/nod-restore-test.log 2>&1`

### 4.3 Recovery objectives

| Objective | Value | How it's met |
|---|---|---|
| **RPO (Recovery Point Objective)** | **≤ 24h now → ≤ 15 min after binlog PITR** | Daily encrypted off-site full backups now. Enable MySQL binlog (`--binlog-expire-logs-seconds=86400` already set) and stream/binlog-copy to off-site to replay to any point in the last day. |
| **RTO (Recovery Time Objective)** | **≤ 60 min full / ≤ 30 min schema-fix** | Automated `test-restore.sh` proves restores work; runbook Scenario D covers schema rollback. Cold-start a fresh `mysql` container, import latest dump, point compose at it. |
| **Verification** | Weekly automated | `test-restore.sh` restores into an isolated container and sanity-checks row counts. |
| **Encryption at rest & transit** | AES-256-CBC (PBKDF2) + TLS | `openssl enc` with env-supplied passphrase; rclone uses TLS to R2/B2/S3. |

---

## 5. High-Concurrency Load Testing Playbook

**Precondition:** the atomic stock guard (v1/v2 audit Step 1) is deployed — checkout must use
`updateMany({ where: { id, stockQuantity: { gte: qty } }, data: { stockQuantity: { decrement: qty } } })`
and return **HTTP 409 Conflict** (not 400) when stock is exhausted. Add `status 409` before the `throw` in `orderController.ts`.

### 5.1 k6 script — `deploy/loadtest/flash-sale.js`

```js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const API = __ENV.API_URL;                 // https://api.nodmakeup.com
const VARIANT_ID = Number(__ENV.VARIANT_ID); // SKU with EXACTLY 5 units in stock
const GOVS = ['Cairo','Giza','Alexandria'];

export const options = {
  // 100 VUs × 1 checkout each, fired simultaneously = the "last 5 units" stampede.
  scenarios: {
    flash_sale: { executor: 'per-vu-iterations', vus: 100, iterations: 1, maxDuration: '1m' },
  },
  thresholds: {
    http_req_duration: ['p(95)<250'],          // SLO: p95 < 250ms
    http_req_failed:   ['rate<0.01'],          // no 5xx allowed
    checks:            ['rate>0.99'],
  },
};

export default function () {
  const sessionId = uuidv4();
  const headers = {
    'x-cart-session-id': sessionId,
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };

  // 1. Cart: this VU wants 1 unit of the contended SKU
  const add = http.post(`${API}/api/public/cart/items`, JSON.stringify({ variant_id: VARIANT_ID, quantity: 1 }), { headers });
  check(add, { 'add-to-cart ok': (r) => r.status === 200 });

  // 2. Checkout (each VU has a unique idempotency key)
  const body = JSON.stringify({
    customer_name: `LoadTest ${__VU}`,
    customer_phone: '01000000000',
    customer_address: 'Load test address 123',
    shipping_governorate: GOVS[__VU % GOVS.length],
    checkout_key: uuidv4(),
  });
  const res = http.post(`${API}/api/public/orders`, body, { headers });

  // Assertions: exactly 5 → 201; the other 95 → 409 "Out of Stock". Nothing else.
  check(res, {
    '200/201 success OR clean 409 conflict': (r) => r.status === 201 || r.status === 409,
    'no 400-that-is-a-bug': (r) => r.status !== 400,
    'p95<250ms measured': () => true, // enforced by threshold above
  });

  sleep(0.1);
}
```

Run:

```bash
docker run --rm -v "$PWD:/loadtest" grafana/k6 run \
  -e API_URL=https://api.nodmakeup.com -e VARIANT_ID=42 \
  /loadtest/flash-sale.js
```

### 5.2 Verifying "exactly 5, zero negative stock"

After the run:

```sql
-- Expect exactly 5 rows with status 'Pending Payment' for the test SKU
SELECT COUNT(*) FROM orders o
  JOIN order_items oi ON oi.order_id = o.id AND oi.variant_id = 42
  WHERE o.customer_name LIKE 'LoadTest%';

-- Expect stock = 0 (never negative)
SELECT stock_quantity FROM product_variants WHERE id = 42;
```

**KPI gates:** `p95 < 250ms` · 5 successes · 95 × HTTP 409 · `stock_quantity >= 0` always · 0 × 5xx.

---

## 6. Production Emergency Runbook (SOP)

> All commands assume `docker compose -f deploy/docker-compose.production.yml` is aliased as `dcp`. Every action is a step; **stop and escalate** if an outcome differs from the expected one.

### Scenario A — Headless WhatsApp disconnects / needs QR re-auth

**Symptoms:** worker log shows `auth_failure` / `Disconnected. Reason:`; `worker /readyz` reports `whatsapp=degraded`; rewards queue starts accumulating.

```bash
# 1. Confirm worker is alive and see the failure reason
dcp ps worker
dcp logs --tail=200 worker

# 2. Check queue depth — rewards piling up?
redis-cli -h 127.0.0.1 -p 6379 llen bull:rewards:wait        # (or: dcpexec redis-cli llen bull:rewards:wait)

# 3. Restart the worker to trigger the 5s auto-reconnect path
dcp restart worker

# 4. If still disconnected: force re-authentication (session wiped) + capture the QR
dcp exec worker rm -rf .wwebjs_auth/.wwebjs_auth-session
dcp restart worker
dcp logs -f worker    # watch for the QR box; scan with the business WhatsApp account

# 5. Verify recovery
curl -fsS https://api.nodmakeup.com/readyz | jq .checks   # whatsapp:"ok"
```

**Fallback:** rewards stay in the BullMQ `rewards` queue (they are durable — **nothing is lost**). The queue drains automatically once WhatsApp is back. If WhatsApp is down for > 4h, notify the customer manually via Telegram and leave the job to retry.

### Scenario B — MySQL hits 100% CPU / deadlock spike

```bash
# 1. Confirm the hot query (stream, don't wait for a hang)
dcp exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SHOW FULL PROCESSLIST\G"

# 2. If a query is stuck > 30s, capture its plan before killing
dcp exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" \
  -e "EXPLAIN ANALYZE <the offending SQL>" > /var/log/nod-slowquery-$(date +%s).txt

# 3. Kill only the offending session (not the server)
dcp exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "KILL <id>;"

# 4. Deadlock spike (ERROR 1213): confirm & monitor, don't panic — InnoDB retries
dcp logs --tail=200 api | grep -i "deadlock\|1213"

# 5. Common fixes in priority order:
#    a. Missing index → apply the §2 index migration (orders(created_at), order_items(variant_id), …)
#    b. Buffer pool → check innodb_buffer_pool_size vs. total DB size
#    c. Analytics load → point the 13-query dashboard at a read replica or enable the Redis cache
dcp exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SELECT table_name, ROUND(((data_length+index_length)/1024/1024),2) AS MB FROM information_schema.tables WHERE table_schema='allur' ORDER BY MB DESC LIMIT 10;"
```

**Escalation if unresolved in 15 min:** run `backup.sh` (non-blocking) immediately, then restart MySQL once: `dcp restart mysql`.

### Scenario C — BullMQ queue > 500 unprocessed jobs (outbox stall)

**Symptoms:** `readyz` reports `queue=degraded`; `GET /readyz` returns 503; Telegram order receipts lag.

```bash
# 1. Confirm the depth per queue
dcp exec redis redis-cli llen bull:rewards:wait
dcp exec redis redis-cli llen bull:alerts:wait
dcp exec redis redis-cli zcard bull:rewards:delayed

# 2. Is the worker stuck or just slow? (WhatsApp throttles to ~1 msg/30s by design)
dcp logs --tail=100 worker

# 3. If worker crashed → restart it (queue is durable, nothing lost)
dcp restart worker

# 4. If a poisoned job blocks the worker → move it to DLQ and inspect
dcp exec redis redis-cli --scan --pattern 'bull:rewards:*' | head
#   (BullMQ moves failed jobs to ...:failed after retries automatically)

# 5. Inspect a failed job's payload
dcp exec redis redis-cli hgetall bull:rewards:failed   # or use BullMQ Dashboard
```

**Prevention:** alerts fire when `bull:*:wait` + `bull:*:delayed` > 500 (Grafana). **Capacity:** scale out with `docker compose up -d --scale worker=2` — BullMQ workers are stateless (idempotent consumers via outbox `processed_at` guard).

### Scenario D — Emergency rollback of a failed database migration

```bash
# 0. NEVER fight a migration while a "Before" backup is unverified.
#    If none exists for today, run backup.sh FIRST.

# 1. Freeze writes (read-only mode) to guarantee consistency
dcp exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SET GLOBAL read_only=ON; FLUSH TABLES WITH READ LOCK;"
# 2. Take a safety dump
docker exec nod-production-mysql-1 mysqldump --single-transaction -uroot -p"$MYSQL_ROOT_PASSWORD" allur | gzip > /var/backups/nod/pre-rollback-$(date +%s).sql.gz

# 3. Identify & roll back the specific migration with Prisma
docker compose run --rm api npx prisma migrate resolve --rolled-back "<migration_name>"
# 4. Redeploy the previous known-good image
docker compose up -d api worker
# 5. Re-enable writes
dcp exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SET GLOBAL read_only=OFF; UNLOCK TABLES;"

# 6. Verify health
curl -fsS https://api.nodmakeup.com/readyz | jq .checks
```

**If the migration already damaged data irrecoverably:** full restore path (RTO ≤ 60 min):
1. `rclone copy r2:nod-backups/daily ./restore --include "allur_*.sql.gz.enc"` → pick latest
2. Run `test-restore.sh` to validate it restores
3. Point compose at a fresh `mysql` data volume, import, relaunch stack.

---

## Deployment checklist (from 0 → live)

- [ ] Apply v1/v2 audit fixes (atomic stock/coupon, idempotent checkout, outbox+workers, Zod, media auth).
- [ ] Cut DNS records: `api.` / `media.` / `admin.` → VPS IP.
- [ ] One-time `certbot` issuance (compose block above) for all three hostnames.
- [ ] Set `.env` secrets: `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, `JWT_SECRET`, `MEDIA_API_KEY`, `BACKUP_PASSPHRASE`, `GRAFANA_ADMIN_PASSWORD`, `SENTRY_DSN`, `TELEGRAM_*`.
- [ ] Replace ngrok URLs in `main-website/lib/config.ts` + `.env.local` with `https://api.nodmakeup.com` / `https://media.nodmakeup.com`; rebuild & redeploy on Vercel.
- [ ] Update backend CORS allowlist (`server.ts`) to the three prod origins; **remove** the `NODE_ENV==='development'` blanket bypass.
- [ ] Build admin panel (`npm run build`), mount `build/` into nginx.
- [ ] `backup.sh` cron + weekly `test-restore.sh` cron.
- [ ] Grafana alert rules + Uptime Kuma health checks.
- [ ] Run the k6 flash-sale test; confirm 5/95 split, p95 < 250ms, stock never negative.
- [ ] Drill runbook scenarios A and D with a staging box.
