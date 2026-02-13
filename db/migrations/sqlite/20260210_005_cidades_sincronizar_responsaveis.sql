-- Migração SQLite: sincronizar responsáveis de cidades (credenciamento = vendas)
-- Versão: 20260210_005_cidades_sincronizar_responsaveis
-- Regra de negócio:
-- - A mesma cidade de atuação vale para credenciamento e vendas.
-- - Portanto, id_singular_vendas deve espelhar id_singular_credenciamento (e o legado ID_SINGULAR).
--
-- Esta migração NÃO remove colunas (não-destrutiva). Ela apenas:
-- - Preenche id_singular_vendas a partir do campo principal
-- - Cria triggers para manter os campos sincronizados em inserts/updates

BEGIN;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Backfill (estado atual)
UPDATE urede_cidades
SET id_singular_credenciamento = COALESCE(NULLIF(TRIM(id_singular_credenciamento), ''), NULLIF(TRIM(ID_SINGULAR), ''))
WHERE (id_singular_credenciamento IS NULL OR TRIM(id_singular_credenciamento) = '')
  AND ID_SINGULAR IS NOT NULL AND TRIM(ID_SINGULAR) <> '';

UPDATE urede_cidades
SET id_singular_vendas = COALESCE(NULLIF(TRIM(id_singular_vendas), ''), NULLIF(TRIM(id_singular_credenciamento), ''), NULLIF(TRIM(ID_SINGULAR), ''))
WHERE (id_singular_vendas IS NULL OR TRIM(id_singular_vendas) = '');

-- Triggers (sincronização)
DROP TRIGGER IF EXISTS trg_urede_cidades_sync_insert;
CREATE TRIGGER trg_urede_cidades_sync_insert
AFTER INSERT ON urede_cidades
FOR EACH ROW
BEGIN
  UPDATE urede_cidades
  SET
    ID_SINGULAR = COALESCE(NULLIF(TRIM(NEW.ID_SINGULAR), ''), NULLIF(TRIM(NEW.id_singular_credenciamento), ''), NULLIF(TRIM(NEW.id_singular_vendas), '')),
    id_singular_credenciamento = COALESCE(NULLIF(TRIM(NEW.id_singular_credenciamento), ''), NULLIF(TRIM(NEW.ID_SINGULAR), ''), NULLIF(TRIM(NEW.id_singular_vendas), '')),
    id_singular_vendas = COALESCE(NULLIF(TRIM(NEW.id_singular_vendas), ''), NULLIF(TRIM(NEW.id_singular_credenciamento), ''), NULLIF(TRIM(NEW.ID_SINGULAR), ''))
  WHERE CD_MUNICIPIO_7 = NEW.CD_MUNICIPIO_7;
END;

DROP TRIGGER IF EXISTS trg_urede_cidades_sync_update;
CREATE TRIGGER trg_urede_cidades_sync_update
AFTER UPDATE OF ID_SINGULAR, id_singular_credenciamento, id_singular_vendas ON urede_cidades
FOR EACH ROW
BEGIN
  UPDATE urede_cidades
  SET
    ID_SINGULAR = COALESCE(NULLIF(TRIM(NEW.ID_SINGULAR), ''), NULLIF(TRIM(NEW.id_singular_credenciamento), ''), NULLIF(TRIM(NEW.id_singular_vendas), '')),
    id_singular_credenciamento = COALESCE(NULLIF(TRIM(NEW.id_singular_credenciamento), ''), NULLIF(TRIM(NEW.ID_SINGULAR), ''), NULLIF(TRIM(NEW.id_singular_vendas), '')),
    id_singular_vendas = COALESCE(NULLIF(TRIM(NEW.id_singular_vendas), ''), NULLIF(TRIM(NEW.id_singular_credenciamento), ''), NULLIF(TRIM(NEW.ID_SINGULAR), ''))
  WHERE CD_MUNICIPIO_7 = NEW.CD_MUNICIPIO_7;
END;

INSERT INTO schema_migrations(version) VALUES ('20260210_005_cidades_sincronizar_responsaveis');
COMMIT;
