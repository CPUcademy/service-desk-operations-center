#!/usr/bin/env bash
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Run as root, e.g. sudo bash -c \"\$(curl -fsSL __SERVER__/api/v1/worker/install.sh)\""; exit 1; }
command -v curl >/dev/null || { echo "curl is required."; exit 1; }

SERVER='__SERVER__'
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Downloading SDOC Worker from $SERVER (about 50 MB) ..."
curl -fsSL "$SERVER/api/v1/worker/download?os=linux" -o "$WORK/worker.tar.gz"
mkdir "$WORK/worker"
tar -xzf "$WORK/worker.tar.gz" -C "$WORK/worker"

bash "$WORK/worker/install-worker.sh" "$SERVER" < /dev/tty
