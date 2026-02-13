-- 20260212_012_plantao_contatos_horarios.sql
-- Expande módulo de urgência/emergência:
-- - 1 plantão por id_singular (índice único)
-- - contatos de plantão (telefone/whatsapp/website)
-- - horários de plantão (globais ou por clínica)

BEGIN;

-- Garantir 1 plantão por singular: se houver duplicidade futura, manteremos o mais recente.
DELETE FROM urede_cooperativa_plantao
WHERE id IN (
  SELECT p.id
  FROM urede_cooperativa_plantao p
  JOIN (
    SELECT id_singular, MAX(criado_em) AS max_criado_em
    FROM urede_cooperativa_plantao
    GROUP BY id_singular
    HAVING COUNT(*) > 1
  ) d
    ON d.id_singular = p.id_singular
  WHERE COALESCE(p.criado_em, '') < COALESCE(d.max_criado_em, '')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_coop_plantao_id_singular_unique
  ON urede_cooperativa_plantao(id_singular);

CREATE TABLE IF NOT EXISTS urede_cooperativa_plantao_contatos (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  id_singular TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('telefone','whatsapp','website')),
  numero_ou_url TEXT NOT NULL,
  principal INTEGER DEFAULT 0,
  descricao TEXT,
  ativo INTEGER DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_coop_plantao_contatos_id_singular
  ON urede_cooperativa_plantao_contatos(id_singular);

CREATE INDEX IF NOT EXISTS idx_coop_plantao_contatos_tipo
  ON urede_cooperativa_plantao_contatos(tipo);

CREATE TABLE IF NOT EXISTS urede_cooperativa_plantao_horarios (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  id_singular TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  plantao_clinica_id TEXT REFERENCES urede_cooperativa_plantao_clinicas(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  observacao TEXT,
  ativo INTEGER DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_coop_plantao_horarios_id_singular
  ON urede_cooperativa_plantao_horarios(id_singular);

CREATE INDEX IF NOT EXISTS idx_coop_plantao_horarios_clinica
  ON urede_cooperativa_plantao_horarios(plantao_clinica_id);

INSERT OR IGNORE INTO schema_migrations(version)
VALUES ('20260212_012_plantao_contatos_horarios');

COMMIT;

