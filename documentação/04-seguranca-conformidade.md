# 4. Segurança, Auditoria e Compliance

## 4.1 Escopo
Consolidar os controles já implementados no uRede e destacar requisitos para aderência a normas de segurança da informação (ISO 27001) e privacidade de dados (LGPD/GDPR/BACEN ao operar com cooperativas de saúde).

## 4.2 Controles técnicos existentes
| Área | Implementação | Referência |
| --- | --- | --- |
| Autenticação | `POST /auth/login` emite JWT (`HS256`) com claims `sub`, `email`, `papel`, `cooperativa_id`. Senhas protegidas via `bcrypt`. | `database/functions/server/index.tsx`, `lib/jwt.ts` |
| Confirmação e aprovação | Tokens únicos expiram após `EMAIL_CONFIRMATION_TIMEOUT_HOURS` (default 24h). Fluxo de aprovação registra `user_approval_requests` e escalona para admins da cooperativa. | Seções `sendApprovalRequestEmails`, `enqueueApprovalRequest` |
| Controles de acesso | Middleware `requireAuth` valida JWT; `requireRole` aplica RBAC (admin, operador, federação, confederação). Escopos adicionais para cobertura de cidades via `resolveCoberturaScope`. | Linhas ~2050 e ~1100 do backend |
| Proteção contra CORS | Middleware `cors` limita origens a `ALLOWED_ORIGINS` (curingas `*.dominio.com`). | Início do `index.tsx` |
| Auditoria | Tabela `urede_auditoria_logs` guarda ações (criação, transferência, alertas lidos). Funções `registrarLogCobertura` e `applyEscalation` sempre escrevem eventos. | `db/sqlite_schema.sql` e backend |
| Alertas | `urede_alertas` rastreia todas as notificações enviadas por e-mail/in-app; leitura gera trilha auditável. | `dispatchPedidoAlert`, rotas `/alertas/*` |
| SLA e escalonamento | `escalarPedidos` garante que prazos não sejam perdidos, evitando estoque esquecido em singulares. Configurável por `SystemSettings.deadlines`. | Backend seção 2252 |
| Sanitização de conteúdo | Markdown renderizado via `DOMPurify` no frontend; JSON responses não executam HTML. | `src/utils/markdown.ts` |
| Notificações Web | Baseadas na API nativa do navegador; não expõem dados além do título e resumo. | `Layout.tsx` |

## 4.3 Itens sensíveis e classificação de dados
| Dado | Local | Sensibilidade | Observações |
| --- | --- | --- | --- |
| Informações pessoais (nome, e-mail, telefone, whatsapp, cargo) | `auth_users`, `urede_operadores` | Alto (PII) | Sem criptografia em repouso; requer *disk encryption* e controle de acesso ao host. |
| Documentos de pedidos (observações) | `urede_pedidos` | Médio/Alto | Pode conter dados clínicos; recomenda-se limitar conteúdo e aplicar política de retenção. |
| Logs de auditoria | `urede_auditoria_logs`, `urede_cobertura_logs` | Médio | Úteis para investigações, mas armazenam e-mails e nomes dos autores. |
| Tokens JWT | `localStorage.auth_token` | Alto | Expostos ao contexto da SPA; recomenda-se usar HTTPS estrito + política de Content Security Policy (CSP). |

## 4.4 Conformidade (LGPD)
- **Controlador x Operador:** A Confederação tende a ser *controladora* de dados de cooperativas singulares; a Collos (ou cliente final) atua como operadora. Documentar contratos específicos.
- **Bases legais:** consentimento implícito para operadores internos; contratos com prestadores externos devem citar finalidades de credenciamento e auditoria.
- **Direitos do titular:** Implementar processos para:
  - localizar registros por e-mail em `auth_users`/`urede_operadores`;
  - excluir ou anonimizar pedidos ao término do ciclo (atualmente inexistente);
  - exportar histórico em formato legível (CSV).
- **Retenção:** definir políticas (ex.: 5 anos para pedidos e auditorias). Implementar scripts de expurgo futuro.
- **Compartilhamento:** `dispatchPedidoAlert` envia dados pessoais por e-mail; exigir contratos de operador com o provedor Brevo (SIB) e ativar funcionalidades de segurança (chaves API segregadas, DKIM/SPF).

## 4.5 Recomendações imediatas
1. **Proteção do backend:** colocar o serviço Hono atrás de um *reverse proxy* (Nginx/Cloudflare) com TLS, rate limiting e bloqueio do endpoint `/debug/counts` em produção.
2. **Segredos:** armazenar `JWT_SECRET`, `BREVO_API_KEY`, `DATABASE_DB_URL` em cofres (AWS Secrets Manager, GCP Secret Manager ou Vault). Remover valores default de produção.
3. **Hardening do SQLite:** se permanecer em produção, aplicar *file permissions* restritivas, snapshots e criptografia em nível de disco. Considerar migração acelerada para Postgres gerenciado com backup automático.
4. **Monitoramento:** enviar logs estruturados para solução central (Datadog, Loki, Elastic). Configurar alertas para falhas de escalonamento (ex.: contador de pedidos vencendo > threshold).
5. **INSECURE_MODE:** manter `false` em ambientes reais. Documentar no runbook que esse flag só pode ser usado em ambientes isolados.
6. **Testes de intrusão:** executar análise de vulnerabilidades nos endpoints públicos (login, register, confirm-email) e revisar políticas de senha (no momento qualquer senha é aceita; considerar tamanho mínimo e complexidade).
7. **Consent banner / termos:** incluir aceite explícito na tela de cadastro mencionando finalidades e política de privacidade.

## 4.6 Plano de resposta a incidentes
| Etapa | Responsável | Ação |
| --- | --- | --- |
| Detecção | SRE / NOC | Monitorar `server.log`, métricas de erro 5xx e alertas de cron (job de escalonamento). |
| Contenção | TI | Revogar tokens JWT comprometidos alterando `JWT_SECRET` e forçando re-login. |
| Erradicação | Dev/DBA | Analisar auditorias em `urede_auditoria_logs` e `urede_alertas` para rastrear alterações suspeitas. |
| Recuperação | TI | Restaurar backups do SQLite/Postgres. Rodar `scripts/import-csv-sqlite.sh` apenas em ambientes de teste. |
| Comunicação | Jurídico / Comunicação | Informar cooperativas impactadas, conforme SLA regulatório (LGPD exige comunicação à ANPD quando aplicável). |

## 4.7 Pendências e próximos passos
- Implementar MFA/SSO (ex.: Azure AD) para operadores críticos.
- Aplicar política de força da senha e bloqueio de conta após tentativas consecutivas.
- Incluir mascaramento parcial de dados sensíveis nas telas (ex.: telefones).
- Disponibilizar export de auditoria assinada digitalmente para compliance externo.
- Revisar política de logs para evitar exposição de tokens em `console.log`.
