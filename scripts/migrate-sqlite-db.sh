#!/usr/bin/env bash
set -euo pipefail

# Uso: scripts/migrate-sqlite-db.sh [DB_PATH] [MIGRATIONS_DIR]
DB_PATH=${1:-data/urede.db}
MIGRATIONS_DIR=${2:-db/migrations/sqlite}

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "[migrate-sqlite-db] sqlite3 não encontrado no PATH" >&2
  exit 1
fi

if [[ ! -f "$DB_PATH" ]]; then
  echo "[migrate-sqlite-db] Banco não encontrado em $DB_PATH" >&2
  exit 1
fi

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "[migrate-sqlite-db] Diretório de migrações não encontrado em $MIGRATIONS_DIR" >&2
  exit 1
fi

ts=$(date +"%Y%m%d_%H%M%S")
backup_dir="$(dirname "$DB_PATH")/backups"
mkdir -p "$backup_dir"
backup_path="$backup_dir/$(basename "$DB_PATH").$ts.bak"

echo "[migrate-sqlite-db] Backup -> $backup_path"
sqlite3 "$DB_PATH" ".backup '$backup_path'"

if [[ ! -s "$backup_path" ]]; then
  echo "[migrate-sqlite-db] Backup falhou (arquivo vazio ou inexistente): $backup_path" >&2
  exit 1
fi

# Garantir tabela de controle
sqlite3 "$DB_PATH" <<'SQL'
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
SQL

shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)

if (( ${#files[@]} == 0 )); then
  echo "[migrate-sqlite-db] Nenhuma migração encontrada em $MIGRATIONS_DIR" >&2
  exit 1
fi

# Ordenação estável (por nome)
IFS=$'\n' files_sorted=($(printf '%s\n' "${files[@]}" | sort))
unset IFS

applied_any=0

for file in "${files_sorted[@]}"; do
  base=$(basename "$file")
  version=${base%.sql}

  already=$(sqlite3 "$DB_PATH" -batch -noheader "SELECT 1 FROM schema_migrations WHERE version = '$version' LIMIT 1;")
  if [[ "$already" == "1" ]]; then
    echo "[migrate-sqlite-db] SKIP $version"
    continue
  fi

  echo "[migrate-sqlite-db] APPLY $version"
  if ! sqlite3 "$DB_PATH" < "$file"; then
    echo "[migrate-sqlite-db] ERRO aplicando $version" >&2
    echo "[migrate-sqlite-db] Para rollback, restaure o backup: cp -f '$backup_path' '$DB_PATH'" >&2
    exit 1
  fi
  applied_any=1
done

# Integrity checks
integrity=$(sqlite3 "$DB_PATH" -batch -noheader "PRAGMA integrity_check;")
if [[ "$integrity" != "ok" ]]; then
  echo "[migrate-sqlite-db] integrity_check falhou: $integrity" >&2
  echo "[migrate-sqlite-db] Para rollback, restaure o backup: cp -f '$backup_path' '$DB_PATH'" >&2
  exit 1
fi

fk_violations=$(sqlite3 "$DB_PATH" -batch -noheader "PRAGMA foreign_keys=ON; PRAGMA foreign_key_check;")
if [[ -n "$fk_violations" ]]; then
  echo "[migrate-sqlite-db] foreign_key_check encontrou violações:" >&2
  echo "$fk_violations" >&2
  echo "[migrate-sqlite-db] Para rollback, restaure o backup: cp -f '$backup_path' '$DB_PATH'" >&2
  exit 1
fi

# Checagens de consistência específicas (warnings)
# 1) Operadoras sem CODIGO_ANS
missing_ans=$(sqlite3 "$DB_PATH" -batch -noheader "SELECT COUNT(*) FROM urede_cooperativas WHERE TRIM(OP_PR) = 'Operadora' AND (CODIGO_ANS IS NULL OR TRIM(CODIGO_ANS) = '');")
if [[ "$missing_ans" != "0" ]]; then
  echo "[migrate-sqlite-db] WARN: Operadoras sem CODIGO_ANS: $missing_ans" >&2
fi

# 2) Prestadoras sem operadora_id (a heurística pode não cobrir 100%)
missing_op=$(sqlite3 "$DB_PATH" -batch -noheader "SELECT COUNT(*) FROM urede_cooperativas WHERE TRIM(OP_PR) = 'Prestadora' AND (operadora_id IS NULL OR TRIM(operadora_id) = '');")
if [[ "$missing_op" != "0" ]]; then
  echo "[migrate-sqlite-db] WARN: Prestadoras sem operadora_id: $missing_op" >&2
fi

echo "[migrate-sqlite-db] OK (backup: $backup_path)"

# Exit code 0 sempre que atomicidade + checks passaram.
exit 0
