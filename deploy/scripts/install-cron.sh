#!/usr/bin/env bash
# NOD Makeup — Install production cron jobs
# Run as root on the production server after docker compose is up.
# Requires deploy/.env to be populated with all secrets.

set -euo pipefail

CRON_FILE="/etc/cron.d/nod-production"
BACKUP_SCRIPT="/opt/nod/deploy/scripts/backup.sh"
RESTORE_TEST_SCRIPT="/opt/nod/deploy/scripts/test-restore.sh"
LOGS_DIR="/var/log/nod"

echo "[cron-install] Creating log directory..."
mkdir -p "$LOGS_DIR"

echo "[cron-install] Writing cron file to $CRON_FILE..."
cat > "$CRON_FILE" <<'EOF'
# NOD Makeup production cron jobs
# All jobs run in the nod-production compose project context
# Environment sourced from /opt/nod/deploy/.env

SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Daily backup at 01:30
30 1 * * * root cd /opt/nod && . deploy/.env && deploy/scripts/backup.sh >> /var/log/nod/nod-backup.log 2>&1

# Weekly restore test at 02:45 on Sundays
45 2 * * 0 root cd /opt/nod && . deploy/.env && deploy/scripts/test-restore.sh >> /var/log/nod/nod-restore-test.log 2>&1

# Certbot renewal check (compose handles this via certbot container entrypoint)
# No additional cron needed - certbot container runs renewal loop internally
EOF

echo "[cron-install] Cron file installed:"
cat "$CRON_FILE"

echo "[cron-install] Setting permissions..."
chmod 644 "$CRON_FILE"

echo "[cron-install] Verifying scripts are executable..."
chmod +x /opt/nod/deploy/scripts/backup.sh
chmod +x /opt/nod/deploy/scripts/test-restore.sh

echo "[cron-install] Testing backup script syntax..."
bash -n /opt/nod/deploy/scripts/backup.sh && echo "  backup.sh: OK"
bash -n /opt/nod/deploy/scripts/test-restore.sh && echo "  test-restore.sh: OK"

echo "[cron-install] Done. Cron will run at scheduled times."
echo "  - Backup: daily at 01:30"
echo "  - Restore test: weekly on Sunday at 02:45"
echo "  Logs: /var/log/nod/"