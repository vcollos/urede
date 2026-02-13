-- 20260212_011_plantao_clinicas.sql
-- Subtabela de cooperativas para cadastrar endereços de clínicas próprias usadas em plantão.
-- Regras:
-- - Relacionamento obrigatório via id_singular (FK para urede_cooperativas)
-- - IBGE (cd_municipio_7) é a referência principal; cidade/UF são derivados dele no backend.
-- - Migração não destrutiva: apenas cria tabela/índices se não existirem.

BEGIN;

CREATE TABLE IF NOT EXISTS urede_cooperativa_plantao_clinicas (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  id_singular TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  cd_municipio_7 TEXT NOT NULL,
  nome_local TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  telefone_fixo TEXT,
  telefone_celular TEXT,
  descricao TEXT,
  ativo INTEGER DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_coop_plantao_clinicas_id_singular
  ON urede_cooperativa_plantao_clinicas(id_singular);

CREATE INDEX IF NOT EXISTS idx_coop_plantao_clinicas_cd_municipio_7
  ON urede_cooperativa_plantao_clinicas(cd_municipio_7);

COMMIT;

INSERT OR IGNORE INTO schema_migrations(version)
VALUES ('20260212_011_plantao_clinicas');
