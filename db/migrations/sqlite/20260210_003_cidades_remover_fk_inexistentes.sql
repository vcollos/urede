-- Migração SQLite: remover (normalizar) referências inválidas de cidades -> cooperativas
-- Versão: 20260210_003_cidades_remover_fk_inexistentes
-- Objetivo:
-- - Se urede_cidades.ID_SINGULAR aponta para uma cooperativa que não existe,
--   isso viola FK e quebra PRAGMA foreign_key_check.
-- - Aqui, normalizamos para NULL (desconhecido) e deixamos um caminho claro
--   para correção: inserir a cooperativa faltante ou atribuir a cidade a outra.

BEGIN;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

UPDATE urede_cidades
SET ID_SINGULAR = NULL
WHERE ID_SINGULAR IS NOT NULL
  AND TRIM(ID_SINGULAR) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM urede_cooperativas c
    WHERE c.id_singular = urede_cidades.ID_SINGULAR
  );

INSERT INTO schema_migrations(version) VALUES ('20260210_003_cidades_remover_fk_inexistentes');
COMMIT;
