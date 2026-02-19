#!/usr/bin/env bash
set -euo pipefail

# Sobe frontend + backend localmente.
# Se já estiverem rodando, reinicia (mata por PID file e, como fallback, por porta).
#
# Uso:
#   bash scripts/dev-local.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RUN_DIR="$ROOT_DIR/.run"
mkdir -p "$RUN_DIR"

# Frontend usa Vite configurado para 3400 (vite.config.ts). Usamos strictPort para não \"escapar\" para outra porta.
FRONT_PORT=${FRONT_PORT:-3400}
BACK_PORT=${BACK_PORT:-$(awk -F= '/^PORT=/{print $2}' .env 2>/dev/null | tr -d '\r' | tail -n 1)}
BACK_PORT=${BACK_PORT:-8300}

kill_pidfile() {
  local name="$1"
  local pidfile="$RUN_DIR/$name.pid"
  if [[ -f "$pidfile" ]]; then
    local pid
    pid=$(cat "$pidfile" 2>/dev/null || true)
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "[dev-local] Stopping $name (pid=$pid)"
      kill -TERM "$pid" 2>/dev/null || true
      for _ in 1 2 3 4 5 6 7 8 9 10; do
        if kill -0 "$pid" 2>/dev/null; then
          sleep 0.2
        else
          break
        fi
      done
      if kill -0 "$pid" 2>/dev/null; then
        kill -KILL "$pid" 2>/dev/null || true
      fi
    fi
    rm -f "$pidfile"
  fi
}

kill_port() {
  local port="$1"
  local pids
  pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "[dev-local] Stopping processes on port $port: $pids"
    kill -TERM $pids 2>/dev/null || true
    sleep 0.4
    pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      kill -KILL $pids 2>/dev/null || true
    fi
  fi
}

# Stop previous runs
kill_pidfile "frontend"
kill_pidfile "backend"

# Fallback: stop by ports
for p in $(seq "$FRONT_PORT" "$((FRONT_PORT+10))"); do
  kill_port "$p"
done
kill_port "$BACK_PORT"

echo "[dev-local] Starting backend on port $BACK_PORT (env PORT can override)"
(
  cd "$ROOT_DIR"
  nohup npm run server:dev >"$RUN_DIR/backend.log" 2>&1 &
  echo $! >"$RUN_DIR/backend.pid"
)

# Give backend a moment to bind
sleep 0.4

echo "[dev-local] Starting frontend (Vite)"
(
  cd "$ROOT_DIR"
  nohup npm run dev -- --port "$FRONT_PORT" --strictPort >"$RUN_DIR/frontend.log" 2>&1 &
  echo $! >"$RUN_DIR/frontend.pid"
)

cat <<EOF
[dev-local] OK
- Frontend: http://localhost:$FRONT_PORT/
- Backend:  http://localhost:$BACK_PORT/

Logs:
- $RUN_DIR/frontend.log
- $RUN_DIR/backend.log
EOF
