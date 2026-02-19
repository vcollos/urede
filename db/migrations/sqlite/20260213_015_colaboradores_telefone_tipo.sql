BEGIN;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

ALTER TABLE urede_cooperativa_colaboradores ADD COLUMN telefone_tipo TEXT;

UPDATE urede_cooperativa_colaboradores
SET telefone_tipo = CASE
  WHEN LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(telefone,''), '(', ''), ')', ''), '-', ''), ' ', ''), '+', '')) >= 11
    THEN 'whatsapp'
  ELSE 'telefone'
END
WHERE telefone_tipo IS NULL OR TRIM(telefone_tipo) = '';

INSERT OR IGNORE INTO schema_migrations(version)
VALUES ('20260213_015_colaboradores_telefone_tipo');

COMMIT;
