#!/usr/bin/env bash
set -euo pipefail

# Importa um CSV canônico de cooperativas (urede_cooperativas_rows.csv)
# para a tabela urede_cooperativas mantendo compatibilidade com colunas legadas.
#
# Uso:
#   scripts/import-cooperativas-rows-sqlite.sh [DB_PATH] [CSV_PATH]
#
# Requisitos:
# - sqlite3 instalado
# - Tabela urede_cooperativas já existente (scripts/create-sqlite-db.sh ou migração aplicada)

DB_PATH=${1:-data/urede.db}
CSV_PATH=${2:-bases_csv/urede_cooperativas_rows.csv}

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "[import-coops-rows] sqlite3 não encontrado no PATH" >&2
  exit 1
fi

if [[ ! -f "$DB_PATH" ]]; then
  echo "[import-coops-rows] Banco não encontrado em $DB_PATH" >&2
  exit 1
fi

if [[ ! -f "$CSV_PATH" ]]; then
  echo "[import-coops-rows] CSV não encontrado em $CSV_PATH" >&2
  exit 1
fi

# Backup antes de alterar dados
# (rollback recomendado: restaurar este arquivo)
ts=$(date +"%Y%m%d_%H%M%S")
backup_dir="$(dirname "$DB_PATH")/backups"
mkdir -p "$backup_dir"
backup_path="$backup_dir/$(basename "$DB_PATH").before_cooperativas_rows.$ts.bak"

echo "[import-coops-rows] Backup -> $backup_path"
sqlite3 "$DB_PATH" ".backup '$backup_path'"

sqlite3 "$DB_PATH" <<SQL
.mode csv
.headers off
.timeout 2000

PRAGMA foreign_keys=OFF;

BEGIN;

-- staging com o formato do CSV canônico
DROP TABLE IF EXISTS tmp_cooperativas_rows;
CREATE TABLE tmp_cooperativas_rows (
  id_singular       TEXT,
  nome_singular     TEXT,
  raz_social        TEXT,
  cnpj              TEXT,
  data_fundacao     TEXT,
  reg_ans           TEXT,
  papel_rede        TEXT,
  federacao_id      TEXT,
  operadora_id      TEXT,
  ativo             TEXT,
  tipo              TEXT,
  resp_tecnico      TEXT,
  cro_resp_tecnico  TEXT,
  cro_operadora     TEXT
);

.import --skip 1 '$CSV_PATH' tmp_cooperativas_rows

-- Substitui o cadastro atual (mantendo o arquivo do DB e demais tabelas)
DELETE FROM urede_cooperativas;

INSERT INTO urede_cooperativas (
  id_singular,
  UNIODONTO,
  RAZ_SOCIAL,
  CNPJ,
  DATA_FUNDACAO,
  CODIGO_ANS,
  TIPO,
  OP_PR,
  federacao_id,
  operadora_id,
  ativo,
  resp_tecnico,
  cro_resp_tecnico,
  cro_operadora,
  CRO_OPERAORA
)
SELECT
  id_singular,
  nome_singular,
  raz_social,
  cnpj,
  data_fundacao,
  NULLIF(TRIM(reg_ans), ''),
  papel_rede,
  tipo,
  NULLIF(TRIM(federacao_id), ''),
  NULLIF(TRIM(operadora_id), ''),
  CASE WHEN LOWER(TRIM(ativo)) IN ('t','true','1','y','yes') THEN 1 ELSE 0 END,
  NULLIF(TRIM(resp_tecnico), ''),
  NULLIF(TRIM(cro_resp_tecnico), ''),
  NULLIF(TRIM(cro_operadora), ''),
  NULLIF(TRIM(cro_operadora), '')
FROM tmp_cooperativas_rows;

-- confederacao_id: define para todos com base na cooperativa CONFEDERACAO
UPDATE urede_cooperativas
SET confederacao_id = (
  SELECT id_singular
  FROM urede_cooperativas
  WHERE UPPER(TRIM(TIPO)) LIKE 'CONFED%'
  LIMIT 1
)
WHERE confederacao_id IS NULL OR TRIM(confederacao_id) = '';

-- FEDERACAO (nome) legado: deriva do federacao_id para compatibilidade
UPDATE urede_cooperativas
SET FEDERACAO = (
  SELECT f.UNIODONTO
  FROM urede_cooperativas f
  WHERE f.id_singular = urede_cooperativas.federacao_id
  LIMIT 1
)
WHERE federacao_id IS NOT NULL
  AND (FEDERACAO IS NULL OR TRIM(FEDERACAO) = '');

-- Se existir a coluna SOFTWARE no schema, mantém vazia (não vem no CSV canônico)

DROP TABLE tmp_cooperativas_rows;

COMMIT;

PRAGMA foreign_keys=ON;
SQL

# Integrity checks
integrity=$(sqlite3 "$DB_PATH" -batch -noheader "PRAGMA integrity_check;")
if [[ "$integrity" != "ok" ]]; then
  echo "[import-coops-rows] integrity_check falhou: $integrity" >&2
  echo "[import-coops-rows] Rollback: cp -f '$backup_path' '$DB_PATH'" >&2
  exit 1
fi

fk=$(sqlite3 "$DB_PATH" -batch -noheader "PRAGMA foreign_keys=ON; PRAGMA foreign_key_check;")
if [[ -n "$fk" ]]; then
  echo "[import-coops-rows] foreign_key_check encontrou violações:" >&2
  echo "$fk" >&2
  echo "[import-coops-rows] Rollback: cp -f '$backup_path' '$DB_PATH'" >&2
  exit 1
fi

# Warnings de consistência
missing_ans=$(sqlite3 "$DB_PATH" -batch -noheader "SELECT COUNT(*) FROM urede_cooperativas WHERE TRIM(OP_PR) = 'Operadora' AND (CODIGO_ANS IS NULL OR TRIM(CODIGO_ANS) = '');")
if [[ "$missing_ans" != "0" ]]; then
  echo "[import-coops-rows] WARN: Operadoras sem CODIGO_ANS: $missing_ans" >&2
fi

missing_op=$(sqlite3 "$DB_PATH" -batch -noheader "SELECT COUNT(*) FROM urede_cooperativas WHERE TRIM(OP_PR) = 'Prestadora' AND (operadora_id IS NULL OR TRIM(operadora_id) = '');")
if [[ "$missing_op" != "0" ]]; then
  echo "[import-coops-rows] WARN: Prestadoras sem operadora_id: $missing_op" >&2
fi

echo "[import-coops-rows] OK (backup: $backup_path)"
