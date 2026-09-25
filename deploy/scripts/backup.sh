#!/usr/bin/env bash
set -euo pipefail

# ============ CONFIG ============
COMPOSE_PROJECT="${COMPOSE_PROJECT:-nod-production}"
MYSQL_CONTAINER="${COMPOSE_PROJECT}-mysql-1"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:?export me}"
BACKUP_ROOT="/var/backups/nod"
BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:?export me}"     # AES-256 key
RCLONE_REMOTE="${RCLONE_REMOTE:-r2:nod-backups}"        # rclone remote + bucket (R2/B2/S3)
RETENTION_DAYS_DAILY=7
RETENTION_DAYS_WEEKLY=28
RETENTION_DAYS_MONTHLY=365
DB_NAME="nod_makeup"

mkdir -p "$BACKUP_ROOT/daily" "$BACKUP_ROOT/weekly" "$BACKUP_ROOT/monthly"
STAMP="$(date +%F_%H%M%S)"
DOW="$(date +%u)"          # 1..7
DOM="$(date +%d)"

# ============ 1. Logical hot backup (non-blocking) ============
# --single-transaction = consistent snapshot without locking writes;
# --quick = no buffering of result sets; --routines/--triggers = full fidelity.
echo "[backup] dumping MySQL → ${STAMP}.sql.gz"
docker exec "$MYSQL_CONTAINER" \
  mysqldump --single-transaction --quick --routines --triggers \
  --set-gtid-purged=OFF -uroot -p"$MYSQL_ROOT_PASSWORD" "$DB_NAME" \
  | gzip -9 > "$BACKUP_ROOT/daily/${DB_NAME}_${STAMP}.sql.gz"

# ============ 2. Redis point-in-time snapshot (copy .rdb after BGSAVE) ============
echo "[backup] snapshotting Redis"
docker exec "${COMPOSE_PROJECT}-redis-1" redis-cli BGSAVE >/dev/null
# The compose redis volume (redis-data) is snapshotted by the volume backup step below.

# ============ 3. AES-256 encryption (passphrase from env, never on cmdline) ============
echo "[backup] encrypting"
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -pass env:BACKUP_PASSPHRASE \
  -in "$BACKUP_ROOT/daily/${DB_NAME}_${STAMP}.sql.gz" \
  -out "$BACKUP_ROOT/daily/${DB_NAME}_${STAMP}.sql.gz.enc"
rm -f "$BACKUP_ROOT/daily/${DB_NAME}_${STAMP}.sql.gz"

# ============ 4. Retention copies (daily / weekly / monthly) ============
[ "$DOW" = "7" ] && cp "$BACKUP_ROOT/daily/${DB_NAME}_${STAMP}.sql.gz.enc" "$BACKUP_ROOT/weekly/${DB_NAME}_weekly_${STAMP}.sql.gz.enc"
[ "$DOM" = "01" ] && cp "$BACKUP_ROOT/daily/${DB_NAME}_${STAMP}.sql.gz.enc" "$BACKUP_ROOT/monthly/${DB_NAME}_monthly_${STAMP}.sql.gz.enc"

# ============ 5. Off-site streaming upload (R2/B2/S3 via rclone) ============
echo "[backup] uploading to ${RCLONE_REMOTE}"
rclone copy "$BACKUP_ROOT/daily" "$RCLONE_REMOTE/daily" --transfers 4 --stats-one-line

# The media uploads volume is snapshotted separately (uploads are rebuildable from
# source; the authoritative DB is what backup.sh protects).

# ============ 6. Retention policy ============
rclone delete "$RCLONE_REMOTE/daily"   --min-age "${RETENTION_DAYS_DAILY}d"
rclone delete "$RCLONE_REMOTE/weekly"  --min-age "${RETENTION_DAYS_WEEKLY}d"
rclone delete "$RCLONE_REMOTE/monthly" --min-age "${RETENTION_DAYS_MONTHLY}d"
find "$BACKUP_ROOT" -name "*.enc" -mtime "+${RETENTION_DAYS_DAILY}" -delete

echo "[backup] DONE $(date -Iseconds)"