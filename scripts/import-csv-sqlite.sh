#!/usr/bin/env bash
set -euo pipefail

# Uso: scripts/import-csv-sqlite.sh [DB_PATH] [CSV_DIR]
DB_PATH=${1:-data/urede.db}
CSV_DIR=${2:-bases_csv}

COOPS_CSV="$CSV_DIR/cooperativas.csv"
CIDADES_CSV="$CSV_DIR/cidades.csv"
OPERADORES_CSV="$CSV_DIR/operadores.csv"

if [[ ! -f "$DB_PATH" ]]; then
  echo "[import-csv] Banco não encontrado em $DB_PATH. Execute scripts/create-sqlite-db.sh primeiro." >&2
  exit 1
fi

echo "[import-csv] Importando CSVs do diretório $CSV_DIR para $DB_PATH"

sqlite3 "$DB_PATH" <<SQL
.mode csv
.headers off
.timeout 2000
PRAGMA journal_mode=DELETE;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=OFF; -- desabilita durante import para velocidade, reabilita depois

-- Limpar dados anteriores (idempotência)
DELETE FROM urede_cidades;
DELETE FROM urede_cooperativas;
DELETE FROM urede_operadores;

-- Import cooperativas via staging (permite colunas extras no schema sem quebrar o CSV)
DROP TABLE IF EXISTS tmp_cooperativas;
CREATE TABLE tmp_cooperativas (
  id_singular   TEXT,
  UNIODONTO     TEXT,
  CNPJ          TEXT,
  CRO_OPERAORA  TEXT,
  DATA_FUNDACAO TEXT,
  RAZ_SOCIAL    TEXT,
  CODIGO_ANS    TEXT,
  FEDERACAO     TEXT,
  SOFTWARE      TEXT,
  TIPO          TEXT,
  OP_PR         TEXT
);
.import --skip 1 "$COOPS_CSV" tmp_cooperativas

INSERT INTO urede_cooperativas (
  id_singular,
  UNIODONTO,
  CNPJ,
  CRO_OPERAORA,
  DATA_FUNDACAO,
  RAZ_SOCIAL,
  CODIGO_ANS,
  FEDERACAO,
  SOFTWARE,
  TIPO,
  OP_PR
)
SELECT
  id_singular,
  UNIODONTO,
  CNPJ,
  CRO_OPERAORA,
  DATA_FUNDACAO,
  RAZ_SOCIAL,
  CODIGO_ANS,
  FEDERACAO,
  SOFTWARE,
  TIPO,
  OP_PR
FROM tmp_cooperativas;

DROP TABLE tmp_cooperativas;

-- Import cidades diretamente (ordem compatível)
.import --skip 1 "$CIDADES_CSV" urede_cidades

-- Normalizar FK: CSV pode trazer ID_SINGULAR vazio. Em SQLite, FK não é validada para NULL, mas é para ''.
UPDATE urede_cidades
SET ID_SINGULAR = NULL
WHERE ID_SINGULAR IS NOT NULL
  AND TRIM(ID_SINGULAR) = '';

-- Se houver referências inválidas (ID_SINGULAR sem cooperativa correspondente), normaliza para NULL
UPDATE urede_cidades
SET ID_SINGULAR = NULL
WHERE ID_SINGULAR IS NOT NULL
  AND TRIM(ID_SINGULAR) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM urede_cooperativas c WHERE c.id_singular = urede_cidades.ID_SINGULAR
  );

-- Import operadores via staging para contornar CHECK e normalizar status
DROP TABLE IF EXISTS tmp_operadores;
CREATE TABLE tmp_operadores (
  id TEXT,
  created_at TEXT,
  nome TEXT,
  id_singular TEXT,
  email TEXT,
  telefone TEXT,
  whatsapp TEXT,
  cargo TEXT,
  status TEXT
);
.import --skip 1 "$OPERADORES_CSV" tmp_operadores

INSERT INTO urede_operadores (id, created_at, nome, id_singular, email, telefone, whatsapp, cargo, status)
SELECT
  CAST(id AS INTEGER),
  COALESCE(NULLIF(created_at, ''), CURRENT_TIMESTAMP),
  nome,
  id_singular,
  email,
  telefone,
  whatsapp,
  cargo,
  CASE WHEN LOWER(TRIM(status)) IN ('t','true','1','y','yes') THEN 1 ELSE 0 END
FROM tmp_operadores;

DROP TABLE tmp_operadores;

