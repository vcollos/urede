# Migrations (documentacao)

Este diretorio documenta o que ja foi aplicado no Supabase. Nao reexecutar scripts destrutivos.

## Ordem aplicada (referencia)
1. `db/postgres_schema.sql`
   - Base do schema legado (urede_*), ajustado para Postgres.
2. Ajustes no Supabase (SQL Editor)
   - Criacao do schema `urede`.
   - Tabelas institucionais (`cooperativa_*`, `plantao_*`).
   - Tabelas de prestadores (`prestadores_ans`, `prestadores`, `prestador_vinculos_singulares`).
   - `auth_users` e `user_approval_requests` no schema `urede`.
3. RLS e politicas
   - Regras de leitura global e escrita por hierarquia.

## Arquivos auxiliares
- `db/migrations/sanity-check.sql`: consultas de validacao basica.
