-- Privacidade LGPD para celular de diretores.
ALTER TABLE urede_cooperativa_diretores ADD COLUMN divulgar_celular INTEGER DEFAULT 0;
UPDATE urede_cooperativa_diretores
SET divulgar_celular = COALESCE(divulgar_celular, 0);

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

CREATE INDEX IF NOT EXISTS idx_diretor_phone_requests_coop_status
  ON urede_diretor_phone_access_requests(cooperativa_id, status);
CREATE INDEX IF NOT EXISTS idx_diretor_phone_requests_requester
  ON urede_diretor_phone_access_requests(requester_email, diretor_id);

INSERT OR IGNORE INTO schema_migrations(version)
VALUES ('20260212_010_diretores_privacidade_celular');
