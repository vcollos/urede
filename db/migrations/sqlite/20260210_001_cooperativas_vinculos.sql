-- Migração SQLite: Cooperativas (ligações e subtabelas)
-- Versão: 20260210_001_cooperativas_vinculos
-- Objetivo:
-- 1) Manter compatibilidade com o schema atual (colunas do CSV permanecem)
-- 2) Adicionar colunas NÃO destrutivas para ligações por ID_SINGULAR
-- 3) Criar subtabelas para dados variáveis/adicionais
-- 4) Backfill (preencher) federacao_id/confederacao_id/operadora_id quando possível
--
-- Observações importantes:
-- - SQLite não permite adicionar FOREIGN KEY em colunas novas via ALTER TABLE.
--   Por isso, as novas ligações ficam como colunas + índices (e podem ser validadas por checks).
-- - Rollback recomendado: restaurar o backup do arquivo .db.

BEGIN;

PRAGMA foreign_keys=ON;

-- 0) Controle de versão de schema
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- 1) Novas colunas na tabela principal (apenas adições)
--    (se sua tabela ainda é a versão antiga do CSV, estas colunas não existem)
ALTER TABLE urede_cooperativas ADD COLUMN federacao_id TEXT;        -- FK lógica -> urede_cooperativas.id_singular (TIPO=FEDERACAO)
ALTER TABLE urede_cooperativas ADD COLUMN confederacao_id TEXT;     -- FK lógica -> urede_cooperativas.id_singular (TIPO=CONFEDERACAO)
ALTER TABLE urede_cooperativas ADD COLUMN operadora_id TEXT;        -- FK lógica -> urede_cooperativas.id_singular (OP_PR='Operadora')
ALTER TABLE urede_cooperativas ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1;
ALTER TABLE urede_cooperativas ADD COLUMN resp_tecnico TEXT;
ALTER TABLE urede_cooperativas ADD COLUMN cro_resp_tecnico TEXT;
ALTER TABLE urede_cooperativas ADD COLUMN cro_operadora TEXT;

-- 2) Índices para performance de concatenações/joins
CREATE INDEX IF NOT EXISTS idx_urede_cooperativas_codigo_ans      ON urede_cooperativas(CODIGO_ANS);
CREATE INDEX IF NOT EXISTS idx_urede_cooperativas_federacao_id    ON urede_cooperativas(federacao_id);
CREATE INDEX IF NOT EXISTS idx_urede_cooperativas_confederacao_id ON urede_cooperativas(confederacao_id);
CREATE INDEX IF NOT EXISTS idx_urede_cooperativas_operadora_id    ON urede_cooperativas(operadora_id);

-- 3) Subtabelas para dados variáveis/adicionais
-- 3.1) Contatos por cooperativa (0..N)
CREATE TABLE IF NOT EXISTS urede_cooperativa_contatos (
  id             TEXT PRIMARY KEY,
  cooperativa_id TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  tipo           TEXT NOT NULL,     -- ex: 'email','telefone','whatsapp','site','outro'
  valor          TEXT NOT NULL,
  label          TEXT,
  principal      INTEGER NOT NULL DEFAULT 0,
  ativo          INTEGER NOT NULL DEFAULT 1,
  criado_em      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_coop_contatos_coop_id ON urede_cooperativa_contatos(cooperativa_id);
CREATE INDEX IF NOT EXISTS idx_coop_contatos_tipo    ON urede_cooperativa_contatos(tipo);

-- 3.2) Campos extras (EAV simples) por cooperativa (0..N)
CREATE TABLE IF NOT EXISTS urede_cooperativa_extras (
  cooperativa_id TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  chave          TEXT NOT NULL,
  valor          TEXT,
  atualizado_em  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (cooperativa_id, chave)
);
CREATE INDEX IF NOT EXISTS idx_coop_extras_chave ON urede_cooperativa_extras(chave);

-- 4) Backfill de ligações (derivadas do CSV atual)
-- 4.1) federacao_id para singulares (via nome da federação em FEDERACAO)
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

-- 4.2) confederacao_id para federações (via nome da confederação em FEDERACAO)
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

-- 4.3) confederacao_id para singulares (propaga via federacao_id)
UPDATE urede_cooperativas AS s
SET confederacao_id = (
  SELECT f.confederacao_id
  FROM urede_cooperativas AS f
  WHERE f.id_singular = s.federacao_id
  LIMIT 1
)
WHERE (s.confederacao_id IS NULL OR TRIM(s.confederacao_id) = '')
  AND s.federacao_id IS NOT NULL AND TRIM(s.federacao_id) <> '';

-- 4.4) confederação aponta para si mesma (opcional, facilita joins)
UPDATE urede_cooperativas
SET confederacao_id = id_singular
WHERE UPPER(TRIM(TIPO)) LIKE 'CONFED%'
  AND (confederacao_id IS NULL OR TRIM(confederacao_id) = '');

-- 4.5) operadora_id (heurística): Prestadora -> tenta usar a federação se ela for Operadora; senão tenta confederação
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

-- 5) View de cadastro (nomes canônicos para uso em queries novas)
CREATE VIEW IF NOT EXISTS urede_cooperativas_cadastro AS
SELECT
  id_singular,
  UNIODONTO     AS nome_singular,
  RAZ_SOCIAL    AS raz_social,
  CNPJ          AS cnpj,
  DATA_FUNDACAO AS data_fundacao,
  CODIGO_ANS    AS reg_ans,
  TIPO          AS papel_rede,
  OP_PR         AS tipo,
  federacao_id,
  confederacao_id,
  operadora_id,
  ativo,
  resp_tecnico,
  cro_resp_tecnico,
  COALESCE(cro_operadora, CRO_OPERAORA) AS cro_operadora
FROM urede_cooperativas;

-- 6) Marca a migração como aplicada
INSERT INTO schema_migrations(version) VALUES ('20260210_001_cooperativas_vinculos');

COMMIT;
