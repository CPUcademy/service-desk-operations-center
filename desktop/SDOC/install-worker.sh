#!/usr/bin/env bash
set -euo pipefail

SERVER_URL="${1:-}"
INSTALL_DIR=/opt/sdoc-worker
SERVICE=sdoc-worker
ENV_FILE=/etc/sdoc-worker.env
SRC="$(cd "$(dirname "$0")" && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "Run as root, e.g. with sudo."; exit 1; }
command -v systemctl >/dev/null || { echo "systemd is required."; exit 1; }
ldconfig -p 2>/dev/null | grep -qE 'libssl\.so\.(3|1\.1)' || {
    echo "OpenSSL is required. Install it first, e.g. 'apt install libssl3 ca-certificates' or 'dnf install openssl'."
    exit 1
}

MACHINE_ID=""
until [[ "$MACHINE_ID" =~ ^[1-9][0-9]*$ ]]; do
    read -r -p "Machine ID (the #number shown next to this machine on the Dashboard): " MACHINE_ID
done

KEY=""
until [ -n "$KEY" ]; do
    read -r -s -p "Worker API key: " KEY
    echo
done

read -r -p "Allow remote control (commands, files) on this machine? [y/N] " ALLOW
case "$ALLOW" in [yY]|[yY][eE][sS]) ALLOW=true ;; *) ALLOW=false ;; esac

if [ -z "$SERVER_URL" ]; then
    SERVER_URL="$(sed -n 's/.*"ServerUrl"[^"]*"\([^"]*\)".*/\1/p' "$SRC/appsettings.json")"
fi

systemctl stop "$SERVICE" 2>/dev/null || true

echo "Copying files to $INSTALL_DIR ..."
mkdir -p "$INSTALL_DIR"
if [ "$SRC" != "$INSTALL_DIR" ]; then cp -a "$SRC"/. "$INSTALL_DIR"/; fi
chmod +x "$INSTALL_DIR/SDOC"

cat > "$INSTALL_DIR/appsettings.json" <<JSON
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.Hosting.Lifetime": "Information"
    }
  },
  "Worker": {
    "ServerUrl": "$SERVER_URL",
    "MachineId": $MACHINE_ID,
    "AllowRemoteControl": $ALLOW
  }
}
JSON

umask 077
printf 'WORKER_API_KEY=%s\n' "$KEY" > "$ENV_FILE"
chmod 600 "$ENV_FILE"

cat > "/etc/systemd/system/$SERVICE.service" <<UNIT
[Unit]
Description=SDOC Worker
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=$INSTALL_DIR/SDOC
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$ENV_FILE
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

echo "Starting the service..."
systemctl daemon-reload
systemctl enable --now "$SERVICE"
systemctl --no-pager --lines=0 status "$SERVICE" || true
echo "Done. Machine $MACHINE_ID will appear online on the Dashboard within a few seconds."
echo "Logs: journalctl -u $SERVICE -f"
