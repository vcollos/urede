-- 20260213_015_telefone_unificado_wpp.sql
-- Regra de negócio: telefone unificado + indicador booleano de WhatsApp (wpp).
-- Migração não destrutiva: mantém colunas legadas (telefone_fixo/telefone_celular/whatsapp texto).

BEGIN;

-- Estrutura: adicionar colunas novas
ALTER TABLE urede_cooperativa_auditores ADD COLUMN telefone TEXT;
ALTER TABLE urede_cooperativa_auditores ADD COLUMN wpp INTEGER DEFAULT 0;

ALTER TABLE urede_cooperativa_diretores ADD COLUMN telefone TEXT;
ALTER TABLE urede_cooperativa_diretores ADD COLUMN wpp INTEGER DEFAULT 0;

ALTER TABLE urede_cooperativa_enderecos ADD COLUMN telefone TEXT;
ALTER TABLE urede_cooperativa_enderecos ADD COLUMN wpp INTEGER DEFAULT 0;

ALTER TABLE urede_cooperativa_ouvidores ADD COLUMN telefone TEXT;
ALTER TABLE urede_cooperativa_ouvidores ADD COLUMN wpp INTEGER DEFAULT 0;

ALTER TABLE urede_cooperativa_plantao_clinicas ADD COLUMN telefone TEXT;
ALTER TABLE urede_cooperativa_plantao_clinicas ADD COLUMN wpp INTEGER DEFAULT 0;

ALTER TABLE urede_cooperativa_lgpd ADD COLUMN wpp INTEGER DEFAULT 0;
ALTER TABLE urede_cooperativa_colaboradores ADD COLUMN wpp INTEGER DEFAULT 0;

ALTER TABLE urede_cooperativa_contatos ADD COLUMN wpp INTEGER DEFAULT 0;
ALTER TABLE urede_cooperativa_plantao_contatos ADD COLUMN telefone TEXT;
ALTER TABLE urede_cooperativa_plantao_contatos ADD COLUMN wpp INTEGER DEFAULT 0;

ALTER TABLE auth_users ADD COLUMN wpp INTEGER DEFAULT 0;
ALTER TABLE urede_operadores ADD COLUMN wpp INTEGER DEFAULT 0;

-- Função SQL-inline repetida: limpar máscara e manter apenas dígitos
-- (sem UDF para manter compatível com sqlite3 CLI).

-- auditores
UPDATE urede_cooperativa_auditores
SET telefone = NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone_celular, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), ''),
    wpp = CASE
      WHEN NULLIF(trim(COALESCE(telefone_celular, '')), '') IS NOT NULL THEN 1
      ELSE 0
    END;

-- diretores
UPDATE urede_cooperativa_diretores
SET telefone = NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone_celular, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), ''),
    wpp = CASE
      WHEN NULLIF(trim(COALESCE(telefone_celular, '')), '') IS NOT NULL THEN 1
      ELSE 0
    END;

-- enderecos
UPDATE urede_cooperativa_enderecos
SET telefone = COALESCE(
      NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone_celular, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), ''),
      NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone_fixo, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), '')
    ),
    wpp = CASE
      WHEN NULLIF(trim(COALESCE(telefone_celular, '')), '') IS NOT NULL THEN 1
      ELSE 0
    END;

-- ouvidores
UPDATE urede_cooperativa_ouvidores
SET telefone = COALESCE(
      NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone_celular, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), ''),
      NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone_fixo, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), '')
    ),
    wpp = CASE
      WHEN NULLIF(trim(COALESCE(telefone_celular, '')), '') IS NOT NULL THEN 1
      ELSE 0
    END;

-- plantao_clinicas
UPDATE urede_cooperativa_plantao_clinicas
SET telefone = COALESCE(
      NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone_celular, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), ''),
      NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone_fixo, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), '')
    ),
    wpp = CASE
      WHEN NULLIF(trim(COALESCE(telefone_celular, '')), '') IS NOT NULL THEN 1
      ELSE 0
    END;

-- lgpd / colaboradores (já possuíam telefone)
UPDATE urede_cooperativa_lgpd
SET telefone = NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), ''),
    wpp = CASE
      WHEN length(NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), '')) = 11
           AND substr(NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), ''), 3, 1) = '9'
      THEN 1
      ELSE 0
    END;

UPDATE urede_cooperativa_colaboradores
SET telefone = NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), ''),
    wpp = CASE
      WHEN length(NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), '')) = 11
           AND substr(NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), ''), 3, 1) = '9'
      THEN 1
      ELSE 0
    END;

-- contatos gerais: unificar tipo telefone/whatsapp em telefone + flag wpp
UPDATE urede_cooperativa_contatos
SET valor = NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(valor, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), ''),
    wpp = CASE
      WHEN lower(trim(COALESCE(tipo, ''))) = 'whatsapp' THEN 1
      WHEN length(NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(valor, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), '')) = 11
           AND substr(NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(valor, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), ''), 3, 1) = '9'
      THEN 1
      ELSE 0
    END,
    tipo = CASE
      WHEN lower(trim(COALESCE(tipo, ''))) IN ('telefone', 'whatsapp', 'celular') THEN 'telefone'
      ELSE tipo
    END
WHERE lower(trim(COALESCE(tipo, ''))) IN ('telefone', 'whatsapp', 'celular');

-- contatos de plantão
UPDATE urede_cooperativa_plantao_contatos
SET telefone = CASE
      WHEN lower(trim(COALESCE(tipo, ''))) = 'website' THEN NULL
      ELSE NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(numero_ou_url, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), '')
    END,
    wpp = CASE
      WHEN lower(trim(COALESCE(tipo, ''))) = 'whatsapp' THEN 1
      WHEN length(NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(numero_ou_url, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), '')) = 11
           AND substr(NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(numero_ou_url, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), ''), 3, 1) = '9'
      THEN 1
      ELSE 0
    END,
    tipo = CASE
      WHEN lower(trim(COALESCE(tipo, ''))) = 'website' THEN 'website'
      ELSE 'telefone'
    END;

-- auth_users / operadores
UPDATE auth_users
SET telefone = COALESCE(
      NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), ''),
      NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(whatsapp, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), '')
    ),
    wpp = CASE
      WHEN NULLIF(trim(COALESCE(whatsapp, '')), '') IS NOT NULL THEN 1
      WHEN length(NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), '')) = 11
           AND substr(NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), ''), 3, 1) = '9'
      THEN 1
      ELSE 0
    END;

UPDATE urede_operadores
SET telefone = COALESCE(
      NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), ''),
      NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(whatsapp, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), '')
    ),
    wpp = CASE
      WHEN NULLIF(trim(COALESCE(whatsapp, '')), '') IS NOT NULL THEN 1
      WHEN length(NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), '')) = 11
           AND substr(NULLIF(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(telefone, '')), '.', ''), '-', ''), '/', ''), '(', ''), ')', ''), ' ', ''), '+', ''), char(9), ''), ''), 3, 1) = '9'
      THEN 1
      ELSE 0
    END;

INSERT OR IGNORE INTO schema_migrations(version)
VALUES ('20260213_015_telefone_unificado_wpp');

COMMIT;

