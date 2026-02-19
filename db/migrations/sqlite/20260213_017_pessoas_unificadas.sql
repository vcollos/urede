BEGIN;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS urede_pessoas (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  chave_unificacao TEXT UNIQUE,
  primeiro_nome TEXT NOT NULL,
  sobrenome TEXT,
  email TEXT,
  telefone TEXT,
  wpp INTEGER NOT NULL DEFAULT 0 CHECK (wpp IN (0, 1)),
  departamento TEXT,
  cargo_funcao TEXT,
  categoria_principal TEXT,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_urede_pessoas_email
  ON urede_pessoas(email);
CREATE INDEX IF NOT EXISTS idx_urede_pessoas_telefone
  ON urede_pessoas(telefone);
CREATE INDEX IF NOT EXISTS idx_urede_pessoas_categoria
  ON urede_pessoas(categoria_principal);

CREATE TABLE IF NOT EXISTS urede_pessoa_vinculos (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  pessoa_id TEXT NOT NULL REFERENCES urede_pessoas(id) ON DELETE CASCADE,
  id_singular TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  subcategoria TEXT,
  cargo_funcao TEXT,
  departamento TEXT,
  pasta TEXT,
  inicio_mandato INTEGER,
  fim_mandato INTEGER,
  principal INTEGER NOT NULL DEFAULT 0 CHECK (principal IN (0, 1)),
  visivel INTEGER NOT NULL DEFAULT 1 CHECK (visivel IN (0, 1)),
  chefia INTEGER NOT NULL DEFAULT 0 CHECK (chefia IN (0, 1)),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  atributos TEXT NOT NULL DEFAULT '{}',
  origem_tabela TEXT,
  origem_id TEXT,
  criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  atualizado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  CONSTRAINT chk_pessoa_vinculos_id_singular_3dig
    CHECK (id_singular GLOB '[0-9][0-9][0-9]')
);

CREATE INDEX IF NOT EXISTS idx_urede_pessoa_vinculos_singular_categoria
  ON urede_pessoa_vinculos(id_singular, categoria, ativo);
CREATE INDEX IF NOT EXISTS idx_urede_pessoa_vinculos_pessoa
  ON urede_pessoa_vinculos(pessoa_id, ativo);
CREATE UNIQUE INDEX IF NOT EXISTS ux_urede_pessoa_vinculos_origem
  ON urede_pessoa_vinculos(origem_tabela, origem_id)
  WHERE origem_tabela IS NOT NULL AND origem_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_urede_presidente_ativo_por_singular
  ON urede_pessoa_vinculos(id_singular)
  WHERE categoria = 'diretoria'
    AND upper(trim(coalesce(cargo_funcao, ''))) = 'PRESIDENTE'
    AND ativo = 1;

CREATE TABLE IF NOT EXISTS urede_pessoa_usuarios (
  user_email TEXT PRIMARY KEY NOT NULL,
  pessoa_id TEXT NOT NULL REFERENCES urede_pessoas(id) ON DELETE CASCADE,
  origem TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_urede_pessoa_usuarios_pessoa
  ON urede_pessoa_usuarios(pessoa_id);

DROP TABLE IF EXISTS _stg_pessoas_unificadas;
CREATE TEMP TABLE _stg_pessoas_unificadas (
  origem_tabela TEXT NOT NULL,
  origem_id TEXT NOT NULL,
  id_singular TEXT NOT NULL,
  categoria TEXT NOT NULL,
  subcategoria TEXT,
  primeiro_nome TEXT NOT NULL,
  sobrenome TEXT,
  email TEXT,
  telefone TEXT,
  wpp INTEGER NOT NULL DEFAULT 0,
  departamento TEXT,
  cargo_funcao TEXT,
  pasta TEXT,
  inicio_mandato INTEGER,
  fim_mandato INTEGER,
  principal INTEGER NOT NULL DEFAULT 0,
  visivel INTEGER NOT NULL DEFAULT 1,
  chefia INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  atributos TEXT NOT NULL DEFAULT '{}'
);

-- Diretores
INSERT INTO _stg_pessoas_unificadas (
  origem_tabela, origem_id, id_singular, categoria, subcategoria,
  primeiro_nome, sobrenome, email, telefone, wpp,
  departamento, cargo_funcao, pasta, inicio_mandato, fim_mandato,
  principal, visivel, chefia, ativo, atributos
)
SELECT
  'urede_cooperativa_diretores',
  d.id,
  d.id_singular,
  'diretoria',
  NULL,
  trim(coalesce(d.primeiro_nome, '')),
  nullif(trim(coalesce(d.sobrenome, '')), ''),
  CASE
    WHEN instr(trim(lower(coalesce(d.email, ''))), '@') > 0 THEN trim(lower(d.email))
    ELSE NULL
  END,
  CASE
    WHEN p = '' OR p GLOB '*[^0-9]*' THEN NULL
    ELSE p
  END,
  CASE
    WHEN coalesce(d.wpp, 0) = 1 THEN 1
    WHEN p <> '' AND p NOT GLOB '*[^0-9]*' AND length(p) = 11 AND substr(p, 3, 1) = '9' THEN 1
    ELSE 0
  END,
  NULL,
  nullif(trim(coalesce(d.cargo, '')), ''),
  nullif(trim(coalesce(d.pasta, '')), ''),
  d.inicio_mandato,
  d.fim_mandato,
  CASE WHEN upper(trim(coalesce(d.cargo, ''))) = 'PRESIDENTE' THEN 1 ELSE 0 END,
  CASE WHEN d.divulgar_celular IN (0, 1) THEN d.divulgar_celular ELSE 1 END,
  0,
  CASE WHEN lower(trim(coalesce(CAST(d.ativo AS TEXT), ''))) IN ('1', 'true', 'sim', 's', 'ativo', 'yes', 'y') THEN 1 ELSE 0 END,
  '{}'
FROM (
  SELECT
    *,
    trim(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(coalesce(telefone, telefone_celular, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', ''), '/', ''), '+', ''), ',', ''), ';', ''), ':', '')) AS p
  FROM urede_cooperativa_diretores
) d
WHERE trim(coalesce(d.primeiro_nome, '')) <> '';

-- Regulatório
INSERT INTO _stg_pessoas_unificadas (
  origem_tabela, origem_id, id_singular, categoria, subcategoria,
  primeiro_nome, sobrenome, email, telefone, wpp,
  departamento, cargo_funcao, pasta, inicio_mandato, fim_mandato,
  principal, visivel, chefia, ativo, atributos
)
SELECT
  'urede_cooperativa_regulatorio',
  r.id,
  r.id_singular,
  'regulatorio',
  nullif(trim(coalesce(r.tipo_unidade, '')), ''),
  CASE
    WHEN instr(trim(coalesce(r.responsavel_tecnico, '')), ' ') > 0
      THEN substr(trim(r.responsavel_tecnico), 1, instr(trim(r.responsavel_tecnico), ' ') - 1)
    ELSE trim(coalesce(r.responsavel_tecnico, ''))
  END,
  CASE
    WHEN instr(trim(coalesce(r.responsavel_tecnico, '')), ' ') > 0
      THEN nullif(trim(substr(trim(r.responsavel_tecnico), instr(trim(r.responsavel_tecnico), ' ') + 1)), '')
    ELSE NULL
  END,
  CASE
    WHEN instr(trim(lower(coalesce(r.email_responsavel_tecnico, ''))), '@') > 0 THEN trim(lower(r.email_responsavel_tecnico))
    ELSE NULL
  END,
  NULL,
  0,
  nullif(trim(coalesce(r.nome_unidade, '')), ''),
  'Responsável técnico',
  NULL,
  NULL,
  NULL,
  0,
  1,
  0,
  CASE WHEN lower(trim(coalesce(CAST(r.ativo AS TEXT), ''))) IN ('1', 'true', 'sim', 's', 'ativo', 'yes', 'y') THEN 1 ELSE 0 END,
  json_object(
    'reg_ans', nullif(trim(coalesce(r.reg_ans, '')), ''),
    'cro_responsavel_tecnico', nullif(trim(coalesce(r.cro_responsavel_tecnico, '')), ''),
    'cro_unidade', nullif(trim(coalesce(r.cro_unidade, '')), '')
  )
FROM urede_cooperativa_regulatorio r
WHERE trim(coalesce(r.responsavel_tecnico, '')) <> '';

-- Conselhos
INSERT INTO _stg_pessoas_unificadas (
  origem_tabela, origem_id, id_singular, categoria, subcategoria,
  primeiro_nome, sobrenome, email, telefone, wpp,
  departamento, cargo_funcao, pasta, inicio_mandato, fim_mandato,
  principal, visivel, chefia, ativo, atributos
)
SELECT
  'urede_cooperativa_conselhos',
  c.id,
  c.id_singular,
  'conselho',
  nullif(trim(coalesce(c.tipo, '')), ''),
  trim(coalesce(c.primeiro_nome, '')),
  nullif(trim(coalesce(c.sobrenome, '')), ''),
  NULL,
  NULL,
  0,
  NULL,
  nullif(trim(coalesce(c.posicao, '')), ''),
  NULL,
  c.ano_inicio_mandato,
  c.ano_fim_mandato,
  0,
  1,
  0,
  CASE WHEN lower(trim(coalesce(CAST(c.ativo AS TEXT), ''))) IN ('1', 'true', 'sim', 's', 'ativo', 'yes', 'y') THEN 1 ELSE 0 END,
  '{}'
FROM urede_cooperativa_conselhos c
WHERE trim(coalesce(c.primeiro_nome, '')) <> '';

-- Colaboradores
INSERT INTO _stg_pessoas_unificadas (
  origem_tabela, origem_id, id_singular, categoria, subcategoria,
  primeiro_nome, sobrenome, email, telefone, wpp,
  departamento, cargo_funcao, pasta, inicio_mandato, fim_mandato,
  principal, visivel, chefia, ativo, atributos
)
SELECT
  'urede_cooperativa_colaboradores',
  c.id,
  c.id_singular,
  'colaborador',
  NULL,
  trim(coalesce(c.nome, '')),
  nullif(trim(coalesce(c.sobrenome, '')), ''),
  CASE
    WHEN instr(trim(lower(coalesce(c.email, ''))), '@') > 0 THEN trim(lower(c.email))
    ELSE NULL
  END,
  CASE
    WHEN p = '' OR p GLOB '*[^0-9]*' THEN NULL
    ELSE p
  END,
  CASE
    WHEN coalesce(c.wpp, 0) = 1 THEN 1
    WHEN p <> '' AND p NOT GLOB '*[^0-9]*' AND length(p) = 11 AND substr(p, 3, 1) = '9' THEN 1
    ELSE 0
  END,
  nullif(trim(coalesce(c.departamento, '')), ''),
  NULL,
  NULL,
  NULL,
  NULL,
  0,
  1,
  CASE WHEN coalesce(c.chefia, 0) IN (0, 1) THEN c.chefia ELSE 0 END,
  CASE WHEN lower(trim(coalesce(CAST(c.ativo AS TEXT), ''))) IN ('1', 'true', 'sim', 's', 'ativo', 'yes', 'y') THEN 1 ELSE 0 END,
  '{}'
FROM (
  SELECT
    *,
    trim(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(coalesce(telefone, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', ''), '/', ''), '+', ''), ',', ''), ';', ''), ':', '')) AS p
  FROM urede_cooperativa_colaboradores
) c
WHERE trim(coalesce(c.nome, '')) <> '';

-- Ouvidoria
INSERT INTO _stg_pessoas_unificadas (
  origem_tabela, origem_id, id_singular, categoria, subcategoria,
  primeiro_nome, sobrenome, email, telefone, wpp,
  departamento, cargo_funcao, pasta, inicio_mandato, fim_mandato,
  principal, visivel, chefia, ativo, atributos
)
SELECT
  'urede_cooperativa_ouvidores',
  o.id,
  o.id_singular,
  'ouvidoria',
  NULL,
  trim(coalesce(o.primeiro_nome, '')),
  nullif(trim(coalesce(o.sobrenome, '')), ''),
  CASE
    WHEN instr(trim(lower(coalesce(o.email, ''))), '@') > 0 THEN trim(lower(o.email))
    ELSE NULL
  END,
  CASE
    WHEN p = '' OR p GLOB '*[^0-9]*' THEN NULL
    ELSE p
  END,
  CASE
    WHEN coalesce(o.wpp, 0) = 1 THEN 1
    WHEN p <> '' AND p NOT GLOB '*[^0-9]*' AND length(p) = 11 AND substr(p, 3, 1) = '9' THEN 1
    ELSE 0
  END,
  NULL,
  'Ouvidor',
  NULL,
  NULL,
  NULL,
  0,
  1,
  0,
  CASE WHEN lower(trim(coalesce(CAST(o.ativo AS TEXT), ''))) IN ('1', 'true', 'sim', 's', 'ativo', 'yes', 'y') THEN 1 ELSE 0 END,
  '{}'
FROM (
  SELECT
    *,
    trim(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(coalesce(telefone, telefone_celular, telefone_fixo, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', ''), '/', ''), '+', ''), ',', ''), ';', ''), ':', '')) AS p
  FROM urede_cooperativa_ouvidores
) o
WHERE trim(coalesce(o.primeiro_nome, '')) <> '';

-- LGPD
INSERT INTO _stg_pessoas_unificadas (
  origem_tabela, origem_id, id_singular, categoria, subcategoria,
  primeiro_nome, sobrenome, email, telefone, wpp,
  departamento, cargo_funcao, pasta, inicio_mandato, fim_mandato,
  principal, visivel, chefia, ativo, atributos
)
SELECT
  'urede_cooperativa_lgpd',
  l.id,
  l.id_singular,
  'lgpd',
  NULL,
  trim(coalesce(l.primeiro_nome, '')),
  nullif(trim(coalesce(l.sobrenome, '')), ''),
  CASE
    WHEN instr(trim(lower(coalesce(l.email, ''))), '@') > 0 THEN trim(lower(l.email))
    ELSE NULL
  END,
  CASE
    WHEN p = '' OR p GLOB '*[^0-9]*' THEN NULL
    ELSE p
  END,
  CASE
    WHEN coalesce(l.wpp, 0) = 1 THEN 1
    WHEN p <> '' AND p NOT GLOB '*[^0-9]*' AND length(p) = 11 AND substr(p, 3, 1) = '9' THEN 1
    ELSE 0
  END,
  NULL,
  'Responsável LGPD',
  NULL,
  NULL,
  NULL,
  0,
  1,
  0,
  CASE WHEN lower(trim(coalesce(CAST(l.ativo AS TEXT), ''))) IN ('1', 'true', 'sim', 's', 'ativo', 'yes', 'y') THEN 1 ELSE 0 END,
  '{}'
FROM (
  SELECT
    *,
    trim(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(coalesce(telefone, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', ''), '/', ''), '+', ''), ',', ''), ';', ''), ':', '')) AS p
  FROM urede_cooperativa_lgpd
) l
WHERE trim(coalesce(l.primeiro_nome, '')) <> '';

-- Auditores
INSERT INTO _stg_pessoas_unificadas (
  origem_tabela, origem_id, id_singular, categoria, subcategoria,
  primeiro_nome, sobrenome, email, telefone, wpp,
  departamento, cargo_funcao, pasta, inicio_mandato, fim_mandato,
  principal, visivel, chefia, ativo, atributos
)
SELECT
  'urede_cooperativa_auditores',
  a.id,
  a.id_singular,
  'auditoria',
  NULL,
  trim(coalesce(a.primeiro_nome, '')),
  nullif(trim(coalesce(a.sobrenome, '')), ''),
  CASE
    WHEN instr(trim(lower(coalesce(a.email, ''))), '@') > 0 THEN trim(lower(a.email))
    ELSE NULL
  END,
  CASE
    WHEN p = '' OR p GLOB '*[^0-9]*' THEN NULL
    ELSE p
  END,
  CASE
    WHEN coalesce(a.wpp, 0) = 1 THEN 1
    WHEN p <> '' AND p NOT GLOB '*[^0-9]*' AND length(p) = 11 AND substr(p, 3, 1) = '9' THEN 1
    ELSE 0
  END,
  NULL,
  'Auditor',
  NULL,
  NULL,
  NULL,
  0,
  1,
  0,
  CASE WHEN lower(trim(coalesce(CAST(a.ativo AS TEXT), ''))) IN ('1', 'true', 'sim', 's', 'ativo', 'yes', 'y') THEN 1 ELSE 0 END,
  '{}'
FROM (
  SELECT
    *,
    trim(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(coalesce(telefone, telefone_celular, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', ''), '/', ''), '+', ''), ',', ''), ';', ''), ':', '')) AS p
  FROM urede_cooperativa_auditores
) a
WHERE trim(coalesce(a.primeiro_nome, '')) <> '';

DROP TABLE IF EXISTS _stg_pessoas_unificadas_keyed;
CREATE TEMP TABLE _stg_pessoas_unificadas_keyed AS
SELECT
  s.*,
  CASE
    WHEN s.email IS NOT NULL AND trim(s.email) <> '' THEN 'e:' || lower(trim(s.email))
    WHEN s.telefone IS NOT NULL AND trim(s.telefone) <> '' THEN 't:' || trim(s.telefone)
    ELSE 'n:' || lower(trim(coalesce(s.primeiro_nome, '') || ' ' || coalesce(s.sobrenome, ''))) || '|s:' || s.id_singular
  END AS chave_unificacao
FROM _stg_pessoas_unificadas s
WHERE trim(coalesce(s.primeiro_nome, '')) <> '';

INSERT OR IGNORE INTO urede_pessoas (
  chave_unificacao,
  primeiro_nome,
  sobrenome,
  email,
  telefone,
  wpp,
  departamento,
  cargo_funcao,
  categoria_principal,
  ativo
)
WITH ranked AS (
  SELECT
    s.*,
    row_number() OVER (
      PARTITION BY s.chave_unificacao
      ORDER BY
        CASE WHEN s.email IS NOT NULL AND trim(s.email) <> '' THEN 1 ELSE 0 END DESC,
        CASE WHEN s.telefone IS NOT NULL AND trim(s.telefone) <> '' THEN 1 ELSE 0 END DESC,
        CASE WHEN s.departamento IS NOT NULL AND trim(s.departamento) <> '' THEN 1 ELSE 0 END DESC,
        CASE WHEN s.cargo_funcao IS NOT NULL AND trim(s.cargo_funcao) <> '' THEN 1 ELSE 0 END DESC,
        CASE WHEN s.sobrenome IS NOT NULL AND trim(s.sobrenome) <> '' THEN 1 ELSE 0 END DESC,
        s.origem_tabela
    ) AS rn
  FROM _stg_pessoas_unificadas_keyed s
)
SELECT
  r.chave_unificacao,
  r.primeiro_nome,
  r.sobrenome,
  r.email,
  r.telefone,
  r.wpp,
  r.departamento,
  r.cargo_funcao,
  r.categoria,
  r.ativo
FROM ranked r
WHERE r.rn = 1;

INSERT OR IGNORE INTO urede_pessoa_vinculos (
  pessoa_id, id_singular, categoria, subcategoria, cargo_funcao, departamento,
  pasta, inicio_mandato, fim_mandato, principal, visivel, chefia, ativo,
  atributos, origem_tabela, origem_id
)
SELECT
  p.id,
  s.id_singular,
  s.categoria,
  s.subcategoria,
  s.cargo_funcao,
  s.departamento,
  s.pasta,
  s.inicio_mandato,
  s.fim_mandato,
  s.principal,
  s.visivel,
  s.chefia,
  s.ativo,
  s.atributos,
  s.origem_tabela,
  s.origem_id
FROM _stg_pessoas_unificadas_keyed s
JOIN urede_pessoas p
  ON p.chave_unificacao = s.chave_unificacao;

INSERT OR IGNORE INTO urede_pessoa_usuarios (user_email, pessoa_id, origem)
SELECT
  lower(trim(a.email)) AS user_email,
  p.id,
  'auth_users'
FROM auth_users a
JOIN urede_pessoas p
  ON lower(trim(coalesce(p.email, ''))) = lower(trim(coalesce(a.email, '')))
WHERE trim(coalesce(a.email, '')) <> '';

INSERT OR IGNORE INTO urede_pessoa_usuarios (user_email, pessoa_id, origem)
SELECT
  lower(trim(o.email)) AS user_email,
  p.id,
  'urede_operadores'
FROM urede_operadores o
JOIN urede_pessoas p
  ON lower(trim(coalesce(p.email, ''))) = lower(trim(coalesce(o.email, '')))
WHERE trim(coalesce(o.email, '')) <> '';

INSERT OR IGNORE INTO schema_migrations(version)
VALUES ('20260213_017_pessoas_unificadas');

COMMIT;
