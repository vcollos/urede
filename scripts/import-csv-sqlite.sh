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

-- Import cooperativas diretamente (ordem de colunas já compatível)
.import --skip 1 "$COOPS_CSV" urede_cooperativas

-- Import cidades diretamente (ordem compatível)
.import --skip 1 "$CIDADES_CSV" urede_cidades

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
