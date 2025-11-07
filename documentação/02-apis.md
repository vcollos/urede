# 2. Catálogo de APIs HTTP

## 2.1 Considerações gerais
- **Base URL:** definida por `VITE_API_BASE_URL` no front e pelas variáveis `APP_BASE_URL`/`APP_URL` para links nos e-mails. Em desenvolvimento, usar `http://127.0.0.1:8300`.
- **Formato:** JSON UTF-8. Requisições POST/PUT devem enviar `Content-Type: application/json`.
- **Autenticação:** JWT assinado em `/auth/login` (header `Authorization: Bearer <token>`). Tokens são verificados via `verifyJwt` e expirados conforme `signJwt` (24h por padrão).
- **Erros:** `{ "error": "mensagem" }` com status HTTP adequado (400, 401, 403, 404, 409, 500). Mensagens `pending_confirmation`, `pending_approval`, etc., são propagadas e tratadas pela SPA.
- **Versionamento:** único conjunto de rotas; recomenda-se colocar atrás de API Gateway se for necessário versionar.

## 2.2 Fluxo de autenticação
1. `POST /auth/register` cria usuário (hash bcrypt + token de confirmação). Responde `status=pending_confirmation`.
2. `POST /auth/confirm-email` valida o token enviado por e-mail. Caso `auto_approve=true`, o usuário é liberado imediatamente; caso contrário, entra em fluxo de aprovação (`user_approval_requests`).
3. `POST /auth/login` retorna `{ token }`. Caso `approval_status` diferente de `approved`, retorna `403` com código amigável.
4. `GET /auth/me` traz perfil completo (`User` em `src/types`), inclusive `approval_status`.

### Exemplo – Login
```bash
curl -X POST http://127.0.0.1:8300/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"operador@uniodonto.com.br","password":"senha"}'
```
Resposta:
```json
{ "token": "eyJhbGciOiJI..." }
```

## 2.3 Tabela resumida de endpoints

### Autenticação e aprovação
| Método | Rota | Proteção | Descrição |
| --- | --- | --- | --- |
| POST | `/auth/register` | Pública | Cria usuário, dispara e-mail de confirmação e (opcionalmente) solicita aprovação. |
| POST | `/auth/login` | Pública | Retorna JWT após validar credenciais e status da conta. |
| POST | `/auth/confirm-email` | Pública | Confirma token enviado por e-mail (`body.token` ou `?token=`). |
| GET | `/auth/me` | JWT | Retorna perfil completo (nome, papel, cooperativa, approval_status). |
| PUT | `/auth/me` | JWT | Atualiza informações pessoais (nome, telefone, cargo, etc.). |
| POST | `/auth/change-password` | JWT | Altera senha mediante `current_password` (quando exigido) e `new_password`. |
| GET | `/auth/pending` | JWT (admin) | Lista solicitações de aprovação direcionadas à cooperativa do admin. |
| POST | `/auth/pending/:id/approve` | JWT (admin) | Aprova solicitação; define `approval_status=approved` e atualiza papel. |
| POST | `/auth/pending/:id/reject` | JWT (admin) | Rejeita solicitação com `notes` opcionais.

### Configurações e cadastros-base
| Método | Rota | Proteção | Descrição |
| --- | --- | --- | --- |
| GET | `/configuracoes/sistema` | JWT | Lê preferências globais (`SystemSettings` em tabela `urede_settings`). |
| PUT | `/configuracoes/sistema` | JWT (confederação ou admin confederado) | Atualiza prazos de SLA, flags de aprovação e motivos padrões. |
| GET | `/cooperativas/public` | Pública | Lista cooperativas básicas para onboarding. |
| GET | `/cooperativas` | JWT | Lista completa com RBAC (visível conforme papel). |
| GET | `/cooperativas/:id/config` | JWT | Obtém `auto_recusar` de uma cooperativa. |
| PUT | `/cooperativas/:id/config` | JWT | Liga/desliga recusa automática e dispara auto-escalonamento. |
| GET | `/cooperativas/:id/cobertura/historico?limit=200` | JWT | Consulta logs de cobertura (transferência de cidades entre cooperativas). |
| PUT | `/cooperativas/:id/cobertura` | JWT | Substitui cobertura de cidades informando `cidade_ids`. Gera logs e auditoria. |
| GET | `/cidades` | JWT | Lista cidades com filtros aplicados pelo papel do usuário. |
| GET | `/cidades/public` | Pública | Lista reduzida para formulários públicos. |
| GET | `/operadores` | JWT | Lista operadores (respeitando escopo). |
| POST | `/operadores` | JWT | Cria operador vinculado a uma cooperativa (admin/confederação). |
| PUT | `/operadores/:id` | JWT | Atualiza operador existente (contato, status). |

