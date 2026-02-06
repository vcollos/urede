# AGENTS.md

## Contexto rapido
Este repositorio foi atualizado para operar no Supabase/Postgres com schema `urede`, mantendo compatibilidade com o legado via `COALESCE`. Foi adicionada UI para dados institucionais e consulta publica de prestadores.

## O que mudou (resumo)
- **Backend**
  - Queries qualificadas com `urede.<tabela>` no Postgres.
  - `reg_ans` passou a ser identificador canonico.
  - JWT inclui `cooperativa_id` e `papel_usuario` (`admin | operador`).
  - Soft delete em pedidos (`excluido=1`, `status=cancelado`).
  - Endpoints novos:
    - `/institucional/:table` (GET/POST/PUT/DELETE)
    - `/prestadores` e `/prestadores/ans` (consulta publica)
- **Frontend**
  - Aba Institucional na tela de Cooperativas (CRUD com permissao admin por escopo).
  - Tela de Prestadores (busca publica).
  - Campos padronizados usados em Cooperativas/Cidades/Operadores.
- **Docs**
  - `documentação/migracao-supabase.md`
  - `documentação/rls-resumo.md`
  - `documentação/checklist-producao.md`
  - `db/migrations/README.md` + `db/migrations/sanity-check.sql`

## Arquivos principais tocados
- `database/functions/server/index.tsx`
- `database/functions/server/lib/jwt.ts`
- `src/components/CooperativasView.tsx`
- `src/components/InstitutionalSection.tsx`
- `src/components/PrestadoresView.tsx`
- `src/components/CidadesView.tsx`
- `src/components/OperadoresLista.tsx`
- `src/components/RegisterForm.tsx`
- `src/components/Layout.tsx`
- `src/App.tsx`
- `src/services/apiService.ts`
- `src/types/index.ts`
- `documentação/*.md`
- `db/migrations/*`

## Variaveis de ambiente essenciais (Supabase)
```
DB_DRIVER=postgres
DATABASE_DB_URL=postgresql://postgres:<SENHA>@db.<project>.supabase.co:5432/postgres?sslmode=require
DB_SCHEMA=urede
TABLE_PREFIX=urede_
JWT_SECRET=<segredo-local>
APP_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
VITE_API_BASE_URL=http://127.0.0.1:8300
```

## Regras de negocio relevantes
- Papel de usuario = `admin | operador`. Nivel institucional vem de `cooperativas.papel_rede`.
- `reg_ans` eh canonico (normalize nomes antigos).
- Pedidos: visibilidade controlada por RLS; delete eh soft.
- Dados institucionais: leitura global; escrita apenas admin no escopo.

## Como testar (local + Supabase)
1. `npm i`
2. `npm run server:dev`
3. `npm run dev`
4. Testes:
   - `curl http://127.0.0.1:8300/health`
   - `curl http://127.0.0.1:8300/cooperativas/public`

## Observacoes para proximos agentes
- Se precisar validar dados, use `db/migrations/sanity-check.sql`.
- Para RLS, ver `documentação/rls-resumo.md`.
- Ajuste `DB_SCHEMA=urede` em qualquer ambiente Postgres.
