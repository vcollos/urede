-- Migração SQLite: cidades com dupla responsabilidade (credenciamento x vendas)
-- Versão: 20260210_004_cidades_dupla_responsabilidade
-- Objetivo:
-- - Permitir que uma cidade tenha cooperativas diferentes para:
--   1) credenciamento (responsável por credenciar prestadores)
--   2) vendas (responsável comercial)
-- - Manter compatibilidade com o esquema atual que usa apenas ID_SINGULAR.
--
-- Observação: a FK existente (ID_SINGULAR -> urede_cooperativas.id_singular) permanece.
-- As novas colunas são "FK lógicas" (coluna + índice) porque SQLite não adiciona FK via ALTER TABLE.

BEGIN;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Colunas novas
ALTER TABLE urede_cidades ADD COLUMN id_singular_credenciamento TEXT; -- cooperativa singular responsável por credenciamento
ALTER TABLE urede_cidades ADD COLUMN id_singular_vendas TEXT;         -- cooperativa singular responsável por vendas
ALTER TABLE urede_cidades ADD COLUMN reg_ans TEXT;                    -- código ANS (quando a origem do dado vier via operadora)

-- Backfill compatível
UPDATE urede_cidades
SET id_singular_credenciamento = ID_SINGULAR
WHERE (id_singular_credenciamento IS NULL OR TRIM(id_singular_credenciamento) = '')
  AND ID_SINGULAR IS NOT NULL AND TRIM(ID_SINGULAR) <> '';

-- Índices
CREATE INDEX IF NOT EXISTS idx_urede_cidades_reg_ans               ON urede_cidades(reg_ans);
CREATE INDEX IF NOT EXISTS idx_urede_cidades_id_singular_cred      ON urede_cidades(id_singular_credenciamento);
CREATE INDEX IF NOT EXISTS idx_urede_cidades_id_singular_vendas    ON urede_cidades(id_singular_vendas);

-- View canônica para queries novas
CREATE VIEW IF NOT EXISTS urede_cidades_cadastro AS
SELECT
  CD_MUNICIPIO_7   AS cd_municipio_7,
  REGIONAL_SAUDE   AS regional_saude,
  NM_CIDADE        AS nm_cidade,
  UF_MUNICIPIO     AS uf_municipio,
  NM_REGIAO        AS nm_regiao,
  CIDADES_HABITANTES AS cidades_habitantes,
  -- compat: se o novo campo estiver nulo, usa o legado
  COALESCE(NULLIF(TRIM(id_singular_credenciamento), ''), NULLIF(TRIM(ID_SINGULAR), '')) AS id_singular_credenciamento,
  NULLIF(TRIM(id_singular_vendas), '') AS id_singular_vendas,
  NULLIF(TRIM(reg_ans), '') AS reg_ans
FROM urede_cidades;

INSERT INTO schema_migrations(version) VALUES ('20260210_004_cidades_dupla_responsabilidade');
COMMIT;
