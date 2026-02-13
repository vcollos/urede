-- SQLite schema para as tabelas urede_*
-- Ajustado para casar com os cabeçalhos dos CSVs fornecidos em bases_csv/

-- Importante: o driver SQLite usado no backend (deno.land/x/sqlite) pode falhar com bancos em WAL.
-- Mantemos DELETE para máxima compatibilidade.
PRAGMA journal_mode=DELETE;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;

-- Controle de versões de schema (migrações)
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- urede_cooperativas (ordem das colunas igual ao CSV)
CREATE TABLE IF NOT EXISTS urede_cooperativas (
  id_singular   TEXT PRIMARY KEY,
  UNIODONTO     TEXT,
  CNPJ          TEXT,
  CRO_OPERAORA  TEXT,
  DATA_FUNDACAO TEXT,  -- ISO 8601 (YYYY-MM-DD)
  RAZ_SOCIAL    TEXT,
  CODIGO_ANS    TEXT,
  FEDERACAO     TEXT,
  SOFTWARE      TEXT,
  TIPO          TEXT,
  OP_PR         TEXT,

  -- Colunas novas (não vêm do CSV; usadas para ligações e dados adicionais)
  federacao_id    TEXT,                        -- FK lógica -> urede_cooperativas.id_singular (TIPO=FEDERACAO)
  confederacao_id TEXT,                        -- FK lógica -> urede_cooperativas.id_singular (TIPO=CONFEDERACAO)
  operadora_id    TEXT,                        -- FK lógica -> urede_cooperativas.id_singular (OP_PR='Operadora')
  ativo           INTEGER NOT NULL DEFAULT 1,
  resp_tecnico    TEXT,
  cro_resp_tecnico TEXT,
  cro_operadora   TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS urede_cooperativas_pkey ON urede_cooperativas(id_singular);
CREATE INDEX IF NOT EXISTS idx_urede_cooperativas_codigo_ans      ON urede_cooperativas(CODIGO_ANS);
CREATE INDEX IF NOT EXISTS idx_urede_cooperativas_federacao_id    ON urede_cooperativas(federacao_id);
CREATE INDEX IF NOT EXISTS idx_urede_cooperativas_confederacao_id ON urede_cooperativas(confederacao_id);
CREATE INDEX IF NOT EXISTS idx_urede_cooperativas_operadora_id    ON urede_cooperativas(operadora_id);

-- View canônica para consultas novas (mantém compatibilidade do esquema legado do CSV)
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

-- Subtabelas auxiliares (regra: sempre relacionar por id_singular)
CREATE TABLE IF NOT EXISTS urede_cooperativa_contatos (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  id_singular TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  tipo TEXT NOT NULL,        -- email|telefone|whatsapp|etc
  subtipo TEXT,              -- lgpd|plantao|geral|emergencia|etc
  valor TEXT,
  principal INTEGER DEFAULT 0,
  ativo INTEGER DEFAULT 1,
  label TEXT,
  criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_coop_contatos_id_singular ON urede_cooperativa_contatos(id_singular);
CREATE INDEX IF NOT EXISTS idx_coop_contatos_tipo2 ON urede_cooperativa_contatos(tipo);
CREATE INDEX IF NOT EXISTS idx_coop_contatos_subtipo ON urede_cooperativa_contatos(subtipo);

CREATE TABLE IF NOT EXISTS urede_cooperativa_extras (
  id_singular TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  chave          TEXT NOT NULL,
  valor          TEXT,
  atualizado_em  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (id_singular, chave)
);
CREATE INDEX IF NOT EXISTS idx_coop_extras_chave ON urede_cooperativa_extras(chave);

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

CREATE TABLE IF NOT EXISTS urede_cooperativa_colaboradores (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  id_singular TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  sobrenome TEXT,
  email TEXT,
  telefone TEXT,
  telefone_tipo TEXT NOT NULL DEFAULT 'telefone' CHECK (telefone_tipo IN ('telefone','whatsapp')),
  departamento TEXT NOT NULL,
  chefia INTEGER DEFAULT 0,
  ativo INTEGER DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_coop_colaboradores_id_singular ON urede_cooperativa_colaboradores(id_singular);
CREATE INDEX IF NOT EXISTS idx_coop_colaboradores_email ON urede_cooperativa_colaboradores(email);

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
  divulgar_celular INTEGER DEFAULT 0,
  inicio_mandato INTEGER,
  fim_mandato INTEGER,
  ativo INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_coop_diretores_id_singular ON urede_cooperativa_diretores(id_singular);

CREATE TABLE IF NOT EXISTS urede_diretor_phone_access_requests (
  id TEXT PRIMARY KEY NOT NULL,
  cooperativa_id TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  diretor_id TEXT NOT NULL REFERENCES urede_cooperativa_diretores(id) ON DELETE CASCADE,
  requester_email TEXT NOT NULL,
  requester_nome TEXT,
  requester_cooperativa_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  motivo TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  decided_at TEXT,
  decided_by TEXT,
  decision_notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_diretor_phone_requests_coop_status ON urede_diretor_phone_access_requests(cooperativa_id, status);
CREATE INDEX IF NOT EXISTS idx_diretor_phone_requests_requester ON urede_diretor_phone_access_requests(requester_email, diretor_id);

CREATE TABLE IF NOT EXISTS urede_cooperativa_enderecos (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  id_singular TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('sede','filial','atendimento','correspondencia')),
  nome_local TEXT,
  cd_municipio_7 TEXT,
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
CREATE INDEX IF NOT EXISTS idx_coop_enderecos_cd_municipio_7 ON urede_cooperativa_enderecos(cd_municipio_7);

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

CREATE TABLE IF NOT EXISTS urede_cooperativa_regulatorio (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  id_singular TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  tipo_unidade TEXT NOT NULL CHECK (tipo_unidade IN ('matriz','filial')),
  nome_unidade TEXT,
  reg_ans TEXT,
  responsavel_tecnico TEXT NOT NULL,
  email_responsavel_tecnico TEXT NOT NULL,
  cro_responsavel_tecnico TEXT NOT NULL,
  cro_unidade TEXT NOT NULL,
  ativo INTEGER DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_coop_regulatorio_id_singular ON urede_cooperativa_regulatorio(id_singular);

-- urede_cidades (ordem das colunas igual ao CSV)
CREATE TABLE IF NOT EXISTS urede_cidades (
  CD_MUNICIPIO_7    TEXT PRIMARY KEY,
  CD_MUNICIPIO      TEXT,
  REGIONAL_SAUDE    TEXT,
  NM_CIDADE         TEXT,
  UF_MUNICIPIO      TEXT,
  NM_REGIAO         TEXT,
  CIDADES_HABITANTES INTEGER,
  ID_SINGULAR       TEXT REFERENCES urede_cooperativas(id_singular),

  -- Responsabilidades (permite cooperativas diferentes por cidade)
  id_singular_credenciamento TEXT,
  id_singular_vendas         TEXT,
  reg_ans                    TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS urede_cidades_pkey ON urede_cidades(CD_MUNICIPIO_7);
CREATE INDEX IF NOT EXISTS idx_urede_cidades_reg_ans            ON urede_cidades(reg_ans);
CREATE INDEX IF NOT EXISTS idx_urede_cidades_id_singular_cred   ON urede_cidades(id_singular_credenciamento);
CREATE INDEX IF NOT EXISTS idx_urede_cidades_id_singular_vendas ON urede_cidades(id_singular_vendas);

CREATE VIEW IF NOT EXISTS urede_cidades_cadastro AS
SELECT
  CD_MUNICIPIO_7   AS cd_municipio_7,
  REGIONAL_SAUDE   AS regional_saude,
  NM_CIDADE        AS nm_cidade,
  UF_MUNICIPIO     AS uf_municipio,
  NM_REGIAO        AS nm_regiao,
  CIDADES_HABITANTES AS cidades_habitantes,
  COALESCE(NULLIF(TRIM(id_singular_credenciamento), ''), NULLIF(TRIM(ID_SINGULAR), '')) AS id_singular_credenciamento,
  NULLIF(TRIM(id_singular_vendas), '') AS id_singular_vendas,
  NULLIF(TRIM(reg_ans), '') AS reg_ans
FROM urede_cidades;

-- urede_operadores (ordem das colunas igual ao CSV)
CREATE TABLE IF NOT EXISTS urede_operadores (
  id          INTEGER PRIMARY KEY,
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  nome        TEXT,
  id_singular TEXT,
  email       TEXT,
  telefone    TEXT,
  whatsapp    TEXT,
  wpp         INTEGER DEFAULT 0,
  cargo       TEXT,
  status      INTEGER CHECK (status IN (0,1))
);

CREATE UNIQUE INDEX IF NOT EXISTS urede_operadores_pkey ON urede_operadores(id);

-- urede_pedidos (sem CSV; criado para uso do app)
CREATE TABLE IF NOT EXISTS urede_pedidos (
  id                         TEXT PRIMARY KEY,
  titulo                     TEXT NOT NULL,
  criado_por                 INTEGER REFERENCES urede_operadores(id),
  cooperativa_solicitante_id TEXT REFERENCES urede_cooperativas(id_singular),
  cooperativa_responsavel_id TEXT REFERENCES urede_cooperativas(id_singular),
  cidade_id                  TEXT NOT NULL REFERENCES urede_cidades(CD_MUNICIPIO_7),
  especialidades             TEXT NOT NULL DEFAULT '[]',
  quantidade                 INTEGER NOT NULL DEFAULT 1,
  observacoes                TEXT,
  prioridade                 TEXT NOT NULL DEFAULT 'media',
  nivel_atual                TEXT NOT NULL DEFAULT 'singular',
  status                     TEXT NOT NULL DEFAULT 'novo',
  data_criacao               TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  data_ultima_alteracao      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  prazo_atual                TEXT NOT NULL,
  data_conclusao             TEXT,
  motivo_categoria           TEXT,
  beneficiarios_quantidade   INTEGER,
  responsavel_atual_id       TEXT,
  responsavel_atual_nome     TEXT,
  criado_por_user            TEXT,
  excluido                   BOOLEAN DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pedidos_cidade            ON urede_pedidos(cidade_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_coop_resp         ON urede_pedidos(cooperativa_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_coop_solic        ON urede_pedidos(cooperativa_solicitante_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_nivel             ON urede_pedidos(nivel_atual);
CREATE INDEX IF NOT EXISTS idx_pedidos_prazo             ON urede_pedidos(prazo_atual);
CREATE UNIQUE INDEX IF NOT EXISTS urede_pedidos_pkey     ON urede_pedidos(id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status            ON urede_pedidos(status);

-- auth_users (para JWT local)
CREATE TABLE IF NOT EXISTS auth_users (
  email TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  nome TEXT,
  display_name TEXT,
  telefone TEXT,
  whatsapp TEXT,
  cargo TEXT,
  cooperativa_id TEXT,
  papel TEXT DEFAULT 'operador',
  ativo INTEGER DEFAULT 1,
  data_cadastro TEXT DEFAULT (CURRENT_TIMESTAMP),
  must_change_password INTEGER DEFAULT 0
);

-- Logs de cobertura de cidades por cooperativa
CREATE TABLE IF NOT EXISTS urede_cobertura_logs (
  id TEXT PRIMARY KEY,
  cidade_id TEXT NOT NULL,
  cooperativa_origem TEXT,
  cooperativa_destino TEXT,
  usuario_email TEXT,
  usuario_nome TEXT,
  usuario_papel TEXT,
  detalhes TEXT,
  timestamp TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_cobertura_logs_cidade ON urede_cobertura_logs(cidade_id);
CREATE INDEX IF NOT EXISTS idx_cobertura_logs_origem ON urede_cobertura_logs(cooperativa_origem);
CREATE INDEX IF NOT EXISTS idx_cobertura_logs_destino ON urede_cobertura_logs(cooperativa_destino);

-- urede_auditoria_logs (auditoria local)
CREATE TABLE IF NOT EXISTS urede_auditoria_logs (
  id TEXT PRIMARY KEY,
  pedido_id TEXT REFERENCES urede_pedidos(id),
  usuario_id TEXT,
  usuario_nome TEXT,
  usuario_display_nome TEXT,
  acao TEXT NOT NULL,
  detalhes TEXT,
  timestamp TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_auditoria_pedido ON urede_auditoria_logs(pedido_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON urede_auditoria_logs(usuario_id);

-- urede_alertas (notificações por usuário)
CREATE TABLE IF NOT EXISTS urede_alertas (
  id TEXT PRIMARY KEY,
  pedido_id TEXT NOT NULL,
  pedido_titulo TEXT,
  destinatario_email TEXT NOT NULL,
  destinatario_nome TEXT,
  destinatario_cooperativa_id TEXT,
  tipo TEXT NOT NULL,
  mensagem TEXT,
  detalhes TEXT,
  lido INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  disparado_por_email TEXT,
  disparado_por_nome TEXT
);

CREATE INDEX IF NOT EXISTS idx_urede_alertas_destinatario ON urede_alertas(destinatario_email);
CREATE INDEX IF NOT EXISTS idx_urede_alertas_pedido ON urede_alertas(pedido_id);
CREATE INDEX IF NOT EXISTS idx_urede_alertas_lido ON urede_alertas(lido);

-- Preferências específicas por cooperativa
CREATE TABLE IF NOT EXISTS urede_cooperativa_settings (
  cooperativa_id TEXT PRIMARY KEY,
  auto_recusar INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Configurações gerais do sistema
CREATE TABLE IF NOT EXISTS urede_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Marca baseline de migração aplicado no schema novo
INSERT OR IGNORE INTO schema_migrations(version) VALUES ('20260210_001_cooperativas_vinculos');
INSERT OR IGNORE INTO schema_migrations(version) VALUES ('20260210_002_cidades_normalizar_id_singular');
INSERT OR IGNORE INTO schema_migrations(version) VALUES ('20260210_003_cidades_remover_fk_inexistentes');
INSERT OR IGNORE INTO schema_migrations(version) VALUES ('20260210_004_cidades_dupla_responsabilidade');
INSERT OR IGNORE INTO schema_migrations(version) VALUES ('20260210_005_cidades_sincronizar_responsaveis');
INSERT OR IGNORE INTO schema_migrations(version) VALUES ('20260210_006_cooperativas_auxiliares');
INSERT OR IGNORE INTO schema_migrations(version) VALUES ('20260211_007_enderecos_cd_municipio_7');
INSERT OR IGNORE INTO schema_migrations(version) VALUES ('20260211_008_normalizar_dados_importados');
INSERT OR IGNORE INTO schema_migrations(version) VALUES ('20260212_009_enderecos_sede_para_correspondencia');
INSERT OR IGNORE INTO schema_migrations(version) VALUES ('20260212_010_diretores_privacidade_celular');
