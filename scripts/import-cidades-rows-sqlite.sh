#!/usr/bin/env bash
set -euo pipefail

# Importa o CSV canônico de cidades (urede_cidades_rows.csv) para urede_cidades.
#
# Uso:
#   scripts/import-cidades-rows-sqlite.sh [DB_PATH] [CSV_PATH]

DB_PATH=${1:-data/urede.db.nwal}
CSV_PATH=${2:-bases_csv/urede_cidades_rows.csv}

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "[import-cidades-rows] sqlite3 não encontrado no PATH" >&2
  exit 1
fi

if [[ ! -f "$DB_PATH" ]]; then
  echo "[import-cidades-rows] Banco não encontrado em $DB_PATH" >&2
  exit 1
fi

if [[ ! -f "$CSV_PATH" ]]; then
  echo "[import-cidades-rows] CSV não encontrado em $CSV_PATH" >&2
  exit 1
fi

# Backup
_ts=$(date +"%Y%m%d_%H%M%S")
backup_dir="$(dirname "$DB_PATH")/backups"
mkdir -p "$backup_dir"
backup_path="$backup_dir/$(basename "$DB_PATH").before_cidades_rows.$_ts.bak"

echo "[import-cidades-rows] Backup -> $backup_path"
sqlite3 "$DB_PATH" ".backup '$backup_path'"

sqlite3 "$DB_PATH" <<SQL
.mode csv
.headers off
.timeout 2000

PRAGMA foreign_keys=OFF;

BEGIN;

DROP TABLE IF EXISTS tmp_cidades_rows;
CREATE TABLE tmp_cidades_rows (
  cd_municipio_7      TEXT,
  regional_saude      TEXT,
  nm_cidade           TEXT,
  uf_municipio        TEXT,
  nm_regiao           TEXT,
  cidades_habitantes  TEXT,
  id_singular         TEXT,
  reg_ans             TEXT
);

.import --skip 1 '$CSV_PATH' tmp_cidades_rows

-- Substitui o cadastro atual
DELETE FROM urede_cidades;

-- Inserção: mapeia para o schema legado (mantém CD_MUNICIPIO como NULL)
INSERT INTO urede_cidades (
  CD_MUNICIPIO_7,
  CD_MUNICIPIO,
  REGIONAL_SAUDE,
  NM_CIDADE,
  UF_MUNICIPIO,
  NM_REGIAO,
  CIDADES_HABITANTES,
  ID_SINGULAR,
  id_singular_credenciamento,
  id_singular_vendas,
  reg_ans
)
SELECT
  cd_municipio_7,
  NULL,
  regional_saude,
  nm_cidade,
  uf_municipio,
  nm_regiao,
  CASE
    WHEN TRIM(COALESCE(cidades_habitantes, '')) = '' THEN NULL
    ELSE CAST(cidades_habitantes AS INTEGER)
  END,
  NULLIF(TRIM(id_singular), ''),
  NULLIF(TRIM(id_singular), ''),
  NULLIF(TRIM(id_singular), ''),
  NULLIF(TRIM(reg_ans), '')
FROM tmp_cidades_rows;

-- Normalizações
UPDATE urede_cidades SET ID_SINGULAR = NULL WHERE ID_SINGULAR IS NOT NULL AND TRIM(ID_SINGULAR) = '';
UPDATE urede_cidades SET id_singular_credenciamento = NULL WHERE id_singular_credenciamento IS NOT NULL AND TRIM(id_singular_credenciamento) = '';
UPDATE urede_cidades SET id_singular_vendas = NULL WHERE id_singular_vendas IS NOT NULL AND TRIM(id_singular_vendas) = '';
UPDATE urede_cidades SET reg_ans = NULL WHERE reg_ans IS NOT NULL AND TRIM(reg_ans) = '';

-- Remove referências inválidas (evita violação de FK/consistência)
UPDATE urede_cidades
SET ID_SINGULAR = NULL,
    id_singular_credenciamento = NULL
WHERE (ID_SINGULAR IS NOT NULL OR id_singular_credenciamento IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM urede_cooperativas c
    WHERE c.id_singular = COALESCE(urede_cidades.id_singular_credenciamento, urede_cidades.ID_SINGULAR)
  );

DROP TABLE tmp_cidades_rows;

COMMIT;

PRAGMA foreign_keys=ON;
SQL

# Checks
integrity=$(sqlite3 "$DB_PATH" -batch -noheader "PRAGMA integrity_check;")
if [[ "$integrity" != "ok" ]]; then
  echo "[import-cidades-rows] integrity_check falhou: $integrity" >&2
  echo "[import-cidades-rows] Rollback: cp -f '$backup_path' '$DB_PATH'" >&2
  exit 1
fi

fk=$(sqlite3 "$DB_PATH" -batch -noheader "PRAGMA foreign_keys=ON; PRAGMA foreign_key_check;")
if [[ -n "$fk" ]]; then
  echo "[import-cidades-rows] foreign_key_check encontrou violações:" >&2
  echo "$fk" >&2
  echo "[import-cidades-rows] Rollback: cp -f '$backup_path' '$DB_PATH'" >&2
  exit 1
fi

echo "[import-cidades-rows] OK (backup: $backup_path)"
