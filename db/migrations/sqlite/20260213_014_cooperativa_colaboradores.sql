BEGIN;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS urede_cooperativa_colaboradores (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  id_singular TEXT NOT NULL REFERENCES urede_cooperativas(id_singular) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  sobrenome TEXT,
  email TEXT,
  telefone TEXT,
  departamento TEXT NOT NULL,
  chefia INTEGER DEFAULT 0,
  ativo INTEGER DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_coop_colaboradores_id_singular
  ON urede_cooperativa_colaboradores(id_singular);
CREATE INDEX IF NOT EXISTS idx_coop_colaboradores_email
  ON urede_cooperativa_colaboradores(email);

INSERT OR IGNORE INTO schema_migrations(version)
VALUES ('20260213_014_cooperativa_colaboradores');

COMMIT;
