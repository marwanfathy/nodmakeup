# NOD Makeup — Media Server (media-server/)

Standalone Express media service: receives uploads from the admin panel,
processes them (resize / format via `sharp`, video/audio via `fluent-ffmpeg`),
persists to `public/`, and serves the resulting files. It is **not** part of the
backend API — the backend never proxies media bytes; it stores/returns media
URLs that point here.

Serves on the `PORT=$MEDIA_PORT` port from the repo-root `.env` (default `:5002`).

## Run

```bash
npm install
npm run dev      # nodemon watch, http://localhost:5002
```

Or boot the whole stack with `./start.sh` at the repo root. Health checks:
`GET /healthz`, `GET /`.

## Structure

- `src/server.js` — entry; `src/app.js` — Express app (helmet, cors, compression, morgan)
- `src/config/` — env parsing with sane defaults
- `src/middleware/` — `auth` (shared token handshake with backend), `uploader` (multer + size/type guards), `sanitize` (filename/param hygiene)
- `src/routes/` — `health.routes.js`, `media.routes.js`, `upload.routes.js`
- `src/services/` — `storage.js` (disk layout), `processor.js` (sharp/ffmpeg pipeline), `cleanup.js` (stale-file sweep)
- `src/utils/` — mime mapping

## Tests

Currently no automated test-suite (covered by the route smoke sweep in
`scripts/smoke-routes.sh`, which asserts `/`, `/healthz` return 200). The plan
tracks adding media unit tests for `processor`/`sanitize` in P5 — deferred
while the storefront rebuild is in flight.