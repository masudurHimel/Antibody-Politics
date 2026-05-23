#!/usr/bin/env bash
# Antibody Politics — ngrok tunnel for the local backend.
#
# Usage:
#   1. In one terminal:  ./run.sh        (boots backend on :8001)
#   2. In another:       ./scripts/tunnel.sh
#   3. Share the printed https://*.ngrok-free.app/ URL with friends.
#
# Friends create or join a room from that URL — host taps
# MULTIPLAYER -> CREATE, copies the invite link, and shares it.

set -e

PORT="${PORT:-8001}"

command -v ngrok >/dev/null || {
  echo "ngrok not found."
  echo "Install: brew install ngrok/ngrok/ngrok"
  echo "Sign up at https://dashboard.ngrok.com to get an authtoken, then:"
  echo "  ngrok config add-authtoken <YOUR_TOKEN>"
  exit 1
}

echo "-> Forwarding http://127.0.0.1:${PORT}"
echo "-> Make sure ./run.sh is running in another terminal."
exec ngrok http "${PORT}" --log=stdout
