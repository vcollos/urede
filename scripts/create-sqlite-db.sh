#!/usr/bin/env bash
set -euo pipefail

DB_PATH=${1:-data/urede.db}

echo "[create-sqlite-db] Criando diretório $(dirname "$DB_PATH")"
mkdir -p "$(dirname "$DB_PATH")"

echo "[create-sqlite-db] Criando banco em $DB_PATH"
sqlite3 "$DB_PATH" <<'SQL'
.timeout 2000
PRAGMA journal_mode=DELETE;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;
.read db/sqlite_schema.sql
SQL

echo "[create-sqlite-db] OK"
