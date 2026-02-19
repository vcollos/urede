
# Credenciamento e Suprimento App

Este projeto agora está configurado para rodar somente com SQLite local (sem depender de provedores externos). O backend é uma API em Deno/Hono que acessa um arquivo SQLite, e o frontend (Vite + React) consome essa API via `VITE_API_BASE_URL`.

## Rodar localmente (SQLite)

1) Instale dependências do frontend
- `npm i`

2) Crie e popule o banco SQLite
- `bash scripts/create-sqlite-db.sh`
- `bash scripts/import-csv-sqlite.sh`

3) Ajuste o arquivo `.env` (raiz do projeto)
- O mesmo arquivo abastece frontend e backend. Atualize `VITE_API_BASE_URL` e, se necessário, `ALLOWED_ORIGINS` para refletir seu ambiente (ex.: `http://127.0.0.1:8300`).

4) Suba o backend (Deno)
- `npm run server:dev`
  - O servidor tenta usar `PORT` (default 8300) e avança para `PORT_FALLBACKS` se a porta estiver ocupada.

5) Suba o frontend
- `npm run dev`

Testes rápidos:
- Health: `curl http://127.0.0.1:8300/health`
- Cooperativas públicas: `curl http://127.0.0.1:8300/cooperativas/public`

Notas:
- Rotas protegidas usam JWT local (gerado pelo próprio backend em `/auth/register` e `/auth/login`).
- Tabelas do SQLite usam prefixo `urede_`. Os CSVs em `bases_csv/` alimentam `urede_cooperativas`, `urede_cidades` e `urede_operadores`.
- A `UDocs` usa endpoints canônicos `/udocs/assets*` com retrocompatibilidade em `/marketing/assets*` e `/arquivos*`, além de integração com Google Drive via variáveis `GDRIVE_*` (veja `database/functions/server/.env.example`).
- O JSON de Service Account do Google Drive pode ser cadastrado em `Hub > Configurações` (somente administradores da Central); o armazenamento em banco usa criptografia AES-GCM com chave `CENTRAL_ARQUIVOS_ENCRYPTION_KEY`.

## Política de Portas (UHub + Sub Apps)

Padrão oficial para desenvolvimento local:

- `3400`: Frontend principal do UHub (`npm run dev`).
- `8300` (fallback `8301,8302,8303`): API local Deno/Hono (`npm run server:dev`).
- `3501-3599`: faixa reservada para apps externos em `sub_apps/*` (Central de Apps).

Status atual:

- `Gerador de Propostas` está **integrado no UHub** em `/hub/apps/propostas`.
- `sub_apps/proposta` permanece como fonte externa para referência/evolução e pode ser rodado standalone em `3501` quando necessário.
- `Gerador de Assinaturas de Email` está **integrado no UHub** em `/hub/apps/assinatura-email`.
- `sub_apps/email_signature` pode ser rodado standalone em `3502` quando necessário.
- `UDocs` está **integrada como módulo UDocs** em `/udocs/dashboard`.
- `sub_apps/central_arquivos` pode ser rodado standalone em `3503` quando necessário.

Regra para novos apps:

1. Integrar primeiro no UHub, com rota canônica em `/hub/apps/<slug>`, mantendo shell/layout/Tailwind do UHub.
2. Reservar a próxima porta livre da faixa `3501-3599` apenas se houver necessidade de rodar o app standalone.
3. Se houver standalone, configurar a porta no `vite.config.ts` do sub app e registrar opcionalmente a URL no `.env` (`VITE_SUBAPP_<NOME>_URL`).
4. Atualizar `sub_apps/README.md` e a documentação principal com rota canônica e porta reservada.

## Deploy (Supabase + Vercel)

1) **Supabase (Postgres)**
- Crie um projeto dedicado e execute `db/postgres_schema.sql` no SQL Editor.
- Importe `bases_csv/*.csv` para `urede_cooperativas`, `urede_cidades`, `urede_operadores` (via `COPY` ou UI).

2) **Supabase Edge Function (API)**
- Use `supabase/functions/api/index.ts` como entrypoint.
- Variaveis recomendadas:
  - `DB_DRIVER=postgres`
  - `DATABASE_DB_URL=postgresql://...` (use string com `sslmode=require`)
  - `DB_SCHEMA=public`
  - `TABLE_PREFIX=urede_`
  - `JWT_SECRET=...`
  - `APP_URL=https://<seu-app>.vercel.app`
  - `ALLOWED_ORIGINS=https://<seu-app>.vercel.app,https://<preview>.vercel.app`
  - `BREVO_*` (opcional, para e-mails transacionais)

3) **Vercel (Frontend)**
- Configure `VITE_API_BASE_URL=https://<projeto>.supabase.co/functions/v1/api`.
- Deploy normalmente (`npm run build`).

4) **Escalonamento (cron)**
- Agende POST `/` com header `x-cron: true` e body `{ "task": "escalar" }`.

## Estrutura relevante

- `scripts/create-sqlite-db.sh`: cria o banco local lendo `db/sqlite_schema.sql`.
- `scripts/import-csv-sqlite.sh`: importa CSVs de `bases_csv/` para as tabelas `urede_*`.
- `database/functions/server/index.tsx`: API Hono (Deno) acessando SQLite diretamente.
- `src/utils/api/client.ts`: helper de requests autenticadas (JWT local em `localStorage`).
- `db/sqlite_schema.sql`: schema das tabelas locais.

## Observações