### Pedidos e importação
| Método | Rota | Proteção | Descrição |
| --- | --- | --- | --- |
| GET | `/pedidos` | JWT | Lista pedidos visíveis para o usuário e dispara `escalarPedidos()` no início. |
| GET | `/pedidos/:id` | JWT | Retorna pedido detalhado + enriquecimento (cidades/cooperativas). |
| POST | `/pedidos` | JWT | Cria pedido (campos: `titulo`, `cidade_id`, `especialidades[]`, `quantidade`, `observacoes`, `prioridade`, opcional `motivo_categoria`, `beneficiarios_quantidade`). Calcula `prazo_atual` conforme nível inicial. |
| PUT | `/pedidos/:id` | JWT | Atualiza status, observações, responsável e outras colunas. Mantém auditoria e notifica alertas. |
| DELETE | `/pedidos/:id` | JWT | Marca `status=cancelado`/`excluido=true` (o frontend usa `ApiService.deletePedido`). |
| POST | `/pedidos/:id/transferir` | JWT | Força escalonamento para próximo nível com `motivo` opcional. |
| GET | `/pedidos/:id/auditoria` | JWT | Retorna logs da tabela `urede_auditoria_logs`. |
| POST | `/pedidos/import` | JWT | Importa lote (`PedidoImportPayload`). Valida IBGE e especialidades, responde `summary` + `errors`. |
| GET | `/pedidos/public` | Condicional | Disponível quando `PUBLIC_PEDIDOS=true`; expõe subconjunto sem dados sensíveis.

### Alertas e dashboard
| Método | Rota | Proteção | Descrição |
| --- | --- | --- | --- |
| GET | `/alertas?limit=50` | JWT | Retorna alertas direcionados ao usuário (`urede_alertas`). |
| POST | `/alertas/:id/lido` | JWT | Marca um alerta específico como lido ou não lido. |
| POST | `/alertas/marcar-todos` | JWT | Marca todos como lidos. |
| GET | `/dashboard/stats` | JWT | Consolida indicadores (total, vencendo, em andamento, concluídos, SLA). |

### Utilidades e operações
| Método | Rota | Proteção | Descrição |
| --- | --- | --- | --- |
| POST | `/admin/escalar-pedidos` | JWT (admin) | Executa `escalarPedidos` manualmente (útil para suporte). |
| GET | `/health` | Pública | Health check (status/time). |
| GET | `/` | Pública | Resposta de diagnóstico (status, método). |
| POST | `/` | Pública | Quando `body.task="escalar"` ou header `x-cron: true`, executa job de escalonamento; caso contrário ecoa payload. |
| GET | `/debug/counts` | Pública (dev) | Contagens de registros por tabela (prefixadas). Não expor em produção.

## 2.4 Estruturas de dados
- **User**: `src/types/index.ts` – inclui `papel`, `cooperativa_id`, `approval_status`, `email_confirmed_at`.
- **Pedido**: inclui `nivel_atual`, `prazo_atual`, `dias_restantes`, `responsavel_atual_*`, `especialidades[]`, `ponto_de_vista`, `excluido`.
- **Alerta**: `tipo` ∈ {`novo`, `comentario`, `status`, `nivel`, `responsavel`, `atualizacao`}; contém `mensagem`, `detalhes`, `lido`.
- **SystemSettings**: prazos `deadlines.singularToFederacao`, `deadlines.federacaoToConfederacao`, flags `requireApproval`, `autoNotifyManagers`, `enableSelfRegistration`, `pedido_motivos[]`.
- **PedidoImportPayload**: lista `items[]` (campos `titulo`, `especialidade`, `cidadeCodigo`, `responsavelEmail`, `detalhes`) e `meta.mapping` (mapa cabeçalho→campo). Resposta traz `summary`, `errors[]` (linha + mensagem) e `imported[]`.

## 2.5 Exemplos adicionais

### Criação de pedido
```bash
curl -X POST http://127.0.0.1:8300/pedidos \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "titulo": "Ortodontia infantil",
    "cidade_id": "3505708",
    "especialidades": ["Ortodontia", "Odontopediatria"],
    "quantidade": 2,
    "observacoes": "Urgência pediátrica",
    "prioridade": "alta",
    "motivo_categoria": "Rede insuficiente"
  }'
```
Saída (resumida):
```json
{
  "id": "ped_123",
  "nivel_atual": "singular",
  "prazo_atual": "2025-02-10T03:00:00.000Z",
  "dias_restantes": 28,
  "status": "novo"
}
```

### Importação em lote
```json
POST /pedidos/import
{
  "items": [
    {
      "rowNumber": 2,
      "titulo": "Clínica Geral",
      "especialidade": "Clínica Geral; Endodontia",
      "cidadeCodigo": "3550308",
      "responsavelEmail": "agente@singular.com",
      "detalhes": "Demanda mensal"
    }
  ],
  "meta": {
    "originalFilename": "pedidos_jan.xlsx",
    "mapping": {
      "titulo": "Nome do pedido",
      "cidadeCodigo": "Código IBGE"
    }
  }
}
```
Resposta:
```json
{
  "summary": {"total": 1, "imported": 1, "skipped": 0, "durationMs": 430},
  "errors": [],
  "imported": [{"id": "ped_abc", "titulo": "Clínica Geral"}]
}
```

### Marcar alerta como lido
```bash
curl -X POST http://127.0.0.1:8300/alertas/alt_123/lido \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"lido": true}'
```

## 2.6 Boas práticas para clientes
- Reutilizar o token até expirar (o backend ainda não oferece refresh token).
- Respeitar limites de leitura: para polling de alertas, o frontend usa intervalos de 60 segundos. Ajustar caso integre outros clientes.
- Tratar mensagens específicas (`pending_confirmation`, `pending_manual`, `rejected`) para orientar o usuário final.
- Em integrações server-to-server, fixar o `origin` aceito via `ALLOWED_ORIGINS` para evitar bloqueios CORS.
- Habilitar HTTPS/TLS no proxy frontal para proteger o header Authorization (não há TLS terminando no Deno por padrão).
