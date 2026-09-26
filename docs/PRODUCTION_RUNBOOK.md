# NOD Makeup — Production Emergency Runbook (SOP)

> All commands assume `docker compose -f /opt/nod/deploy/docker-compose.production.yml` is aliased as `dcp`. Every action is a step; **stop and escalate** if an outcome differs from the expected one.

## Quick Reference

| Command | Description |
|---------|-------------|
| `dcp ps` | Show service status |
| `dcp logs -f <service>` | Follow logs |
| `dcp restart <service>` | Restart a service |
| `dcp exec <service> <cmd>` | Run command in container |
| `curl -fsS https://api.nodmakeup.com/readyz \| jq .checks` | Health check |

---

## Scenario A — Headless WhatsApp Disconnects / Needs QR Re-auth

**Symptoms:** Worker log shows `auth_failure` / `Disconnected. Reason:`; `worker /readyz` reports `whatsapp=degraded`; rewards queue starts accumulating.

```bash
# 1. Confirm worker is alive and see the failure reason
dcp ps worker
dcp logs --tail=200 worker

# 2. Check queue depth — rewards piling up?
redis-cli -h 127.0.0.1 -p 6379 llen bull:rewards:wait

# 3. Restart the worker to trigger the 5s auto-reconnect path
dcp restart worker

# 4. If still disconnected: force re-authentication (session wiped) + capture the QR
dcp exec worker rm -rf .wwebjs_auth/.wwebjs_auth-session
dcp restart worker
dcp logs -f worker    # watch for the QR box; scan with the business WhatsApp account

# 5. Verify recovery
curl -fsS https://api.nodmakeup.com/readyz | jq .checks   # whatsapp:"ok"
```

**Fallback:** Rewards stay in the BullMQ `rewards` queue (they are durable — **nothing is lost**). The queue drains automatically once WhatsApp is back. If WhatsApp is down for > 4h, notify the customer manually via Telegram and leave the job to retry.

---

## Scenario B — MySQL Hits 100% CPU / Deadlock Spike

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
#    a. Missing index → apply the index migration (orders(created_at), order_items(variant_id), …)
#    b. Buffer pool → check innodb_buffer_pool_size vs. total DB size
#    c. Analytics load → point the 13-query dashboard at a read replica or enable the Redis cache
dcp exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SELECT table_name, ROUND(((data_length+index_length)/1024/1024),2) AS MB FROM information_schema.tables WHERE table_schema='nod_makeup' ORDER BY MB DESC LIMIT 10;"
```

**Escalation if unresolved in 15 min:** Run `backup.sh` (non-blocking) immediately, then restart MySQL once: `dcp restart mysql`.

---

## Scenario C — BullMQ Queue > 500 Unprocessed Jobs (Outbox Stall)

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

**Prevention:** Alerts fire when `bull:*:wait` + `bull:*:delayed` > 500 (Grafana). **Capacity:** Scale out with `docker compose up -d --scale worker=2` — BullMQ workers are stateless (idempotent consumers via outbox `processed_at` guard).

---

## Scenario D — Emergency Rollback of a Failed Database Migration

```bash
# 0. NEVER fight a migration while a "Before" backup is unverified.
#    If none exists for today, run backup.sh FIRST.

# 1. Freeze writes (read-only mode) to guarantee consistency
dcp exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SET GLOBAL read_only=ON; FLUSH TABLES WITH READ LOCK;"

# 2. Take a safety dump
docker exec nod-production-mysql-1 mysqldump --single-transaction -uroot -p"$MYSQL_ROOT_PASSWORD" nod_makeup | gzip > /var/backups/nod/pre-rollback-$(date +%s).sql.gz

# 3. Identify & roll back the specific migration with Prisma
docker compose run --rm api npx prisma migrate resolve --rolled-back "<migration_name>"

# 4. Redeploy the previous known-good image
docker compose up -d api worker

# 5. Re-enable writes
dcp exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SET GLOBAL read_only=OFF; UNLOCK TABLES;"

# 6. Verify health
curl -fsS https://api.nodmakeup.com/readyz | jq .checks
```

**If the migration already damaged data irrecoverably:** Full restore path (RTO ≤ 60 min):
1. `rclone copy r2:nod-backups/daily ./restore --include "nod_makeup_*.sql.gz.enc"` → pick latest
2. Run `test-restore.sh` to validate it restores
3. Point compose at a fresh `mysql` data volume, import, relaunch stack.

---

## Scenario E — Media Server Uploads Failing / Disk Full

```bash
# 1. Check disk space
df -h /opt/nod/media-server/public  # or the mounted volume

# 2. Check media server logs
dcp logs --tail=100 media

# 3. If disk full: clean temp files
dcp exec media find /app/public/temp -type f -mtime +1 -delete
dcp exec media find /app/temp -type f -mtime +1 -delete

# 4. If persistent: expand volume or add new volume
```

---

## Scenario F — API Returning 5xx / High Latency

```bash
# 1. Check API health
curl -fsS https://api.nodmakeup.com/readyz | jq .checks

