BEGIN;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

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

CREATE INDEX IF NOT EXISTS idx_coop_regulatorio_id_singular
  ON urede_cooperativa_regulatorio(id_singular);

INSERT OR IGNORE INTO schema_migrations(version)
VALUES ('20260213_013_cooperativa_regulatorio');

COMMIT;
