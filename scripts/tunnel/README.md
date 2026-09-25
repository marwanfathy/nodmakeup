# Cloudflare Tunnel — backend + media

Exposes the local API gateway (`:5001`) and media server (`:5002`) to the
public internet through **outbound-only Cloudflare connectors**, so the Vercel
deployed storefront can reach them over HTTPS — no open firewall ports, no
public IP needed (this box is behind NAT on `192.168.1.18`).

> **This repo's control center manages the connectors** (Control Center →
> Overview → "Cloudflare Tunnel · API" / "Cloudflare Tunnel · Media" cards).
> See `control-center/lib/config.ts` for the two service definitions.

## Current setup: dashboard-created connectors (Zero Trust)

Each public hostname is its own tunnel, created in the Cloudflare Zero Trust
dashboard (`Networks → Tunnels → Create a tunnel → cloudflared`). The "install
and run" token is stored **on this server only**:

| Connector  | Token file (chmod 600, never committed) | Metrics port (probe) | Hostname |
| ---------- | --------------------------------------- | -------------------- | -------- |
| api        | `~/.cloudflared/tunnel-api.token`       | `127.0.0.1:38512/healthcheck` | `api.nodmakeup.com`   |
| media      | `~/.cloudflared/tunnel-media.token`     | `127.0.0.1:38513/healthcheck` | `media.nodmakeup.com` |

Command each card runs (metrics is a *global* flag in cloudflared ≥ 2025.11):

```bash
cloudflared --metrics 127.0.0.1:38512 tunnel run --token "$(cat ~/.cloudflared/tunnel-api.token)"
cloudflared --metrics 127.0.0.1:38513 tunnel run --token "$(cat ~/.cloudflared/tunnel-media.token)"
```

### Dashboard public-hostname mapping (do once per tunnel)

In each tunnel's **Public Hostname** tab, add:

| Tunnel | Hostname           | Service | URL        |
| ------ | ------------------ | ------- | ---------- |
| api    | `api.nodmakeup.com`   | HTTP | `localhost:5001` |
| media  | `media.nodmakeup.com` | HTTP | `localhost:5002` |

DNS records are created automatically when the hostname is on a Cloudflare
zone. Err on the side of `localhost` (cloudflared runs on the same box as
backend/media).

## Alternative: local named tunnel (setup.sh)

`setup.sh` documents the fully-local alternative (`cloudflared tunnel login` +
local ingress config). Not needed for the dashboard flow above.

## Architecture

```
browser ─► https://nodmakeup.vercel.app   (storefront, Vercel)
                 │
                 │ NEXT_PUBLIC_GATEWAY_URL    = https://api.nodmakeup.com
                 │ NEXT_PUBLIC_MEDIA_BASE_URL = https://media.nodmakeup.com
                 ▼
        Cloudflare edge
                 ▲  two outbound connectors (cloudflared on this box)
                 │
   ┌─────────────┴─────────────┐
   │ api.nodmakeup.com         │ media.nodmakeup.com
   │   /api/*         -> :5001 │   /uploads/*    -> :5002
   │   /* (health)    -> :5001 │   /thumbnails/* -> :5002
   └───────────────────────────┘
```

Two hostnames on one tunnel: media can later move to R2 / a CDN without
touching the API, and Cloudflare cache rules can aggressively cache the media
host (the media server already sends long-lived cache headers) while the API
host stays uncached.

## Prerequisites

- `cloudflared` installed (`/usr/local/bin/cloudflared`, v2025.11.1 ✓)
- A domain in your Cloudflare account (this setup assumes `nodmakeup.com`;
  the tunnel cannot use `nodmakeup.vercel.app` — that's Vercel's domain)

## Setup

```bash
cd /home/mx/makeup/nodmakeup/v5/scripts/tunnel
./setup.sh                 # interactive login, then create/route/write/validate/run
./setup.sh --systemd      # same, then install a systemd service (auto-start)
```

### What setup.sh does (idempotent — safe to re-run)

| Step | Action |
| ---- | ------ |
| 1    | `cloudflared tunnel login` — browser OAuth, creates `~/.cloudflared/cert.pem` (skipped if present) |
| 2    | `cloudflared tunnel create nodmakeup-backend` — credentials JSON in `~/.cloudflared/` (kept out of git) |
| 3    | `cloudflared tunnel route dns …` — CNAMEs `api`/`media.nodmakeup.com` → `<uuid>.cfargotunnel.com` |
| 4    | writes `~/.cloudflared/config.yml` ingress table |
| 5    | `cloudflared tunnel ingress validate` |
| 6    | run foreground, or `--systemd` service install |

## Verify from the public internet

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  https://api.nodmakeup.com/api/v1/orders/shipping-zones \
  -H 'Origin: https://nodmakeup.vercel.app'          # expect 200 + ACAO header
curl -s -o /dev/null -w '%{http_code}\n' \
  https://media.nodmakeup.com/thumbnails/thumb-story-1762642070224.png  # expect 200, image/png
```

## Then configure Vercel

Project dashboard → Settings → Environment Variables (Production):

| Var | Value |
| --- | ----- |
| `NEXT_PUBLIC_GATEWAY_URL` | `https://api.nodmakeup.com` |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | `https://media.nodmakeup.com` |

Redeploy. (NEXT_PUBLIC_* is baked at build time — redeploy after changing.)

## Security notes

- **Rate limiter is ON** — the backend gateway guard (1000 req / 15 min / IP)
  was re-enabled in `backend/server.ts` before going public.
- **CORS** — `SAFE_ORIGINS` in root `.env` already includes
  `https://nodmakeup.vercel.app` + both tunnel hostnames (verified: the API
  now echoes `Access-Control-Allow-Origin` for the Vercel origin).
- Recommended (optional): add Cloudflare **cache rules** for
  `media.nodmakeup.com` (cache everything — files are immutable, hashed names)
  and `api.nodmakeup.com` (standard — never cache API responses).
- The tunnel credentials JSON (`~/.cloudflared/<uuid>.json`) and `cert.pem`
  are **server-local secrets** — never commit them. This directory's
  `.gitignore` keeps them out of the monorepo.

## Troubleshooting

- `cloudflared tunnel list` → "Cannot determine default origin certificate
  path": run `cloudflared tunnel login` first.
- HTTPS works automatically (terminated at Cloudflare edge); origins run plain
  HTTP on loopback — no origin TLS config needed.
- `sudo cloudflared service install` — the unit runs as the current user and
  reads the same `~/.cloudflared/config.yml`.