# 2. Check recent logs
dcp logs --tail=200 api | grep -E "ERROR|FATAL|500|502|503"

# 3. Check queue depth
curl -fsS https://api.nodmakeup.com/readyz | jq .checks.bullmq

# 4. Restart API if needed (drains connections gracefully)
dcp restart api

# 5. If persistent: check for memory leaks, increase mem_limit, or scale horizontally
```

---

## Scenario G — TLS Certificate Expiry / Certbot Failure

```bash
# 1. Check certificate expiry
openssl x509 -enddate -noout -in /etc/letsencrypt/live/api.nodmakeup.com/fullchain.pem

# 2. Check certbot logs
dcp logs certbot

# 3. Force renewal
dcp exec certbot certbot renew --webroot -w /var/www/certbot --force-renewal
dcp exec nginx nginx -s reload

# 4. If DNS challenge failing: verify DNS records point to server IP
dig +short api.nodmakeup.com
```

---

## Scenario H — Redis Memory / Connection Issues

```bash
# 1. Check Redis info
dcp exec redis redis-cli INFO memory
dcp exec redis redis-cli INFO clients

# 2. If memory high: check maxmemory policy
dcp exec redis redis-cli CONFIG GET maxmemory-policy

# 3. If connections high: check client list
dcp exec redis redis-cli CLIENT LIST

# 4. Flush only if absolutely necessary (LOGS DATA LOSS!)
# dcp exec redis redis-cli FLUSHALL
```

---

## Scenario G — Investigating an Outage / Restarting Services (Control Center)

**Symptom:** storefront/admin unreachable, backend 5xx, or "why is it slow".
The Control Center (`http://127.0.0.1:4000`, binds localhost only) is the
fastest way to see everything at once and take action without touching a shell.

```bash
# 1. Reach it (if not running, boot it — it manages all four services)
node /srv/nod-makeup/control-center/src/server.js   # or: ./start.sh

# 2. First-run setup (once): open the URL, create the operator account.
#    Sessions are signed cookies (HMAC, .runtime/secret); mutations need the
#    per-session CSRF token the UI sends automatically.

# 3. What the Overview tab gives you in one screen:
#      - live health probe + latency per service (backend/media/web/admin)
#      - req/s, p95, 5xx of the backend + sys cpu/mem/disk (psutil sidecar)
#      - Prometheus/Grafana bridge state (standalone probes remain active if down)
#      - Start / Stop / Restart buttons per service

# 4. Follow the failure: Logs tab (SSE tail of logs/<service>.log) →
#    Tracing tab (backend pino-http spans + media ReqId spans, joined by id
#    when the client propagates x-request-id) → Config tab (masked .env edit)
#    → Flags tab (runtime feature toggles, .runtime/flags.json).

# 5. Service recovery via the API (same as the buttons):
curl -s http://127.0.0.1:4000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"OPERATOR","password":"***"}' -c /tmp/cc.cookies
curl -s -b /tmp/cc.cookies http://127.0.0.1:4000/api/dashboard/overview \
  | jq '.services[] | {name, running, up, latencyMs}'
curl -s -b /tmp/cc.cookies -X POST http://127.0.0.1:4000/api/control/backend/restart \
  -H "X-CSRF-Token: $(curl -s -b /tmp/cc.cookies http://127.0.0.1:4000/api/auth/me | jq -r .csrfToken)"

# 6. Stop/start semantics: SIGTERM → SIGKILL after the grace window, then a
#    /proc sweep kills stragglers (media's cluster workers own the listen
#    socket and its primary respawns them). Logs append directly to
#    logs/<service>.log, so capture survives control-center restarts.

# 7. Everything the operator does lands in .runtime/audit.jsonl (Audit tab).
```

> **Security note:** the Control Center can stop/restart services and edit the
> root `.env` (secrets masked unless `?reveal=1`). Never expose :4000 beyond
> the host.

---

## Recovery Objectives Reference

| Objective | Value | How It's Met |
|-----------|-------|--------------|
| **RPO** | ≤ 15 min (binlog PITR) / ≤ 24h (daily backup) | Daily encrypted off-site full backups + binlog streaming |
| **RTO** | ≤ 60 min full / ≤ 30 min schema-fix | Automated test-restore.sh proves restores work |
| **Verification** | Weekly automated | test-restore.sh restores into isolated container |
| **Encryption** | AES-256-CBC (PBKDF2) + TLS | openssl enc + rclone TLS to R2/B2/S3 |

---

## Key Contacts & Escalation

| Role | Contact | When to Escalate |
|------|---------|------------------|
| Platform Lead | Telegram: @nod_admin | Any Scenario A-D unresolved > 15 min |
| DBA | Internal | Scenario B unresolved > 10 min |
| Security | Internal | Any suspected breach |

---

## Post-Incident Process

1. **Document** timeline in `/var/log/nod/incident-$(date +%F).md`
2. **Root cause analysis** within 48h
3. **Action items** assigned with deadlines
4. **Runbook update** if new scenario discovered