-- Migração SQLite: subtabelas auxiliares da cooperativa (pessoas/contatos/estrutura)
-- Versão: 20260210_006_cooperativas_auxiliares
-- Regra: TODAS as subtabelas se relacionam por id_singular (não usar cooperativa_id).
--
-- Nota sobre UUID em SQLite:
-- - Não há tipo UUID nativo. Usamos TEXT.
-- - O default abaixo gera um identificador pseudo-uuid (hex), suficiente para chave primária local.
-- - O backend também pode sobrescrever enviando um UUID real.

BEGIN;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- 0) Migrar tabelas antigas criadas anteriormente para obedecer id_singular
-- 0.1) Contatos (antigo: cooperativa_id -> novo: id_singular + subtipo)
--     Estratégia: rename -> create -> copy -> drop

ALTER TABLE urede_cooperativa_contatos RENAME TO urede_cooperativa_contatos_old;
DROP INDEX IF EXISTS idx_coop_contatos_coop_id;
DROP INDEX IF EXISTS idx_coop_contatos_tipo;

CREATE TABLE urede_cooperativa_contatos (
  id TEXT PRIMARY KEY NOT NULL,
  id_singular TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  subtipo TEXT,
  valor TEXT,
  principal INTEGER DEFAULT 0,
  ativo INTEGER DEFAULT 1,
  -- mantemos label/criado_em (não estavam no pedido original, mas ajudam no app)
  label TEXT,
  criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

INSERT INTO urede_cooperativa_contatos (
  id, id_singular, tipo, subtipo, valor, principal, ativo, label, criado_em
)
SELECT
  id,
  cooperativa_id,
  tipo,
  NULL,
  valor,
  principal,
  ativo,
  label,
  criado_em
FROM urede_cooperativa_contatos_old;

DROP TABLE urede_cooperativa_contatos_old;

CREATE INDEX IF NOT EXISTS idx_coop_contatos_id_singular ON urede_cooperativa_contatos(id_singular);
CREATE INDEX IF NOT EXISTS idx_coop_contatos_tipo2 ON urede_cooperativa_contatos(tipo);
CREATE INDEX IF NOT EXISTS idx_coop_contatos_subtipo ON urede_cooperativa_contatos(subtipo);

-- 0.2) Extras (antigo: cooperativa_id -> novo: id_singular)
ALTER TABLE urede_cooperativa_extras RENAME TO urede_cooperativa_extras_old;
DROP INDEX IF EXISTS idx_coop_extras_chave;

CREATE TABLE urede_cooperativa_extras (
  id_singular TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  chave          TEXT NOT NULL,
  valor          TEXT,
  atualizado_em  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (id_singular, chave)
);

INSERT INTO urede_cooperativa_extras (id_singular, chave, valor, atualizado_em)
SELECT cooperativa_id, chave, valor, atualizado_em
FROM urede_cooperativa_extras_old;

DROP TABLE urede_cooperativa_extras_old;
CREATE INDEX IF NOT EXISTS idx_coop_extras_chave ON urede_cooperativa_extras(chave);

-- 1) Tabelas auxiliares novas

CREATE TABLE IF NOT EXISTS urede_cooperativa_auditores (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  id_singular TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  primeiro_nome TEXT,
  sobrenome TEXT,
  telefone_celular TEXT,
  email TEXT,
  ativo INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_coop_auditores_id_singular ON urede_cooperativa_auditores(id_singular);

CREATE TABLE IF NOT EXISTS urede_cooperativa_conselhos (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  id_singular TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('fiscal','administrativo','tecnico')),
  primeiro_nome TEXT,
  sobrenome TEXT,
  posicao TEXT NOT NULL CHECK (posicao IN ('titular','suplente')),
  ano_inicio_mandato INTEGER,
  ano_fim_mandato INTEGER,
  ativo INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_coop_conselhos_id_singular ON urede_cooperativa_conselhos(id_singular);
CREATE INDEX IF NOT EXISTS idx_coop_conselhos_tipo ON urede_cooperativa_conselhos(tipo);

CREATE TABLE IF NOT EXISTS urede_cooperativa_diretores (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  id_singular TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  cargo TEXT,
  pasta TEXT,
  primeiro_nome TEXT,
  sobrenome TEXT,
  email TEXT,
  telefone_celular TEXT,
  inicio_mandato INTEGER,
  fim_mandato INTEGER,
  ativo INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_coop_diretores_id_singular ON urede_cooperativa_diretores(id_singular);

CREATE TABLE IF NOT EXISTS urede_cooperativa_enderecos (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  id_singular TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('sede','filial','atendimento','correspondencia')),
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
  ativo INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_coop_enderecos_id_singular ON urede_cooperativa_enderecos(id_singular);

CREATE TABLE IF NOT EXISTS urede_cooperativa_lgpd (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  id_singular TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  primeiro_nome TEXT,
  sobrenome TEXT,
  email TEXT,
  telefone TEXT,
  ativo INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_coop_lgpd_id_singular ON urede_cooperativa_lgpd(id_singular);

CREATE TABLE IF NOT EXISTS urede_cooperativa_ouvidores (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  id_singular TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  primeiro_nome TEXT,
  sobrenome TEXT,
  telefone_fixo TEXT,
  telefone_celular TEXT,
  email TEXT,
  ativo INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_coop_ouvidores_id_singular ON urede_cooperativa_ouvidores(id_singular);

CREATE TABLE IF NOT EXISTS urede_cooperativa_plantao (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  id_singular TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  modelo_atendimento TEXT,
  descricao TEXT,
  ativo INTEGER DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_coop_plantao_id_singular ON urede_cooperativa_plantao(id_singular);

INSERT INTO schema_migrations(version) VALUES ('20260210_006_cooperativas_auxiliares');
COMMIT;
