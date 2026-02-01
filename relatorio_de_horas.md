# Relatório de Horas – Projeto uRede (Uniodonto)

## Contexto e período
- Período coberto: 10 de janeiro a 10 de fevereiro.
- Escopo: credenciamento e suprimento de rede com SPA React (Vite + TypeScript + Tailwind + shadcn/ui) e API Hono/Deno com Postgres (SQLite para laboratório), incluindo importação de pedidos em lote, escalonamento automático, alertas/e-mails Brevo, dashboards e documentação interna.
- Valor hora contratado: **R$ 100,00/hora** (teto).
- Valor total: **R$ 40.000,00**.
- Parcelas: R$ 20.000,00 em 10/jan e R$ 20.000,00 em 10/fev.

## Resumo financeiro

| Item | Valor |
| --- | --- |
| Valor hora | R$ 100,00 |
| Horas totais | 400 h |
| Total | **R$ 40.000,00** |
| Forma de pagamento | 2x de R$ 20.000,00 (10/jan e 10/fev) |

## Distribuição macro por fase

| Fase | Principais atividades | Horas | Valor |
| --- | --- | --- | --- |
| Planejamento e arquitetura | Levantamento, escopagem, definição de padrões de código, segurança, RBAC e estratégia de deployment. | 56 h | R$ 5.600,00 |
| Dados e migrações | Modelagem Postgres/SQLite, scripts `create-sqlite-db`, importação CSV, validações IBGE/especialidades, seeds. | 28 h | R$ 2.800,00 |
| Backend (API Hono/Deno) | Autenticação/registro/aprovação, cadastros-base, pedidos/SLA, importação XLSX, escalonamento e alertas. | 110 h | R$ 11.000,00 |
| Frontend (SPA React) | Auth + onboarding, dashboards, CRUD de pedidos, importação em lote, alertas, documentação interna. | 110 h | R$ 11.000,00 |
| Infra/DevOps | Configuração de ambientes, env vars, health/version files, scripts de automação e fallback de portas. | 22 h | R$ 2.200,00 |
| QA e testes | Testes manuais guiados por cenários críticos, correções de regressão e validação pós-build. | 26 h | R$ 2.600,00 |
| Documentação e treinamento | Documentação técnica (arquitetura, APIs, segurança), manuais de usuário/administrador e material de apoio. | 20 h | R$ 2.000,00 |
| Implantação e handover | Build final, publicação, orientações operacionais, handover para equipe da Uniodonto. | 28 h | R$ 2.800,00 |
| **Total** |  | **400 h** | **R$ 40.000,00** |

## Detalhamento por módulo/entrega

