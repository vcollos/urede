BEGIN TRANSACTION;

UPDATE urede_operadores
SET telefone = COALESCE(NULLIF(telefone, ''), NULLIF(whatsapp, ''), telefone);

UPDATE urede_operadores
SET wpp = 1
WHERE COALESCE(NULLIF(whatsapp, ''), '') <> ''
   OR LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(telefone, ''), ' ', ''), '(', ''), ')', ''), '-', '')) = 11;

UPDATE urede_operadores
SET whatsapp = CASE WHEN COALESCE(wpp, 0) = 1 THEN COALESCE(telefone, whatsapp, '') ELSE '' END;

INSERT OR IGNORE INTO schema_migrations(version)
VALUES ('20260213_016_operadores_telefone_wpp');

COMMIT;
