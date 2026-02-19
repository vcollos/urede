-- Migração SQLite: normalizar FK de cidades
-- Versão: 20260210_002_cidades_normalizar_id_singular
-- Objetivo:
-- - Converter ID_SINGULAR vazio ("") em NULL na urede_cidades.
--   Em SQLite, FK não é validada para NULL, mas é para string vazia.
--   Isso remove violações em PRAGMA foreign_key_check sem perder informação (vazio == desconhecido).

BEGIN;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

UPDATE urede_cidades
SET ID_SINGULAR = NULL
WHERE ID_SINGULAR IS NOT NULL
  AND TRIM(ID_SINGULAR) = '';

INSERT INTO schema_migrations(version) VALUES ('20260210_002_cidades_normalizar_id_singular');
COMMIT;
