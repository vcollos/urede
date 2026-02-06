-- Sanity checks for schema urede

-- Contagens basicas
SELECT 'urede_cooperativas' AS tabela, COUNT(*) AS total FROM urede.urede_cooperativas;
SELECT 'urede_cidades' AS tabela, COUNT(*) AS total FROM urede.urede_cidades;
SELECT 'urede_pedidos' AS tabela, COUNT(*) AS total FROM urede.urede_pedidos;
SELECT 'urede_alertas' AS tabela, COUNT(*) AS total FROM urede.urede_alertas;
SELECT 'urede_auditoria_logs' AS tabela, COUNT(*) AS total FROM urede.urede_auditoria_logs;

-- Pedidos sem cooperativa solicitante valida
SELECT p.id, p.cooperativa_solicitante_id
FROM urede.urede_pedidos p
LEFT JOIN urede.urede_cooperativas c
  ON c.id_singular = p.cooperativa_solicitante_id
WHERE p.cooperativa_solicitante_id IS NOT NULL
  AND c.id_singular IS NULL
LIMIT 20;

-- Pedidos sem cooperativa responsavel valida
SELECT p.id, p.cooperativa_responsavel_id
FROM urede.urede_pedidos p
LEFT JOIN urede.urede_cooperativas c
  ON c.id_singular = p.cooperativa_responsavel_id
WHERE p.cooperativa_responsavel_id IS NOT NULL
  AND c.id_singular IS NULL
LIMIT 20;

-- Cidades com cooperativa inexistente
SELECT c.cd_municipio_7, c.id_singular
FROM urede.urede_cidades c
LEFT JOIN urede.urede_cooperativas coop
  ON coop.id_singular = c.id_singular
WHERE c.id_singular IS NOT NULL
  AND coop.id_singular IS NULL
LIMIT 20;

-- Plantao com cooperativa inexistente
SELECT p.*
FROM urede.cooperativa_plantao p
LEFT JOIN urede.urede_cooperativas c
  ON c.id_singular = p.cooperativa_id
WHERE p.cooperativa_id IS NOT NULL
  AND c.id_singular IS NULL
LIMIT 20;

-- Telefones de plantao sem plantao valido
SELECT pt.*
FROM urede.plantao_telefones pt
LEFT JOIN urede.cooperativa_plantao p
  ON p.id = pt.plantao_id
WHERE pt.plantao_id IS NOT NULL
  AND p.id IS NULL
LIMIT 20;

-- Horarios de plantao sem plantao valido
SELECT ph.*
FROM urede.plantao_horarios ph
LEFT JOIN urede.cooperativa_plantao p
  ON p.id = ph.plantao_id
WHERE ph.plantao_id IS NOT NULL
  AND p.id IS NULL
LIMIT 20;
