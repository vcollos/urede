
  # Credenciamento e Suprimento App

  This is a code bundle for Credenciamento e Suprimento App. The original project is available at https://www.figma.com/design/PoPiLPmlEQrHsywSlkMLNe/Credenciamento-e-Suprimento-App.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Deploy na Vercel

  Este projeto é um SPA (Vite + React) que consome uma Edge Function do Supabase. Para publicar na Vercel:

  1) Variáveis de ambiente (Vercel → Project Settings → Environment Variables)
  - `VITE_SUPABASE_URL` = URL do projeto Supabase (ex.: `https://<project-ref>.supabase.co`)
  - `VITE_SUPABASE_ANON_KEY` = Anon Key do seu projeto
  - `VITE_API_BASE_URL` = `https://<project-ref>.supabase.co/functions/v1/server`
  - (opcional) `VITE_APP_ENV` = `production`

  2) Edge Function no Supabase (Backend)
  - Secrets da função (Dashboard → Project Settings → Functions → Secrets):
    - `SUPABASE_URL` = `https://<project-ref>.supabase.co`
    - `SUPABASE_SERVICE_ROLE_KEY` = Service Role Key do projeto
  - Deploy da função `server` (na raiz do repo):
    ```bash
    supabase login
    supabase functions deploy server --project-ref <project-ref>
    ```
  - A função já está configurada com `verify_jwt = false` (arquivo `supabase/functions/server/supabase.toml`).
    As rotas sensíveis continuam protegidas pelo middleware de autenticação do próprio código.

  3) Banco de dados (no Supabase Studio → SQL Editor)
  - Execute:
    - `supabase/migrations/001_initial_schema.sql`
    - `supabase/seed_dev.sql`

  4) Publicar na Vercel
  - Conecte o repositório na Vercel
  - O arquivo `vercel.json` já instrui a Vercel a usar `@vercel/static-build` e servir o SPA a partir da pasta `build`
  - Build Command: `npm run build` (padrão)
  - Output directory: `build`

  5) Testes rápidos (produção)
  - Rota pública (não exige login):
    `curl -i -H "apikey: $VITE_SUPABASE_ANON_KEY" "https://<project-ref>.supabase.co/functions/v1/server/cooperativas/public"`
  - Aplicação: acesse a URL gerada pela Vercel, faça Registro/Login e verifique a aba Cooperativas.

  Observações
  - Se preferir JWT obrigatório em produção, mude `verify_jwt = true` e faça o deploy da função. O frontend já envia o token do usuário autenticado.
  - Para desenvolvimento local do backend sem Docker, use `npm run server:dev` (Deno) e aponte `VITE_API_BASE_URL` para `http://127.0.0.1:8000`.
  