| Módulo/Entrega | Escopo realizado | Horas | Valor |
| --- | --- | --- | --- |
| Planejamento e discovery | Alinhamento com stakeholders, definição de papéis (singular/federação/confederação), backlog e critérios de aceite. | 24 h | R$ 2.400,00 |
| Arquitetura, padrões e segurança | Camadas, adapters (Postgres/SQLite), RBAC, JWT, CORS, política de prazos de SLA, emails Brevo, fallback de porta. | 32 h | R$ 3.200,00 |
| Dados e migrações | Schema `db/sqlite_schema.sql`, tabelas `urede_*`, importação CSV (cooperativas/cidades/operadores), scripts de criação e seed. | 28 h | R$ 2.800,00 |
| Backend – Autenticação e aprovação | `/auth/register|login|confirm-email|me`, aprovação administrativa, hash bcrypt, tokens djwt, enforce de status. | 26 h | R$ 2.600,00 |
| Backend – Configurações e cadastros base | `/configuracoes/sistema`, cooperativas públicas/privadas, operadores, cidades com filtros por papel, cobertura e histórico. | 18 h | R$ 1.800,00 |
| Backend – Pedidos e SLA | CRUD de pedidos, prazos por nível, recusa/transferência, motivos categorizados, logs de auditoria. | 30 h | R$ 3.000,00 |
| Backend – Importação em lote | `/pedidos/import`, parsing XLSX/CSV, validação IBGE/especialidades, resumo de erros e template oficial. | 12 h | R$ 1.200,00 |
| Backend – Escalonamento automático/cron | Timer interno + endpoint `POST /` com `x-cron`, auto-escalonamento por SLA, auto-recusa configurável. | 14 h | R$ 1.400,00 |
| Backend – Alertas e auditoria | Geração e leitura de `urede_alertas`, marcadores de leitura, logs `urede_auditoria_logs`, e-mails de evento. | 10 h | R$ 1.000,00 |
| Frontend – Autenticação e onboarding | Fluxos de registro, confirmação de email, login, troca de senha, aprovação pendente e sessão global (`AuthContext`). | 22 h | R$ 2.200,00 |
| Frontend – Dashboard e estatísticas | Consumo de `/dashboard/stats`, cards de SLA, totais e status, indicadores por papel. | 18 h | R$ 1.800,00 |
| Frontend – Pedidos (criação/edição) | Listagem com filtros, formulário com especialidades, prioridades, motivos, observações, histórico/auditoria do pedido. | 26 h | R$ 2.600,00 |
| Frontend – Importação de pedidos | Upload/drag-and-drop, mapeamento de colunas, feedback de erros/linhas, barra de progresso e template de download. | 16 h | R$ 1.600,00 |
| Frontend – Alertas e notificações | Lista paginada, marcadores lido/não lido, toasts, polling de 60s e navegação contextual. | 12 h | R$ 1.200,00 |
| Frontend – Documentação interna | Páginas em `src/documentacao/usuarios`, navegação, busca e hardening de markdown (DOMPurify + marked). | 16 h | R$ 1.600,00 |
| Infra/DevOps | Scripts (`create-sqlite-db.sh`, `import-csv-sqlite.sh`, `write-health.mjs`), `.env` unificado, `PORT_FALLBACKS`, artefatos `health.json`/`version.txt`. | 22 h | R$ 2.200,00 |
| QA e testes | Testes exploratórios por papel, regressão após importações massivas, checagem de escalonamento e notificações. | 26 h | R$ 2.600,00 |
| Documentação técnica e manuais | Conjunto `documentação/*.md` (arquitetura, APIs, segurança, instalação, manuais de usuário/administrador, roadmap). | 20 h | R$ 2.000,00 |
| Implantação, treinamento e handover | Build final (`npm run build`), publicação, guia operacional, passagem de conhecimento para equipe Uniodonto. | 28 h | R$ 2.800,00 |
| **Total** |  | **400 h** | **R$ 40.000,00** |

## Entregas consolidadas (evidências)
- API Hono/Deno com JWT, RBAC e integração Brevo; endpoints completos para auth, cadastros, pedidos, importação, alertas, dashboard e operações de escalonamento.
- SPA React/Vite com autenticação, dashboards, gestão de pedidos, importação XLSX/CSV, alertas em tempo real, documentação embutida e UX responsiva.
- Banco de dados Postgres/SQLite com schema versionado e scripts automatizados de criação/importação.
- Observabilidade básica: `GET /health`, `public/health.json` e `public/version.txt`, logging estruturado.
- Documentação completa em `documentação/` (arquitetura, APIs, segurança, instalação, manuais de usuário e administrador, roadmap).

## Disponibilização e hospedagem
- Entregaremos **todo o código-fonte** do projeto (frontend, backend, scripts e documentação).
- Hospedagem prevista em **VM da própria Uniodonto**, com acompanhamento na configuração de ambiente, variáveis e serviços auxiliares (SMTP Brevo, scheduler HTTP).

## Política de manutenção evolutiva/corretiva
- Manutenções futuras poderão ser executadas pela equipe da Uniodonto ou por nós, **R$ 150,00/hora**, somente quando necessário e mediante aprovação prévia de escopo e estimativa.

## Observações finais
- O valor/hora praticado respeita o teto solicitado (R$ 100/h) e cobre integralmente o escopo entregue.
- O período e marcos (10/jan e 10/fev) foram considerados para distribuição de esforço e faturamento.
