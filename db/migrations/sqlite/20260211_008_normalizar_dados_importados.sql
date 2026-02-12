-- Migração SQLite: normalizar dados já importados (máscaras/códigos/enums)
-- Versão: 20260211_008_normalizar_dados_importados
-- Objetivo:
-- - Padronizar campos numéricos de código para apenas dígitos.
-- - Normalizar tipo/subtipo de contatos para os valores canônicos internos.
-- - Sincronizar cidade/UF dos endereços a partir do IBGE (cd_municipio_7), quando houver.

BEGIN;

-- Helper inline (sem função): remove caracteres comuns de máscara.
-- Mantemos em SQL puro para rodar direto no sqlite3.

-- cooperativas
UPDATE urede_cooperativas
SET CNPJ = NULLIF(
  replace(replace(replace(replace(replace(replace(replace(replace(trim(CNPJ), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''),
  ''
)
WHERE CNPJ IS NOT NULL AND trim(CNPJ) <> '';

UPDATE urede_cooperativas
SET CODIGO_ANS = NULLIF(
  replace(replace(replace(replace(replace(replace(replace(replace(trim(CODIGO_ANS), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''),
  ''
)
WHERE CODIGO_ANS IS NOT NULL AND trim(CODIGO_ANS) <> '';

-- telefones em auxiliares
UPDATE urede_cooperativa_auditores
SET telefone_celular = NULLIF(
  replace(replace(replace(replace(replace(replace(replace(replace(trim(telefone_celular), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''),
  ''
)
WHERE telefone_celular IS NOT NULL AND trim(telefone_celular) <> '';

UPDATE urede_cooperativa_diretores
SET telefone_celular = NULLIF(
  replace(replace(replace(replace(replace(replace(replace(replace(trim(telefone_celular), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''),
  ''
)
WHERE telefone_celular IS NOT NULL AND trim(telefone_celular) <> '';

UPDATE urede_cooperativa_enderecos
SET telefone_fixo = NULLIF(
  replace(replace(replace(replace(replace(replace(replace(replace(trim(telefone_fixo), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''),
  ''
)
WHERE telefone_fixo IS NOT NULL AND trim(telefone_fixo) <> '';

UPDATE urede_cooperativa_enderecos
SET telefone_celular = NULLIF(
  replace(replace(replace(replace(replace(replace(replace(replace(trim(telefone_celular), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''),
  ''
)
WHERE telefone_celular IS NOT NULL AND trim(telefone_celular) <> '';

UPDATE urede_cooperativa_lgpd
SET telefone = NULLIF(
  replace(replace(replace(replace(replace(replace(replace(replace(trim(telefone), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''),
  ''
)
WHERE telefone IS NOT NULL AND trim(telefone) <> '';

UPDATE urede_cooperativa_ouvidores
SET telefone_fixo = NULLIF(
  replace(replace(replace(replace(replace(replace(replace(replace(trim(telefone_fixo), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''),
  ''
)
WHERE telefone_fixo IS NOT NULL AND trim(telefone_fixo) <> '';

UPDATE urede_cooperativa_ouvidores
SET telefone_celular = NULLIF(
  replace(replace(replace(replace(replace(replace(replace(replace(trim(telefone_celular), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''),
  ''
)
WHERE telefone_celular IS NOT NULL AND trim(telefone_celular) <> '';

-- contatos: tipo/subtipo canônicos + valor telefônico sem máscara
UPDATE urede_cooperativa_contatos
SET tipo = lower(trim(tipo))
WHERE tipo IS NOT NULL;

UPDATE urede_cooperativa_contatos
SET tipo = 'email'
WHERE tipo IN ('e-mail', 'email', 'mail');

UPDATE urede_cooperativa_contatos
SET tipo = 'telefone'
WHERE tipo LIKE 'telefone%';

UPDATE urede_cooperativa_contatos
SET tipo = 'whatsapp'
WHERE tipo LIKE 'whats%';

UPDATE urede_cooperativa_contatos
SET tipo = 'outro'
WHERE tipo IN ('outros', 'outro canal');

UPDATE urede_cooperativa_contatos
SET subtipo = lower(trim(subtipo))
WHERE subtipo IS NOT NULL;

UPDATE urede_cooperativa_contatos
SET subtipo = 'plantao'
WHERE subtipo IN ('plantão', 'plantao');

UPDATE urede_cooperativa_contatos
SET subtipo = 'emergencia'
WHERE subtipo IN ('emergência', 'emergencia');

UPDATE urede_cooperativa_contatos
SET subtipo = 'divulgacao'
WHERE subtipo IN ('divulgação', 'divulgacao');

UPDATE urede_cooperativa_contatos
SET subtipo = 'comercial pf'
WHERE subtipo IN ('comercial pf', 'comercial_pf', 'comercial-pf', 'comercial pessoa fisica');

UPDATE urede_cooperativa_contatos
SET subtipo = 'comercial pj'
WHERE subtipo IN ('comercial pj', 'comercial_pj', 'comercial-pj', 'comercial pessoa juridica');

UPDATE urede_cooperativa_contatos
SET valor = NULLIF(
  replace(replace(replace(replace(replace(replace(replace(replace(trim(valor), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''),
  ''
)
WHERE valor IS NOT NULL
  AND trim(valor) <> ''
  AND lower(tipo) IN ('telefone', 'whatsapp', 'celular');

-- endereços: garantir IBGE só com 7 dígitos
UPDATE urede_cooperativa_enderecos
SET cd_municipio_7 = NULLIF(
  replace(replace(replace(replace(replace(replace(replace(replace(trim(cd_municipio_7), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''),
  ''
)
WHERE cd_municipio_7 IS NOT NULL AND trim(cd_municipio_7) <> '';

UPDATE urede_cooperativa_enderecos
SET cd_municipio_7 = NULL
WHERE cd_municipio_7 IS NOT NULL AND length(cd_municipio_7) <> 7;

-- endereços: cidade/UF derivados do IBGE quando houver correspondência em cidades
UPDATE urede_cooperativa_enderecos
SET cidade = (
      SELECT c.NM_CIDADE
      FROM urede_cidades c
      WHERE c.CD_MUNICIPIO_7 = urede_cooperativa_enderecos.cd_municipio_7
      LIMIT 1
    ),
    uf = (
      SELECT c.UF_MUNICIPIO
      FROM urede_cidades c
      WHERE c.CD_MUNICIPIO_7 = urede_cooperativa_enderecos.cd_municipio_7
      LIMIT 1
    )
WHERE cd_municipio_7 IS NOT NULL
  AND trim(cd_municipio_7) <> '';

INSERT INTO schema_migrations(version) VALUES ('20260211_008_normalizar_dados_importados');

COMMIT;

