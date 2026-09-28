#!/usr/bin/env bash
# Bring the production shipping zones in line with the coverage the storefront
# offers, without a migration.
#
# Why not a migration: this table is data, not schema, and the zones change for
# business reasons (a courier drops an area) far more often than the table does.
# A migration would also mean a new row in prisma/migrations for every price
# change, which is the wrong place to record a delivery decision.
#
# Safe by construction:
#   * orders are never touched — an order stores the governorate as text, not a
#     foreign key, so retiring a zone cannot rewrite or invalidate history;
#   * 'Default' is never deleted — it is the fallback orderService charges for a
#     governorate it does not recognise, and removing it turns a priced order
#     into a 400;
#   * a dry run is the default; pass --apply to actually write.
#
# Usage, on the production host:
#   cd /opt/nod && . deploy/.env && deploy/scripts/set-shipping-zones.sh
#   deploy/scripts/set-shipping-zones.sh --apply
set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT:-nod-production}"
MYSQL_CONTAINER="${COMPOSE_PROJECT}-mysql-1"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:?export me}"
DB_NAME="${DB_NAME:-nod_makeup}"

# Keep this list identical to `zones` in backend/prisma/seed-baseline.mjs. The
# seed is what a fresh environment gets; this is what an existing one gets.
ZONES=(
  "Cairo|50.00|1500.00"
  "Alexandria|70.00|1500.00"
  "Port Said|70.00|1500.00"
)

APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

# -N (no column names) and -B (batch, tab separated) so callers can read a
# single value straight out. "$@" carries the query or -e plus the SQL; without
# it every call would silently run an empty session and return nothing.
db() { docker exec -i "$MYSQL_CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$DB_NAME" -N -B "$@"; }

# ============ 1. Back up the table first ============
# A single wrong keystroke here silently retires a delivery area. The nightly
# backup exists, but it is a day old and restoring it would lose a day of orders,
# so this takes a table-scoped snapshot and refuses to continue without one.
BACKUP_FILE="/tmp/shipping_zones.$(date +%F_%H%M%S).sql"
echo "[zones] snapshotting shipping_zones → ${BACKUP_FILE}"
docker exec "$MYSQL_CONTAINER" mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" \
  "$DB_NAME" shipping_zones > "$BACKUP_FILE"
if [ ! -s "$BACKUP_FILE" ]; then
  echo "[zones] ABORT: backup is empty. Not touching the table." >&2
  exit 1
fi
# Restoring it: docker exec -i "$MYSQL_CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$DB_NAME" < "$BACKUP_FILE"
echo "[zones] restore with: dcp exec -T mysql mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" \"$DB_NAME\" < $BACKUP_FILE"

# ============ 2. Build the statement ============
# Upsert rather than delete-and-reinsert, so a zone keeps its zone_id. Nothing
# currently points at it, but a stable id costs nothing and avoids surprising
# anyone comparing rows before and after.
SQL=""
for zone in "${ZONES[@]}"; do
  IFS='|' read -r name cost free_at <<< "$zone"
  SQL+="INSERT INTO shipping_zones (zone_id, governorate, shipping_cost, free_shipping_threshold)
        VALUES (UUID(), '${name}', ${cost}, ${free_at})
        ON DUPLICATE KEY UPDATE shipping_cost = VALUES(shipping_cost),
                                free_shipping_threshold = VALUES(free_shipping_threshold);"
done

# Retire everything else that is a real delivery area. 'Default' is spared.
# A failure here must stop the run: treating an unreadable table as "nothing to
# retire" would silently skip the deletions and then report success.
retire_list=$(db -e "SELECT GROUP_CONCAT(QUOTE(governorate) SEPARATOR ',')
                        FROM shipping_zones
                        WHERE governorate <> 'Default'
                          AND governorate NOT IN ('Cairo','Alexandria','Port Said');")

if [ -n "$retire_list" ] && [ "$retire_list" != "NULL" ]; then
  SQL+="DELETE FROM shipping_zones WHERE governorate IN (${retire_list});"
fi

# ============ 3. Show what will change ============
echo "[zones] currently offered:"
db -e "SELECT governorate, shipping_cost, free_shipping_threshold FROM shipping_zones ORDER BY governorate;" \
  | while IFS=$'\t' read -r g c f; do printf '    %-14s %8s  free at %s\n' "$g" "$c" "$f"; done

# GROUP_CONCAT returns the string NULL when it matches no rows, which is truthy
# to `[ -n ]` and would build `DELETE ... IN (NULL)` — a statement that matches
# nothing while looking like a real one.
if [ -n "$retire_list" ] && [ "$retire_list" != "NULL" ]; then
  echo "[zones] will retire: ${retire_list//\'/}"
else
  echo "[zones] nothing to retire."
fi

if [ "$APPLY" -eq 0 ]; then
  echo "[zones] DRY RUN. Re-run with --apply to write."
  exit 0
fi

# ============ 4. Apply ============
echo "[zones] applying"
# Passed as -e rather than piped on stdin. `docker exec -i` without a TTY does
# forward stdin, but a multi-statement string arriving that way is easy to lose
# silently to whatever else is reading the pipe, and this script must not be
# able to report success having written nothing.
db -e "$SQL"

# ============ 5. Verify ============
# The storefront reads this table through getPublicShippingZones, so a mismatch
# here is a mismatch on the live site. Read it back the same way.
echo "[zones] after:"
db -e "SELECT governorate, shipping_cost, free_shipping_threshold FROM shipping_zones ORDER BY governorate;" \
  | while IFS=$'\t' read -r g c f; do printf '    %-14s %8s  free at %s\n' "$g" "$c" "$f"; done

still_there=$(db -e "SELECT COUNT(*) FROM shipping_zones
                        WHERE governorate <> 'Default'
                          AND governorate NOT IN ('Cairo','Alexandria','Port Said');")
if [ "$still_there" != "0" ]; then
  echo "[zones] FAILED: ${still_there} unexpected zone(s) still present." >&2
  exit 1
fi

# The upserts are the other half of the job, and an INSERT that silently failed
# would leave a served zone missing from the live site. Compare against the
# table, not against what we meant to write.
served=$(db -e "SELECT COUNT(*) FROM shipping_zones
                   WHERE governorate IN ('Cairo','Alexandria','Port Said')
                     AND shipping_cost > 0
                     AND free_shipping_threshold IS NOT NULL;")
if [ "$served" != "${#ZONES[@]}" ]; then
  echo "[zones] FAILED: only ${served} of ${#ZONES[@]} served zone(s) present with a price." >&2
  exit 1
fi

echo "[zones] DONE $(date -Iseconds)"
echo "[zones] Remember: the storefront must be redeployed to pick up the governorate picker."
