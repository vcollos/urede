-- SQLite schema para as tabelas urede_*
-- Ajustado para casar com os cabeçalhos dos CSVs fornecidos em bases_csv/

PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;

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
  OP_PR         TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS urede_cooperativas_pkey ON urede_cooperativas(id_singular);

-- urede_cidades (ordem das colunas igual ao CSV)
CREATE TABLE IF NOT EXISTS urede_cidades (
  CD_MUNICIPIO_7    TEXT PRIMARY KEY,
  CD_MUNICIPIO      TEXT,
  REGIONAL_SAUDE    TEXT,
  NM_CIDADE         TEXT,
  UF_MUNICIPIO      TEXT,
  NM_REGIAO         TEXT,
  CIDADES_HABITANTES INTEGER,
  ID_SINGULAR       TEXT REFERENCES urede_cooperativas(id_singular)
);

CREATE UNIQUE INDEX IF NOT EXISTS urede_cidades_pkey ON urede_cidades(CD_MUNICIPIO_7);

-- urede_operadores (ordem das colunas igual ao CSV)
CREATE TABLE IF NOT EXISTS urede_operadores (
  id          INTEGER PRIMARY KEY,
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  nome        TEXT,
  id_singular TEXT,
  email       TEXT,
  telefone    TEXT,
  whatsapp    TEXT,
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
  prazo_atual                TEXT NOT NULL
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
  data_cadastro TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- urede_auditoria_logs (auditoria local)
CREATE TABLE IF NOT EXISTS urede_auditoria_logs (
  id TEXT PRIMARY KEY,
  pedido_id TEXT REFERENCES urede_pedidos(id),
  usuario_id TEXT,
  usuario_nome TEXT,
  acao TEXT NOT NULL,
  detalhes TEXT,
  timestamp TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_auditoria_pedido ON urede_auditoria_logs(pedido_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON urede_auditoria_logs(usuario_id);
