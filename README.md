
# Credenciamento e Suprimento App

Este projeto agora está configurado para rodar somente com SQLite local (sem depender de Supabase/Postgres). O backend é uma API em Deno/Hono que acessa um arquivo SQLite, e o frontend (Vite + React) consome essa API via `VITE_API_BASE_URL`.

## Rodar localmente (SQLite)

1) Instale dependências do frontend
- `npm i`

2) Crie e popule o banco SQLite
- `bash scripts/create-sqlite-db.sh`
- `bash scripts/import-csv-sqlite.sh`

3) Configure o frontend para apontar para o backend local
- Arquivo `.env` já contém `VITE_API_BASE_URL=http://127.0.0.1:8000`

4) Suba o backend (Deno)
- `npm run server:dev`

5) Suba o frontend
- `npm run dev`

Testes rápidos:
- Health: `curl http://127.0.0.1:8000/health`
- Cooperativas públicas: `curl http://127.0.0.1:8000/cooperativas/public`

Notas:
- Rotas protegidas usam JWT local (gerado pelo próprio backend em `/auth/register` e `/auth/login`).
- Tabelas do SQLite usam prefixo `urede_`. Os CSVs em `bases_csv/` alimentam `urede_cooperativas`, `urede_cidades` e `urede_operadores`.

## Estrutura relevante

- `scripts/create-sqlite-db.sh`: cria o banco local lendo `db/sqlite_schema.sql`.
- `scripts/import-csv-sqlite.sh`: importa CSVs de `bases_csv/` para as tabelas `urede_*`.
- `supabase/functions/server/index.tsx`: API Hono (Deno) acessando SQLite diretamente.
- `src/utils/api/client.ts`: helper de requests autenticadas (JWT local em `localStorage`).
- `db/sqlite_schema.sql`: schema das tabelas locais.

## Observações

- O projeto não depende mais de serviços externos. Todo acesso é local (SQLite).
- Para agendamentos, use um scheduler externo que faça POST `/` com header `x-cron: true` e body `{ "task": "escalar" }`.
