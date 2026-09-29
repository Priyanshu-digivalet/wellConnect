#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="$ROOT/node_modules/@embedded-postgres/darwin-arm64/native/bin"
DATA_DIR="$ROOT/.pgdata"
LOG_FILE="/tmp/wellconnect-postgres-server.log"

if [[ ! -x "$PG_BIN/pg_ctl" ]]; then
  echo "embedded postgres binaries not found. Run npm install first." >&2
  exit 1
fi

if [[ ! -f "$DATA_DIR/PG_VERSION" ]]; then
  echo "No local database cluster in .pgdata. Bootstrapping via embedded-postgres..."
  node "$ROOT/scripts/embedded-postgres.mjs" >/tmp/wellconnect-postgres-bootstrap.log 2>&1 &
  BOOT_PID=$!
  for _ in $(seq 1 30); do
    if grep -q postgres_ready /tmp/wellconnect-postgres-bootstrap.log 2>/dev/null; then
      break
    fi
    sleep 1
  done
  # Stop the node wrapper; keep the cluster files, then manage with pg_ctl.
  kill "$BOOT_PID" 2>/dev/null || true
  wait "$BOOT_PID" 2>/dev/null || true
  "$PG_BIN/pg_ctl" -D "$DATA_DIR" -m fast stop >/dev/null 2>&1 || true
  rm -f "$DATA_DIR/postmaster.pid"
fi

if "$PG_BIN/pg_ctl" -D "$DATA_DIR" status >/dev/null 2>&1; then
  echo "postgres already running on port 5432"
  exit 0
fi

rm -f "$DATA_DIR/postmaster.pid"
"$PG_BIN/pg_ctl" -D "$DATA_DIR" -l "$LOG_FILE" -o "-p 5432" start
echo "postgres started (log: $LOG_FILE)"
