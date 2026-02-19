-- Migração SQLite: adicionar cd_municipio_7 em endereços auxiliares da cooperativa
-- Versão: 20260211_007_enderecos_cd_municipio_7
-- Objetivo:
-- - Incluir código oficial IBGE (7 dígitos) nos endereços para reduzir erro de cadastro de cidade/UF.
-- - Preservar compatibilidade: cidade/uf continuam existindo.
-- - Backfill best-effort de cd_municipio_7 a partir de cidade+uf quando houver correspondência em urede_cidades.

BEGIN;

ALTER TABLE urede_cooperativa_enderecos ADD COLUMN cd_municipio_7 TEXT;

CREATE INDEX IF NOT EXISTS idx_coop_enderecos_cd_municipio_7
  ON urede_cooperativa_enderecos(cd_municipio_7);

UPDATE urede_cooperativa_enderecos
SET cd_municipio_7 = (
  SELECT c.CD_MUNICIPIO_7
  FROM urede_cidades c
  WHERE lower(trim(c.NM_CIDADE)) = lower(trim(urede_cooperativa_enderecos.cidade))
    AND upper(trim(c.UF_MUNICIPIO)) = upper(trim(urede_cooperativa_enderecos.uf))
  LIMIT 1
)
WHERE (cd_municipio_7 IS NULL OR trim(cd_municipio_7) = '')
  AND cidade IS NOT NULL
  AND uf IS NOT NULL;

INSERT INTO schema_migrations(version) VALUES ('20260211_007_enderecos_cd_municipio_7');

COMMIT;

