#!/usr/bin/env bash
# Antibody Politics — boot script
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
FRONTEND_DIR="$REPO_ROOT/frontend"
VENV="$BACKEND_DIR/venv"
PORT_BACKEND=8001
PORT_VITE=5173

ensure_venv() {
  if [[ ! -x "$VENV/bin/python" ]]; then
    echo "→ creating venv at $VENV"
    python3.11 -m venv "$VENV" || python3 -m venv "$VENV"
    "$VENV/bin/pip" install --upgrade pip >/dev/null
    "$VENV/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
  fi
}

ensure_node_modules() {
  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    echo "→ installing frontend deps"
    (cd "$FRONTEND_DIR" && npm install)
  fi
}

ensure_frontend_build() {
  if [[ ! -d "$FRONTEND_DIR/dist" || -z "$(ls -A "$FRONTEND_DIR/dist" 2>/dev/null)" ]]; then
    echo "→ building frontend"
    (cd "$FRONTEND_DIR" && npm run build)
  fi
}

mode="${1:-run}"

case "$mode" in
  run)
    ensure_venv
    ensure_node_modules
    ensure_frontend_build
    echo "→ serving on http://127.0.0.1:$PORT_BACKEND"
    exec "$VENV/bin/uvicorn" app.main:app --app-dir "$BACKEND_DIR" --host 127.0.0.1 --port "$PORT_BACKEND"
    ;;
  dev)
    ensure_venv
    ensure_node_modules
    echo "→ dev: uvicorn :$PORT_BACKEND (reload) + vite :$PORT_VITE"
    "$VENV/bin/uvicorn" app.main:app --app-dir "$BACKEND_DIR" --host 127.0.0.1 --port "$PORT_BACKEND" --reload &
    UVICORN_PID=$!
    trap "kill $UVICORN_PID 2>/dev/null || true" EXIT INT TERM
    (cd "$FRONTEND_DIR" && npm run dev -- --host 127.0.0.1 --port "$PORT_VITE")
    ;;
  clean)
    echo "→ removing venv, node_modules, dist"
    rm -rf "$VENV" "$FRONTEND_DIR/node_modules" "$FRONTEND_DIR/dist"
    ;;
  *)
    echo "usage: $0 [run|dev|clean]"
    exit 1
    ;;
esac
