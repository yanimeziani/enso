#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
BACKEND_DIR="$ROOT_DIR/services/backend"
VENV_DIR="$BACKEND_DIR/.venv"
BACKEND_APP="enso_api.main:app"
BACKEND_HOST="127.0.0.1"
BACKEND_PORT="8000"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to bootstrap the backend." >&2
  exit 1
fi

echo "\n▶ Bootstrapping backend environment"
if [ ! -d "$VENV_DIR" ]; then
  echo " - creating virtual environment at $VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi

# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

if ! "$VENV_DIR/bin/pip" show enso-backend >/dev/null 2>&1; then
  echo " - installing backend dependencies"
  (cd "$BACKEND_DIR" && "$VENV_DIR/bin/pip" install -e .[test])
fi

if ! "$VENV_DIR/bin/pip" show uvicorn >/dev/null 2>&1; then
  echo " - installing uvicorn"
  "$VENV_DIR/bin/pip" install "uvicorn[standard]"
fi

export ENSO_API_URL="http://$BACKEND_HOST:$BACKEND_PORT"
export DATABASE_URL=${DATABASE_URL:-"sqlite:///./enso.db"}

echo "\n▶ Starting FastAPI on $ENSO_API_URL"
uvicorn "$BACKEND_APP" --reload --host "$BACKEND_HOST" --port "$BACKEND_PORT" --app-dir "$BACKEND_DIR" &
BACKEND_PID=$!

cleanup() {
  if ps -p $BACKEND_PID >/dev/null 2>&1; then
    kill $BACKEND_PID >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

echo "\n▶ Starting web shell (pnpm dev:web)"
cd "$ROOT_DIR"
pnpm dev:web

wait $BACKEND_PID
