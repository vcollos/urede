#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/backups/db"
mkdir -p "$OUT_DIR"

ts="$(date +%Y%m%d_%H%M%S)"

copy_if_exists() {
  local src="$1"
  local label="$2"
  if [[ -f "$src" ]]; then
    cp -f "$src" "$OUT_DIR/${label}.${ts}.bak"
    echo "[backup-db] $label -> $OUT_DIR/${label}.${ts}.bak"
  fi
}

copy_if_exists "$ROOT_DIR/data/urede.db" "urede.db"
copy_if_exists "$ROOT_DIR/data/urede.db.nwal" "urede.db.nwal"

echo "[backup-db] OK"