- O projeto não depende mais de serviços externos. Todo acesso é local (SQLite).
- Para agendamentos, use um scheduler externo que faça POST `/` com header `x-cron: true` e body `{ "task": "escalar" }`.

## Navegação Modular (UHub / URede / UDocs / UMarketing / Ufast)

Escopo vigente da separação modular:
- **UHub (compartilhado/global)**: Homepage do hub, `Central de Apps`, `Cooperativas`, `Cidades`.
- **UHub (admin)**: `Usuários` (`operadores`) e `Gestão de dados` (`gestao_dados`) como subitens de `Configurações`.
- **Módulo URede (específico)**: `Dashboard`, `Relatórios`, `Pedidos` e `Pedidos em lote` (`importacao`), incluindo ações de `Novo pedido`.
- **Módulo UDocs (específico)**: biblioteca digital institucional para consumo de arquivos e registros históricos.
- **Módulo UMarketing (específico)**: frente institucional de comunicação e marketing.
- **Módulo Ufast (específico)**: acesso à Câmara de Compensação.
- O controle de acesso por usuário usa `modulos_acesso` com os módulos: `central_apps`, `urede`, `udocs`, `umarketing` e `ufast`.
- `Configurações` é contextual por módulo:
  - Hub: `/hub/configuracoes` (cadastros globais de dados cadastrais).
  - URede: `/urede/configuracoes` (fluxo de aprovação e categorias de pedidos).
- Apenas **Administrador da Confederação** pode alterar as configurações de módulo.
- Para perfil `admin`, os subitens `Usuários` e `Gestão de dados` em `Configurações` aparecem no contexto Hub.

Rotas canônicas desta fase:
- Hub: `/hub`, `/hub/apps`, `/hub/apps/propostas`, `/hub/apps/assinatura-email`, `/hub/cooperativas`, `/hub/cidades`, `/hub/configuracoes`, `/hub/usuarios`, `/hub/gestao-dados`
- URede: `/urede/dashboard`, `/urede/relatorios`, `/urede/pedidos`, `/urede/importacao`, `/urede/configuracoes`
- UDocs: `/udocs/dashboard`
- UMarketing: `/umarketing/dashboard`
- Ufast: `/ufast/dashboard`
- Compatibilidade: rotas legadas continuam sendo aceitas e mapeadas para o módulo correspondente.
- Branding da autenticação: a tela de login usa identidade visual UHub.

## Gestão de Usuários (Singulares)

- Cadastro e edição de usuários (`Operadores`) permitem vincular **uma ou mais singulares**.
- O campo `id_singular` representa a **singular principal** do usuário.
- Os vínculos adicionais são persistidos em `auth_user_cooperativas` (`user_email`, `cooperativa_id`, `is_primary`).
- Na listagem de usuários, a coluna de cooperativa exibe resumo de múltiplos vínculos.
- Na edição de usuário, a ação de redefinir credencial é explícita via botão **Definir senha provisória**.

## Backup Automático do Banco

- O repositório inclui hook de `pre-push` em `.githooks/pre-push`.
- O hook executa `scripts/backup-db.sh` e gera snapshot em `backups/db/` antes de cada push.
- Ative no clone local com:
  - `git config core.hooksPath .githooks`

## Padrão de Telefone (Regra de Dados)

Regra vigente do sistema (cadastros e importações):
- Usar um único campo `telefone` (string com somente dígitos).
- Usar `wpp` (boolean/integer 0/1) para indicar se o telefone também atende por WhatsApp.
- Colunas legadas (`telefone_fixo`, `telefone_celular`, `whatsapp` texto) permanecem apenas para compatibilidade.

Formatação no frontend (Brasil):
- Celular: `(DD) 9 0000-0000` (11 dígitos, 3º dígito = 9).
- Fixo: `(DD) 0000-0000` (10 dígitos).
- 0800: `0800 0000 0000` (quando vier com 12 dígitos).

Migração aplicada:
- `db/migrations/sqlite/20260213_015_telefone_unificado_wpp.sql`
- `db/migrations/sqlite/20260213_016_operadores_telefone_wpp.sql`
- `db/migrations/sqlite/20260213_017_pessoas_unificadas.sql`

Unificação de cadastros de pessoas:
- Entidade central: `urede_pessoas`
- Vínculos por cooperativa/categoria: `urede_pessoa_vinculos` (com `id_singular`)
- Mapeamento opcional de login: `urede_pessoa_usuarios`
- Tabelas legadas de pessoas seguem ativas para compatibilidade durante a transição.

## Endereços (Visão Geral e Plantão)

- A aba `Endereços` em cooperativas é o ponto principal de CRUD cadastral.
- O campo `exibir_visao_geral` (0/1) controla se cada endereço aparece na aba `Visão Geral`.
- Endereços de tipo `plantao_urgencia_emergencia` são sincronizados com `cooperativa_plantao_clinicas` para apoiar cadastro único entre `Endereços` e `Urgência & Emergência`.

## Configurações do Hub (cadastros globais)

- As configurações do Hub incluem catálogos globais usados em dados cadastrais:
  - `tipos_endereco`
  - `tipos_conselho`
  - `tipos_contato`
  - `subtipos_contato`
  - `redes_sociais`
  - `departamentos`
- Esses catálogos são persistidos em `settings` (`system_preferences`) e consumidos em cadastros auxiliares de cooperativas.

Administração:
- O menu `Usuários` (antes `Responsáveis`) e `Gestão de dados` ficam dentro de `Configurações`.
- Ambos são visíveis apenas para perfis `admin`.
