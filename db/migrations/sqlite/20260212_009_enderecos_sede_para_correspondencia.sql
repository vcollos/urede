-- Ajuste de domínio: tipo de endereço "sede" foi substituído por "correspondencia".
UPDATE urede_cooperativa_enderecos
SET tipo = 'correspondencia'
WHERE lower(tipo) = 'sede';

INSERT OR IGNORE INTO schema_migrations(version)
VALUES ('20260212_009_enderecos_sede_para_correspondencia');
