#!/usr/bin/env bash
set -euo pipefail

BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:?export me}"
RCLONE_REMOTE="${RCLONE_REMOTE:-r2:nod-backups}"
DB_NAME="nod_makeup"
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
docker run -d --name "$TEST_CTR" -e MYSQL_ROOT_PASSWORD=test -e MYSQL_DATABASE="$DB_NAME" mysql:8.0 --skip-networking >/dev/null
for i in $(seq 1 30); do docker exec "$TEST_CTR" mysqladmin ping -uroot -ptest >/dev/null 2>&1 && break; sleep 1; done

echo "[restore-test] importing dump"
gunzip -c "$WORK/restore.sql.gz" | docker exec -i "$TEST_CTR" mysql -uroot -ptest "$DB_NAME"

echo "[restore-test] integrity checks"
ORDERS="$(docker exec "$TEST_CTR" mysql -N -uroot -ptest "$DB_NAME" -e 'SELECT COUNT(*) FROM orders')"
PRODUCTS="$(docker exec "$TEST_CTR" mysql -N -uroot -ptest "$DB_NAME" -e 'SELECT COUNT(*) FROM products')"
echo "  orders=${ORDERS} products=${PRODUCTS}"
[ -n "$ORDERS" ] || { echo "FAIL: empty/invalid restore"; exit 1; }

echo "[restore-test] PASSED ✔ ($LATEST)"