PRAGMA foreign_keys=ON;
SQL

has_links=$(sqlite3 "$DB_PATH" -batch -noheader "SELECT 1 FROM pragma_table_info('urede_cooperativas') WHERE name IN ('federacao_id','confederacao_id','operadora_id') LIMIT 1;")
if [[ "$has_links" == "1" ]]; then
  echo "[import-csv] Preenchendo federacao_id/confederacao_id/operadora_id (backfill)"
  sqlite3 "$DB_PATH" <<'SQL'
.timeout 2000
PRAGMA foreign_keys=ON;

-- federacao_id para singulares (via nome em FEDERACAO)
UPDATE urede_cooperativas AS c
SET federacao_id = (
  SELECT f.id_singular
  FROM urede_cooperativas AS f
  WHERE UPPER(TRIM(f.UNIODONTO)) = UPPER(TRIM(c.FEDERACAO))
    AND UPPER(TRIM(f.TIPO)) LIKE 'FEDER%'
  LIMIT 1
)
WHERE (c.federacao_id IS NULL OR TRIM(c.federacao_id) = '')
  AND c.FEDERACAO IS NOT NULL AND TRIM(c.FEDERACAO) <> ''
  AND UPPER(TRIM(c.TIPO)) NOT LIKE 'FEDER%'
  AND UPPER(TRIM(c.TIPO)) NOT LIKE 'CONFED%';

-- confederacao_id para federações (via nome em FEDERACAO)
UPDATE urede_cooperativas AS f
SET confederacao_id = (
  SELECT c.id_singular
  FROM urede_cooperativas AS c
  WHERE UPPER(TRIM(c.UNIODONTO)) = UPPER(TRIM(f.FEDERACAO))
    AND UPPER(TRIM(c.TIPO)) LIKE 'CONFED%'
  LIMIT 1
)
WHERE (f.confederacao_id IS NULL OR TRIM(f.confederacao_id) = '')
  AND f.FEDERACAO IS NOT NULL AND TRIM(f.FEDERACAO) <> ''
  AND UPPER(TRIM(f.TIPO)) LIKE 'FEDER%';

-- confederacao_id para singulares (propaga via federacao_id)
UPDATE urede_cooperativas AS s
SET confederacao_id = (
  SELECT f.confederacao_id
  FROM urede_cooperativas AS f
  WHERE f.id_singular = s.federacao_id
  LIMIT 1
)
WHERE (s.confederacao_id IS NULL OR TRIM(s.confederacao_id) = '')
  AND s.federacao_id IS NOT NULL AND TRIM(s.federacao_id) <> '';

-- confederação aponta para si mesma (opcional)
UPDATE urede_cooperativas
SET confederacao_id = id_singular
WHERE UPPER(TRIM(TIPO)) LIKE 'CONFED%'
  AND (confederacao_id IS NULL OR TRIM(confederacao_id) = '');

-- operadora_id (heurística): Prestadora -> tenta federação Operadora; senão confederação Operadora
UPDATE urede_cooperativas AS s
SET operadora_id = (
  SELECT f.id_singular
  FROM urede_cooperativas AS f
  WHERE f.id_singular = s.federacao_id
    AND TRIM(f.OP_PR) = 'Operadora'
  LIMIT 1
)
WHERE TRIM(s.OP_PR) = 'Prestadora'
  AND (s.operadora_id IS NULL OR TRIM(s.operadora_id) = '');

UPDATE urede_cooperativas AS s
SET operadora_id = (
  SELECT c.id_singular
  FROM urede_cooperativas AS c
  WHERE c.id_singular = s.confederacao_id
    AND TRIM(c.OP_PR) = 'Operadora'
  LIMIT 1
)
WHERE TRIM(s.OP_PR) = 'Prestadora'
  AND (s.operadora_id IS NULL OR TRIM(s.operadora_id) = '');
SQL
fi

echo "[import-csv] Normalizando boolean em urede_operadores.status"
# Já normalizado durante o INSERT da staging

echo "[import-csv] Verificando contagens"
sqlite3 "$DB_PATH" <<'SQL'
.mode column
.headers on
SELECT 'urede_cooperativas' AS tabela, COUNT(*) AS linhas FROM urede_cooperativas;
SELECT 'urede_cidades' AS tabela, COUNT(*) AS linhas FROM urede_cidades;
SELECT 'urede_operadores' AS tabela, COUNT(*) AS linhas FROM urede_operadores;
SQL

echo "[import-csv] Finalizado"
