#!/usr/bin/env bash
# NOD Makeup — Cloudflare Tunnel Setup
# Run ONCE on the production server to create the tunnel and credentials.
# Requires: cloudflared installed, CLOUDFLARE_API_TOKEN set.

set -euo pipefail

TUNNEL_NAME="nod-production"
CONFIG_DIR="/opt/nod/deploy/cloudflare"
CREDENTIALS_FILE="$CONFIG_DIR/credentials.json"
CONFIG_FILE="$CONFIG_DIR/config.yml"

echo "[cloudflare-setup] Checking cloudflared installation..."
if ! command -v cloudflared &> /dev/null; then
    echo "Installing cloudflared..."
    curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
    dpkg -i /tmp/cloudflared.deb
fi

echo "[cloudflare-setup] Checking API token..."
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
    echo "ERROR: CLOUDFLARE_API_TOKEN not set. Export it first."
    exit 1
fi

echo "[cloudflare-setup] Creating tunnel '$TUNNEL_NAME'..."
TUNNEL_OUTPUT=$(cloudflared tunnel create "$TUNNEL_NAME" 2>&1 || true)
if echo "$TUNNEL_OUTPUT" | grep -q "already exists"; then
    echo "Tunnel already exists, getting ID..."
    TUNNEL_ID=$(cloudflared tunnel list --output json | jq -r ".[] | select(.name==\"$TUNNEL_NAME\") | .id")
else
    TUNNEL_ID=$(echo "$TUNNEL_OUTPUT" | grep -oE '[a-f0-9-]{36}' | head -1)
fi

if [ -z "$TUNNEL_ID" ]; then
    echo "ERROR: Could not determine tunnel ID"
    exit 1
fi

echo "[cloudflare-setup] Tunnel ID: $TUNNEL_ID"

echo "[cloudflare-setup] Fetching credentials..."
cloudflared tunnel credentials "$TUNNEL_ID" > "$CREDENTIALS_FILE"
chmod 600 "$CREDENTIALS_FILE"

echo "[cloudflare-setup] Configuring DNS records..."
for HOSTNAME in "api.nodmakeup.com" "media.nodmakeup.com" "admin.nodmakeup.com"; do
    echo "  Routing $HOSTNAME -> $TUNNEL_NAME"
    cloudflared tunnel route dns "$TUNNEL_NAME" "$HOSTNAME"
done

echo "[cloudflare-setup] Installing systemd service..."
mkdir -p /var/log/cloudflared
cp "$CONFIG_DIR/cloudflared.service" /etc/systemd/system/cloudflared-nod-production.service
systemctl daemon-reload
systemctl enable cloudflared-nod-production.service

echo "[cloudflare-setup] Setup complete!"
echo "  Tunnel: $TUNNEL_NAME ($TUNNEL_ID)"
echo "  Credentials: $CREDENTIALS_FILE"
echo "  Config: $CONFIG_FILE"
echo ""
echo "To start the tunnel now:"
echo "  systemctl start cloudflared-nod-production.service"
echo ""
echo "To check status:"
echo "  systemctl status cloudflared-nod-production.service"
echo "  journalctl -u cloudflared-nod-production.service -f"