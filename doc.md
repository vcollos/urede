# Sistema de Gestão de Credenciamento Uniodonto
## Documentação Técnica – Estado Atual (Build Local com SQLite / Deno)

> **Visão rápida:** O frontend React/Vite já está integrado a uma API Hono rodando em Deno, que lê um banco SQLite local. A essência do produto — gerir pedidos entre Singulares → Federação → Confederação com SLAs e escalonamento automático — está preservada como objetivo final. Esta documentação descreve como executar e evoluir o stack atual, mantendo a rota para o produto completo.

---

## 📋 Índice

- [1. Visão Geral](#1-visão-geral)
- [2. Arquitetura Técnica](#2-arquitetura-técnica)
- [3. Stack Tecnológica](#3-stack-tecnológica)
- [4. Estado Atual vs. Objetivo Final](#4-estado-atual-vs-objetivo-final)
- [5. Requisitos de Ambiente](#5-requisitos-de-ambiente)
- [6. Setup Local Passo a Passo](#6-setup-local-passo-a-passo)
- [7. Variáveis de Ambiente](#7-variáveis-de-ambiente)
- [8. Scripts e Dados](#8-scripts-e-dados)
- [9. Estrutura de Pastas](#9-estrutura-de-pastas)
- [10. Operação e Fluxos](#10-operação-e-fluxos)
- [11. Roadmap para Produção](#11-roadmap-para-produção)
- [12. Troubleshooting](#12-troubleshooting)

---

## 1. Visão Geral

### 1.1 Descrição
Sistema web que centraliza o credenciamento de prestadores da rede Uniodonto. Pedidos nascem na Singular, podem escalar para Federação e Confederação caso o SLA de 30 dias por nível expire. Usuários autenticam via JWT e interagem com dashboard, lista Kanban e modais de detalhes.

### 1.2 Funcionalidades Entregues
- ✅ Autenticação local com JWT e RBAC (admin, operador, federação, confederação)
- ✅ Dashboard com cards e atividade recente
- ✅ Lista de pedidos com filtros e visão Kanban
- ✅ Detalhamento de pedido com alteração de status e auditoria (via API)
- ✅ Cadastro de pedidos com modal dedicado
- ✅ Vistas de cooperativas e operadores com filtros
- ✅ Backend Hono acessando SQLite, incluindo escalonamento automático

### 1.3 Funcionalidades Planejadas (Essência preservada)
- ⏳ CRUD completo de operadores no frontend (UI em andamento)
- ⏳ Configurações administrativas (painel a reimplementar)
- ⏳ Monitoramento em tempo real / notificações assíncronas
- ⏳ Deploy gerenciado (Postgres gerenciado ou outro serviço gerenciado) 

---

## 2. Arquitetura Técnica

```
┌────────────────────┐      ┌────────────────────────┐      ┌───────────────┐
│ Frontend (React)   │────▶ │ API Hono (Deno)         │────▶│ SQLite local  │
│ Vite + Tailwind    │      │ database/functions/...  │      │ data/urede.db  │
│ Auth via JWT local │◀─────│ JWT emitido/validado    │◀────│                │
└────────────────────┘      └────────────────────────┘      └───────────────┘
```

- **Frontend**: React 18 + Vite + Tailwind (via CSS gerado). Consome `VITE_API_BASE_URL` (default `http://127.0.0.1:8300`).
- **Backend**: Hono rodando em Deno (`database/functions/server/index.tsx`). Disponível via `npm run server:dev`.
- **Banco**: SQLite (`data/urede.db`). Scripts para criar/importar em `scripts/`.
- **Autenticação**: JWT local salvo em `localStorage` (`auth_token`).
- **Comunicação**: Fetch via helper `src/utils/api/client.ts`, com headers automáticos.

---

## 3. Stack Tecnológica

### 3.1 Frontend
- React 18.3
- TypeScript
- Vite 6.3
- Componentes shadcn/ui
- Tailwind utilities pré-geradas (arquivo `src/index.css`)
- lucide-react, react-hook-form, recharts, etc.

### 3.2 Backend (Deno/Hono)
- Hono 4.4
- bcrypt para hash
- SQLite (deno.land/x/sqlite)
- JWT assinado manualmente (`lib/jwt.ts`)

### 3.3 Scripts
- `scripts/create-sqlite-db.sh`: cria schema com base em `db/sqlite_schema.sql`
- `scripts/import-csv-sqlite.sh`: importa CSVs de `bases_csv/`
- `scripts/write-health.mjs`: gera health/version para build

---

## 4. Estado Atual vs. Objetivo Final

| Área                    | Estado Atual (SQLite/Deno)                                          | Visão Final (Essência)                                           |
|-------------------------|---------------------------------------------------------------------|------------------------------------------------------------------|
| Autenticação            | JWT local, usuários em tabela `auth_users` / operadores             | Integração com provedor gerenciado (Auth externo / AD / IAM)     |
| Banco de dados          | SQLite local (`data/urede.db`)                                      | Postgres gerenciado, replicação e backups automáticos            |
| API                     | Deno + Hono, single file                                            | Edge Functions ou Node/Go com observabilidade completa           |
| Escalonamento           | Função local `escalarPedidos` consultando o SQLite                  | Cron gerenciado + notificações (email/Slack)                     |
| Monitoramento           | `health.json` gerado no build                                       | Stack de logs/metrics (Grafana, Sentry, etc.)                    |
| Deploy                  | Manual (scripts + Deno local)                                       | CI/CD com Nginx/Cloudfront ou plataforma serverless              |

A documentação aqui mantém o foco no stack atual, mas cada seção indica como migrar para o alvo quando a infraestrutura gerenciada estiver pronta.

---

## 5. Requisitos de Ambiente

- **Node.js** 18+ (para rodar Vite, scripts e gerar build)
- **npm** 9+ / **pnpm** 8 (alternativa)
- **Deno** 1.41+ (para backend Hono)
- **SQLite3** CLI (para validar banco se desejar)
- **bash** (para scripts shell)

Verificações rápidas:
```bash
node --version
npm --version
 deno --version
 sqlite3 --version
```

---

## 6. Setup Local Passo a Passo

1. **Instalar dependências Node**
   ```bash
   npm install
   ```

2. **Preparar banco SQLite**
   ```bash
   bash scripts/create-sqlite-db.sh
   bash scripts/import-csv-sqlite.sh
   ```
   Isso gera/popula `data/urede.db`. Ajuste os CSVs em `bases_csv/` conforme necessidade.

3. **Configurar variáveis**
   - Utilize o arquivo `.env` na raiz (compartilhado por frontend e backend).
   - Ajuste `VITE_API_BASE_URL` e `ALLOWED_ORIGINS` conforme ambiente (ex.: `http://127.0.0.1:8300`).

4. **Rodar backend (Hono/Deno)**
   ```bash
   npm run server:dev
   ```
   - Usa o mesmo `.env` da raiz (variáveis `JWT_SECRET`, `SQLITE_PATH`, etc.).
   - API ficará disponível em `http://127.0.0.1:8300` (ou na primeira porta livre da lista informada).

5. **Rodar frontend**
   ```bash
   npm run dev
   ```
   - Interface acessível em `http://localhost:3400` (padrão Vite).

6. **Build** (caso necessário)
   ```bash
   npm run build
   ```
   - Gera artefatos em `build/`.

---

## 7. Variáveis de Ambiente

### Frontend (`.env`, `.env.local`)
```bash
VITE_API_BASE_URL=http://127.0.0.1:8300
```
Outros valores poderão ser adicionados conforme integração com serviços externos.

### Backend Deno (mesmo `.env` da raiz)
```bash
JWT_SECRET=dev-secret-change-me
SQLITE_PATH=./data/urede.db
TABLE_PREFIX=urede_
INSECURE_MODE=false
ALLOWED_ORIGINS=http://localhost:3400
PORT=8300
PORT_FALLBACKS=8301,8302,8303
```
- `INSECURE_MODE=true` libera autenticação para desenvolvimento.
- Ajuste `ALLOWED_ORIGINS` para ambientes adicionais (app em produção, etc.).
- `PORT` define a porta preferencial e `PORT_FALLBACKS` lista alternativas caso alguma já esteja em uso.

---

## 8. Scripts e Dados

- `scripts/create-sqlite-db.sh`: cria `data/urede.db` usando `db/sqlite_schema.sql`.
- `scripts/import-csv-sqlite.sh`: carrega CSVs (`bases_csv/`) nas tabelas `urede_cooperativas`, `urede_cidades`, `urede_operadores`.
- `public/health.json` e `public/version.txt`: gerados por `npm run prebuild` (executa `scripts/write-health.mjs`).

Para reset completo:
```bash
rm -f data/urede.db data/urede.db-shm data/urede.db-wal
bash scripts/create-sqlite-db.sh
bash scripts/import-csv-sqlite.sh
```

---

## 9. Estrutura de Pastas (Simplificada)

```

---

## Atualizações Recentes (Admin e Usuários)

- Telefones de `urede_operadores` foram unificados em `telefone` com flag booleana `wpp`.
- O campo legado `whatsapp` texto permanece apenas para retrocompatibilidade.
- Na UI de usuários, o contato é exibido em uma única linha de telefone com ícone do WhatsApp quando `wpp=true`.
- O menu `Responsáveis` foi renomeado para `Usuários`.
- `Usuários` e `Gestão de dados` agora aparecem como subitens de `Configurações`, somente para administradores.
- Navegação modular ativada: UHub concentra homepage e menus globais (`Cooperativas`, `Cidades`), enquanto URede concentra `Dashboard`, `Relatórios`, `Pedidos` e `Pedidos em lote`.
- Branding por contexto: o topo alterna identidade visual entre UHub e URede conforme o módulo ativo.
- Tela de autenticação atualizada para identidade UHub; na homepage do hub, o card de boas-vindas foi simplificado para reduzir redundância visual.
- Configurações agora são contextuais por módulo: Hub (`/hub/configuracoes`) e URede (`/urede/configuracoes`) usam a mesma tela com seções diferentes.
- Alteração de configurações de módulo é restrita a Administrador da Confederação (validação no frontend e backend).
- CRUD de usuários atualizado para múltiplas singulares: cadastro e edição aceitam uma ou mais associações, com definição de singular principal.
- Vínculos extras de usuário/cooperativa são persistidos em `auth_user_cooperativas` e sincronizados com `auth_users.cooperativa_id` (principal).
- Na edição de usuário, a redefinição de credencial provisória é acionada por botão explícito no modal.
- A gestão de cooperativas ganhou aba dedicada de **Endereços** para CRUD completo.
- Endereços agora possuem `exibir_visao_geral` (0/1) para controlar exibição na aba **Visão Geral**.
- Endereços do tipo `plantao_urgencia_emergencia` sincronizam com `cooperativa_plantao_clinicas` (vínculo por `plantao_clinica_id`/`endereco_id`) para reduzir duplicidade entre cadastros de endereço e plantão.
- O Hub passou a manter catálogos globais de dados cadastrais (`tipos_endereco`, `tipos_conselho`, `tipos_contato`, `subtipos_contato`, `redes_sociais`, `departamentos`) em `settings.system_preferences`, reutilizados no cadastro auxiliar de cooperativas.
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── components/
│   │   ├── AuthScreen.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Layout.tsx
│   │   ├── LoginForm.tsx
│   │   ├── NovoPedidoForm.tsx
│   │   ├── OperadoresLista.tsx
│   │   ├── PedidoDetalhes.tsx
│   │   ├── PedidosLista.tsx
│   │   ├── RegisterForm.tsx
│   │   └── ui/...
│   ├── contexts/AuthContext.tsx
│   ├── services/{apiService.ts, authService.ts}
│   ├── types/index.ts
│   ├── utils/{api/client.ts, pedidoStyles.ts}
│   └── data/mockData.ts (dados mock usados apenas em Fallbacks/Dev)
├── database/functions/server/
│   ├── index.tsx (API principal Hono)
│   ├── index.ts (re-export para Deno)
│   └── lib/{jwt.ts, sqlite.ts}
├── data/urede.db (gerado)
├── bases_csv/ (fontes dos dados)
├── scripts/
│   ├── create-sqlite-db.sh
│   ├── import-csv-sqlite.sh
│   └── write-health.mjs
├── package.json
├── vite.config.ts
└── README.md
```

---

## 10. Operação e Fluxos

### 10.1 Autenticação
1. `LoginForm` chama `authService.login` → `/auth/login`
2. API valida credenciais em `auth_users` e retorna JWT
3. Token armazenado em `localStorage` (`auth_token`)
4. `AuthContext` mantém `user`, `isAuthenticated`, `isLoading`

### 10.2 Pedidos
- Lista (`PedidosLista`) consulta `/pedidos`
- Modal (`PedidoDetalhes`) usa `/pedidos/{id}`, `/pedidos/{id}/auditoria`
- Atualização de status dispara `PATCH` + atualiza contexto
- Escalonamento: função `escalarPedidos` roda no backend (pode ser acionada via cron manual usando `POST /admin/escalar-pedidos`)

### 10.3 Cooperativas / Operadores
- `CooperativasView` (componente inline em `App`) -> `/cooperativas`, `/operadores`, `/cidades`
- `OperadoresLista` -> `/operadores`

### 10.4 Navegação Modular (fase atual)
- **UHub**: `/hub`, `/hub/cooperativas`, `/hub/cidades`, `/hub/configuracoes`, `/hub/usuarios`, `/hub/gestao-dados`.
- **URede**: `/urede/dashboard`, `/urede/relatorios`, `/urede/pedidos`, `/urede/importacao`, `/urede/configuracoes`.
- O shell principal alterna menu, atalhos e marca conforme o módulo ativo.
- Rotas legadas continuam com fallback para preservar deep links existentes.
- As configurações são exibidas por contexto de módulo (Hub x URede) na mesma view.
- Somente Administrador da Confederação pode salvar configurações de módulo.

### 10.5 Padrão de Telefonia (vigente)
- Campo canônico: `telefone` (string, somente números).
- Indicador de WhatsApp: `wpp` (0/1).
- Em contatos (`cooperativa_contatos` e `cooperativa_plantao_contatos`), `tipo` telefônico é padronizado para `telefone`; WhatsApp é identificado por `wpp=1`.
- Colunas legadas (`telefone_fixo`, `telefone_celular`, `whatsapp` texto) são mantidas para retrocompatibilidade, mas não devem ser usadas em novas implementações.

Regras de exibição:
- Celular BR: `(DD) 9 0000-0000`
- Fixo BR: `(DD) 0000-0000`
- 0800: `0800 0000 0000`

Migração de referência:
- `db/migrations/sqlite/20260213_015_telefone_unificado_wpp.sql`

### 10.6 Dashboard
- `/dashboard/stats` + `/pedidos`
- Eventos custom (`window.dispatchEvent`) garantem sincronia após ações (created/updated/deleted)

---

## 11. Roadmap para Produção

1. **Infraestrutura Gerenciada**
   - Migrar SQLite → Postgres
   - Avaliar PostgreSQL gerenciado
   - Configurar backup, migrações e RLS

2. **Autenticação Corporativa**
   - Integração com provedores (Auth externo, AD, etc.)
   - Fluxos de recuperação de senha e convites

3. **Observabilidade**
   - Adicionar logs estruturados, métricas, alertas
   - Integração com Sentry, Grafana, etc.

4. **CI/CD**
   - Automatizar build/test/deploy (GitHub Actions, etc.)
   - Scripts de health check e rollback profissionalizados

5. **Funcionalidades Avançadas**
   - Painel administrativo completo
   - Notificações (email/Slack)
   - Relatórios exportáveis
   - Multi-tenant / customizações por cooperativa

---

## 12. Troubleshooting

| Sintoma                              | Causa Provável                               | Ação                                                                 |
|-------------------------------------|----------------------------------------------|----------------------------------------------------------------------|
| Campos de texto lentos              | Re-render pesado em listas grandes            | Debounce, memoização com `useMemo`/`useDeferredValue`                |
| Login falha / mock aparece          | API Deno não está rodando ou erro de CORS     | Verificar `npm run server:dev`, checar console e `.env` |
| Build falha (npm)                   | Node/NPM ausentes ou versão incompatível      | Instalar Node 18+ (ex.: `brew install node`)                        |
| `ECONNREFUSED` nas requisições      | API fora do ar ou `VITE_API_BASE_URL` errado  | Conferir `.env` e porta 8300 (ou a porta configurada)               |
| Escalonamento não dispara           | Cron não configurado                          | Rodar manual `POST /admin/escalar-pedidos` ou agendar script shell  |

Logs úteis:
```bash
# Backend Hono (Deno)
npm run server:dev
# Health da API
curl http://127.0.0.1:8300/health
# Frontend (Vite dev server)
npm run dev
```

---

**📅 Última atualização:** março/2025  
**🔄 Versão desta doc:** 1.1 (adaptação para backend Deno + SQLite)  
**✅ Essência preservada:** credenciamento multi-nível com SLAs, escalonamento e governança RBAC continuam como norte do produto.
