# Sistema de Gestão de Credenciamento Uniodonto
## Documentação Técnica Completa para Deploy Externo

---

## 📋 Índice

- [1. Visão Geral do Sistema](#1-visão-geral-do-sistema)
- [2. Arquitetura Técnica](#2-arquitetura-técnica)
- [3. Stack Tecnológico](#3-stack-tecnológico)
- [4. Requisitos do Sistema](#4-requisitos-do-sistema)
- [5. Configuração do Ambiente](#5-configuração-do-ambiente)
- [6. Instalação Passo a Passo](#6-instalação-passo-a-passo)
- [7. Configuração do Supabase](#7-configuração-do-supabase)
- [8. Deploy em Diferentes Plataformas](#8-deploy-em-diferentes-plataformas)
- [9. Estrutura de Arquivos](#9-estrutura-de-arquivos)
- [10. Variáveis de Ambiente](#10-variáveis-de-ambiente)
- [11. Scripts de Configuração](#11-scripts-de-configuração)
- [12. Monitoramento e Logs](#12-monitoramento-e-logs)
- [13. Troubleshooting](#13-troubleshooting)

—

## 0. Estado Atual (Set/2025)

Este capítulo descreve, com precisão, o estado atual do sistema em produção/homologação, domínios, integrações, autenticação e RBAC, endpoints, CORS e banco de dados real usado.

### 0.1 Ambientes e URLs
- Frontend (Vercel, produção):
  - Produção: `https://urede.vercel.app`
  - Previews: `https://urede-git-main-vcollos-projects.vercel.app` e subdomínios dinâmicos `*.vercel.app`
- Backend (API, Deno Deploy):
  - Produção: `https://urede.deno.dev`
- Supabase (Projeto):
  - URL: `https://ddvpxxgdlqwmfugmdnvq.supabase.co`
  - Banco: PostgreSQL gerenciado (dados reais), sem KV.

### 0.2 Autenticação e RBAC
- Login obrigatório para visualizar dados e operar (frontend exige sessão Supabase Auth JWT).
- JWT validado no backend chamando `supabase.auth.getUser(access_token)`.
- RBAC atual (servidor):
  - operador: vê pedidos criados pela sua cooperativa (cooperativa_solicitante_id == sua cooperativa) e pedidos que ele criou (criado_por == seu id)
  - federacao: vê pedidos em nível federação/confederação e os direcionados à sua federação
  - confederacao/admin: visão global
- Identidade do usuário no banco: buscada em `urede_operadores` por email (fallback por id). O registro deve conter `id_singular` (cooperativa) e `status=true`.

### 0.3 CORS (origens permitidas)
- Controlado por `ALLOWED_ORIGINS` no Deno Deploy. Suporta lista separada por vírgulas e wildcard `*.dominio.com`.
- Recomendações atuais:
  - Produção: `https://urede.vercel.app`
  - Previews: `*.vercel.app`
  - Local (opcional): `http://localhost:5173`

### 0.4 Variáveis de Ambiente (atuais)
- Deno Deploy (backend):
  - `SUPABASE_URL=https://ddvpxxgdlqwmfugmdnvq.supabase.co`
  - `SERVICE_ROLE_KEY=<service role key>` (NUNCA expor no cliente)
  - `DB_SCHEMA=public`
  - `TABLE_PREFIX=urede_` (padrão já é `urede_` mesmo sem setar)
  - `ALLOWED_ORIGINS=https://urede.vercel.app,*.vercel.app`
  - `PUBLIC_PEDIDOS` (opcional; hoje sem necessidade pois o frontend usa endpoints protegidos)
- Vercel (frontend):
  - `VITE_API_BASE_URL=https://urede.deno.dev`
  - `VITE_SUPABASE_URL=https://ddvpxxgdlqwmfugmdnvq.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=<anon key>`

### 0.5 Endpoints (API Hono em Deno Deploy)
- Health/Debug (públicos):
  - `GET /health` → `{ status: 'ok' }`
  - `GET /debug/counts` → contagem de linhas por tabela (ajuda ver conectividade/prefixo/schema)
- Autenticação (protegidos por JWT):
  - `POST /auth/register` → cria usuário no Auth; não grava em tabelas locais.
  - `GET /auth/me` → dados do operador (mapeados de `urede_operadores`).
- Cooperativas:
  - `GET /cooperativas` (protegido) → lê `urede_cooperativas`, mapeia CAIXA_ALTA → camel.
  - `GET /cooperativas/public` (público) → mesmo payload; útil para tela de registro.
- Cidades:
  - `GET /cidades` (protegido)
  - `GET /cidades/public` (público)
- Operadores:
  - `GET /operadores` (protegido)
  - `GET /operadores/public` (público, campos restritos: id, nome, cargo, id_singular, ativo, data_cadastro)
- Pedidos:
  - `GET /pedidos` (protegido + RBAC): retorna também `cidade_nome`, `estado`, `cooperativa_solicitante_nome`, `dias_restantes`.
  - `POST /pedidos` (protegido): cria registro em `urede_pedidos`; response já enriquecida (nomes + `dias_restantes`).
  - `PUT /pedidos/:id` (protegido): update com whitelist de colunas; response enriquecida.
  - `GET /pedidos/:id/auditoria` (protegido): opcional — se tabela `auditoria_logs` inexistente, apenas loga aviso.
  - `POST /admin/escalar-pedidos` (protegido + admin): escalonamento automático por SLA.
  - `GET /pedidos/public` (público, sanitizado; desabilitado por padrão no frontend).
- Dashboard:
  - `GET /dashboard/stats` (protegido): estatísticas filtradas por RBAC.

### 0.6 Banco de Dados (real, Supabase)
- Schema atual: `public` (configurável via `DB_SCHEMA`).
- Prefixo de tabelas: `urede_` (configurável via `TABLE_PREFIX`).
- Tabelas usadas:
  - `urede_cidades(CD_MUNICIPIO_7, CD_MUNICIPIO, REGIONAL_SAUDE, NM_CIDADE, UF_MUNICIPIO, NM_REGIAO, CIDADES_HABITANTES, ID_SINGULAR)`
  - `urede_cooperativas(id_singular, UNIODONTO, CNPJ, CRO_OPERAORA, DATA_FUNDACAO, RAZ_SOCIAL, CODIGO_ANS, FEDERACAO, SOFTWARE, TIPO, OP_PR)`
  - `urede_operadores(id BIGINT, created_at, nome, id_singular, email, telefone, whatsapp, cargo, status)`
  - `urede_pedidos(id UUID, titulo, criado_por BIGINT, cooperativa_solicitante_id TEXT, cooperativa_responsavel_id TEXT, cidade_id TEXT, especialidades TEXT[], quantidade INT, observacoes TEXT, prioridade TEXT, nivel_atual TEXT, status TEXT, data_criacao TIMESTAMPTZ, data_ultima_alteracao TIMESTAMPTZ, prazo_atual TIMESTAMPTZ)`
- Observações de mapeamento:
  - Cooperativas: `CRO_OPERAORA` (typo no nome da coluna) é mapeada para `cro_operadora` no payload.
  - Operadores: `status` → `ativo`, `created_at` → `data_cadastro`.
  - Enriquecimento de pedidos: usa chaves `cidade_id` → `urede_cidades.CD_MUNICIPIO_7` e `cooperativa_solicitante_id` → `urede_cooperativas.id_singular`.

### 0.7 Requisitos para RBAC funcionar
- O email do usuário autenticado deve existir em `urede_operadores.email` com `status = true` e `id_singular` preenchido.
- Sem esse vínculo, `/pedidos` pode retornar vazio (por filtro de RBAC) ou falhar em criação.

### 0.8 Known Issues (e mitigação)
- Erro “A custom element with name 'mce-autosize-textarea' has already been defined.”
  - Causa provável: redefinição de webcomponents por extensão do navegador/polyfill externo (não há TinyMCE no projeto).
  - Mitigação aplicada: guard em `index.html` para ignorar redefinições duplicadas em `customElements.define` e não quebrar a app.
  - Ação recomendada se persistir: testar em janela anônima (sem extensões), identificar pelo DevTools a origem do script conflituoso, e, se necessário, filtrar carregamento em produção.

### 0.9 Como diagnosticar rápido
- `GET https://urede.deno.dev/debug/counts` → verifica conectividade e contagens.
- Se CORS bloquear no Vercel: adicionar `https://urede.vercel.app` e `*.vercel.app` em `ALLOWED_ORIGINS` e redeploy no Deno Deploy.
- Se `/pedidos` retornar []: verificar `urede_pedidos` (vazia) e se o operador logado está em `urede_operadores` com email/id_singular corretos.

---

## 1. Visão Geral do Sistema

### 1.1 Descrição
Sistema completo de gestão de credenciamento para rede Uniodonto, centralizando pedidos entre Singulares → Federação → Confederação com SLA de 30 dias por nível e roteamento automático por área de ação.

### 1.2 Funcionalidades Principais
- ✅ **Gestão de Pedidos**: Criação, edição, visualização e escalonamento automático
- ✅ **Autenticação JWT**: Login/logout com diferentes perfis de acesso
- ✅ **RBAC (Role-Based Access Control)**: admin, operador, federacao, confederacao
- ✅ **Dashboard Analytics**: Métricas em tempo real com gráficos
- ✅ **Gestão de Cooperativas**: Visualização de 112+ cooperativas reais
- ✅ **Gestão de Cidades**: Acesso a 5500+ cidades brasileiras
- ✅ **Gestão de Operadores**: CRUD completo de usuários
- ✅ **Auditoria Completa**: Log de todas as ações do sistema
- ✅ **Escalonamento Automático**: Cron jobs para verificar prazos SLA
- ✅ **Interface Moderna**: Kanban/Trello-like com componentes shadcn/ui

---

## 2. Arquitetura Técnica

### 2.1 Arquitetura Geral
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Frontend     │────│     Backend     │────│   Database      │
│   React/TS      │    │ Supabase Edge   │    │  PostgreSQL     │
│   Tailwind      │    │ Functions/Hono  │    │  (100% SQL)     │
│   shadcn/ui     │    │      JWT        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 2.2 Fluxo de Dados
1. **Frontend**: React + TypeScript + Tailwind CSS
2. **API Layer**: Supabase Edge Functions com Hono
3. **Authentication**: JWT + Supabase Auth
4. **Database**: PostgreSQL (dados reais, sem KV)
5. **Real-time**: Supabase Realtime subscriptions

### 2.3 Estratégia de Deploy
- **Frontend**: Build estático servido por Nginx/Apache
- **Backend**: Supabase Edge Functions (serverless)
- **Database**: Supabase PostgreSQL gerenciado
- **CDN**: Opcional para assets estáticos

---

## 3. Stack Tecnológico

### 3.1 Frontend Dependencies
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@supabase/supabase-js": "^2.38.0",
    "lucide-react": "latest",
    "recharts": "^2.8.0",
    "react-hook-form": "^7.55.0",
    "sonner": "^2.0.3",
    "motion": "latest",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^4.4.0",
    "tailwindcss": "^4.0.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0"
  }
}
```

### 3.2 Backend Dependencies (Supabase Edge Functions)
```json
{
  "dependencies": {
    "hono": "^4.4.12",
    "@supabase/supabase-js": "^2.38.0"
  }
}
```

### 3.3 UI Components Library
- **shadcn/ui**: 50+ componentes React com Tailwind CSS
- **Lucide React**: 1000+ ícones SVG
- **Recharts**: Biblioteca de gráficos para React
- **Motion**: Animações modernas (successor do Framer Motion)

---

## 4. Requisitos do Sistema

### 4.1 Servidor (VPS/Cloud)
**Mínimo:**
- **CPU**: 1 vCore
- **RAM**: 2GB
- **Storage**: 20GB SSD
- **Bandwidth**: 1TB/mês
- **OS**: Ubuntu 20.04+ LTS

**Recomendado:**
- **CPU**: 2 vCore
- **RAM**: 4GB
- **Storage**: 40GB SSD
- **Bandwidth**: Ilimitado
- **OS**: Ubuntu 22.04 LTS

### 4.2 Software Prerequisites
```bash
# Node.js 18+
node --version  # v18.0.0+
npm --version   # 9.0.0+

# Supabase CLI
supabase --version  # 1.100.0+

# Nginx (Web Server)
nginx -v  # nginx/1.18.0+

# PM2 (Process Manager)
pm2 --version  # 5.0.0+

# Git
git --version  # 2.34.0+
```

---

## 5. Configuração do Ambiente

### 5.1 Preparação do Servidor Ubuntu

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependências básicas
sudo apt install -y curl wget git unzip build-essential

# Instalar Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalação
node --version
npm --version

# Instalar PM2 globalmente
sudo npm install -g pm2

# Instalar Nginx
sudo apt install -y nginx

# Configurar firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 80
sudo ufw allow 443
```

### 5.2 Instalação Supabase CLI

```bash
# macOS (Homebrew)
brew update && brew install supabase/tap/supabase
supabase --version

# Linux (binário)
curl -fsSL https://cli.supabase.com/install/linux | sh
supabase --version

# Login no Supabase (necessário token)
supabase login
```

---

## 6. Instalação Passo a Passo

### 6.1 Clone e Configuração do Projeto

```bash
# Criar diretório do projeto
sudo mkdir -p /var/www/uniodonto-sistema
sudo chown -R $USER:$USER /var/www/uniodonto-sistema
cd /var/www/uniodonto-sistema

# Inicializar projeto React + TypeScript
npm create vite@latest frontend -- --template react-ts
cd frontend

# Instalar dependências principais
npm install @supabase/supabase-js@^2.38.0
npm install lucide-react recharts
npm install react-hook-form@7.55.0
npm install sonner@2.0.3
npm install motion
npm install class-variance-authority clsx tailwind-merge

# Instalar Tailwind CSS v4
npm install tailwindcss@next @tailwindcss/vite@next
npm install autoprefixer postcss

# Dev dependencies
npm install -D @types/node
```

### 6.2 Configuração Tailwind CSS v4

**vite.config.ts**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
```

**tailwind.config.ts**
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
```

### 6.3 Estrutura de Diretórios

```bash
# Criar estrutura completa
mkdir -p src/{components/{ui,figma},contexts,services,types,utils/supabase,styles}
mkdir -p supabase/functions/server
mkdir -p data guidelines

# Arquivos principais
touch src/{App.tsx,main.tsx}
touch src/styles/globals.css
touch src/types/index.ts
touch src/contexts/AuthContext.tsx
touch src/services/{apiService.ts,authService.ts}
touch src/utils/supabase/{client.ts,info.tsx}
touch supabase/functions/server/index.tsx
```

---

### 6.4 Desenvolvimento Local

```bash
# 1) Servir a Edge Function (usa seu banco remoto)
supabase functions serve server --env-file supabase/functions/server/.env

# Porta alternativa, se necessário
# supabase functions serve server --env-file supabase/functions/server/.env --port 5500

# 2) Rodar o frontend (Vite em 3400)
npm install
npm run dev

# 3) Ajustar o .env do frontend para apontar para a API local
# VITE_API_BASE_URL=http://127.0.0.1:54321/functions/v1/server/make-server-96c6e32f
```

Observação: se preferir usar a função remota, faça o deploy (7.4) e aponte
o `VITE_API_BASE_URL` para `https://<project>.supabase.co/functions/v1/server/make-server-96c6e32f`.

---

## 7. Configuração do Supabase

### 7.1 Criar Projeto Supabase

```bash
# Inicializar projeto Supabase local
cd /var/www/uniodonto-sistema
supabase init

# Configurar projeto remoto
supabase link --project-ref YOUR_PROJECT_REF
```

### 7.2 Database Schema

**Migration SQL (execute no Supabase Dashboard):**
```sql
-- Tabela de cooperativas
CREATE TABLE cooperativas (
    id_singular VARCHAR PRIMARY KEY,
    uniodonto VARCHAR NOT NULL,
    cnpj VARCHAR,
    cro_operadora VARCHAR,
    data_fundacao DATE,
    raz_social VARCHAR,
    codigo_ans VARCHAR,
    federacao VARCHAR,
    software VARCHAR,
    tipo VARCHAR CHECK (tipo IN ('SINGULAR', 'FEDERAÇÃO', 'CONFEDERACAO')),
    op_pr VARCHAR,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de cidades  
CREATE TABLE cidades (
    cd_municipio_7 VARCHAR PRIMARY KEY,
    cd_municipio VARCHAR,
    regional_saude VARCHAR,
    nm_cidade VARCHAR NOT NULL,
    uf_municipio VARCHAR(2),
    nm_regiao VARCHAR,
    cidades_habitantes INTEGER,
    id_singular VARCHAR REFERENCES cooperativas(id_singular),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de usuários do sistema
CREATE TABLE usuarios_sistema (
    id UUID PRIMARY KEY,
    nome VARCHAR NOT NULL,
    display_name VARCHAR,
    email VARCHAR UNIQUE NOT NULL,
    telefone VARCHAR,
    whatsapp VARCHAR,
    cargo VARCHAR,
    cooperativa_id VARCHAR REFERENCES cooperativas(id_singular),
    papel VARCHAR CHECK (papel IN ('admin', 'operador', 'federacao', 'confederacao')),
    ativo BOOLEAN DEFAULT true,
    data_cadastro TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de pedidos
CREATE TABLE pedidos (
    id VARCHAR PRIMARY KEY,
    titulo VARCHAR NOT NULL,
    criado_por UUID REFERENCES usuarios_sistema(id),
    cooperativa_solicitante_id VARCHAR REFERENCES cooperativas(id_singular),
    cooperativa_responsavel_id VARCHAR REFERENCES cooperativas(id_singular),
    cidade_id VARCHAR REFERENCES cidades(cd_municipio_7),
    especialidades JSONB,
    quantidade INTEGER,
    observacoes TEXT,
    nivel_atual VARCHAR CHECK (nivel_atual IN ('singular', 'federacao', 'confederacao')),
    prazo_atual TIMESTAMP,
    status VARCHAR CHECK (status IN ('novo', 'em_andamento', 'concluido', 'cancelado')),
    prioridade VARCHAR CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
    responsavel_atual_id UUID REFERENCES usuarios_sistema(id),
    responsavel_atual_nome VARCHAR,
    data_criacao TIMESTAMP DEFAULT NOW(),
    data_ultima_alteracao TIMESTAMP DEFAULT NOW()
);

-- Tabela de auditoria
CREATE TABLE auditoria_logs (
    id VARCHAR PRIMARY KEY,
    pedido_id VARCHAR REFERENCES pedidos(id),
    usuario_id UUID REFERENCES usuarios_sistema(id),
    usuario_nome VARCHAR,
    acao VARCHAR NOT NULL,
    detalhes TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_pedidos_status ON pedidos(status);
CREATE INDEX idx_pedidos_nivel ON pedidos(nivel_atual);
CREATE INDEX idx_pedidos_cooperativa ON pedidos(cooperativa_responsavel_id);
CREATE INDEX idx_auditoria_pedido ON auditoria_logs(pedido_id);
CREATE INDEX idx_auditoria_usuario ON auditoria_logs(usuario_id);
CREATE INDEX idx_cidades_singular ON cidades(id_singular);
```

### 7.3 Row Level Security (RLS)

```sql
-- Habilitar RLS
ALTER TABLE usuarios_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para usuários_sistema
CREATE POLICY "Usuários podem ver próprio perfil" ON usuarios_sistema
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins podem ver todos usuários" ON usuarios_sistema
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM usuarios_sistema 
            WHERE id = auth.uid() AND papel = 'admin'
        )
    );

-- Políticas para pedidos (implementar conforme regras de negócio)
CREATE POLICY "Ver pedidos por papel" ON pedidos
    FOR SELECT TO authenticated
    USING (true); -- Implementar lógica de RBAC aqui

-- Políticas para auditoria
CREATE POLICY "Ver própria auditoria" ON auditoria_logs
    FOR SELECT TO authenticated  
    USING (usuario_id = auth.uid());
```

### 7.4 Edge Functions

**supabase/functions/server/index.tsx**: API em Hono acessando apenas PostgreSQL (sem KV). Rotas principais sob o prefixo:

- Base: `/functions/v1/server/make-server-96c6e32f`
- Públicas: `GET /cooperativas/public`
- Autenticadas: `/cooperativas`, `/cidades`, `/operadores`, `/pedidos`, `/pedidos/:id/auditoria`, `/dashboard/stats`, `/admin/escalar-pedidos`

Deploy das funções:
```bash
# Deploy da função
supabase functions deploy server

# Verificar logs
supabase functions logs server
```

---

## 8. Deploy em Diferentes Plataformas

### 8.1 VPS Ubuntu (Hostinger/DigitalOcean/Linode)

#### 8.1.1 Build do Frontend
```bash
cd /var/www/uniodonto-sistema/frontend

# Build de produção
npm run build

# Verificar build
ls -la dist/
```

#### 8.1.2 Configuração Nginx

**/etc/nginx/sites-available/uniodonto**
```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;
    root /var/www/uniodonto-sistema/frontend/dist;
    index index.html index.htm;

    # Configuração para SPA (Single Page Application)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache para assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Configurações de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval'" always;

    # Compressão
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;
}
```

#### 8.1.3 Habilitar Site e SSL

```bash
# Habilitar site
sudo ln -s /etc/nginx/sites-available/uniodonto /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Instalar Certbot para SSL
sudo apt install -y certbot python3-certbot-nginx

# Configurar SSL
sudo certbot --nginx -d seu-dominio.com -d www.seu-dominio.com

# Auto-renovação
sudo systemctl enable certbot.timer
```

### 8.2 Google Cloud Platform (GCP)

#### 8.2.1 App Engine
**app.yaml**
```yaml
runtime: nodejs18
service: default

env_variables:
  NODE_ENV: production
  VITE_SUPABASE_URL: https://your-project.supabase.co
  VITE_SUPABASE_ANON_KEY: your-anon-key

handlers:
  - url: /static
    static_dir: dist/static
    secure: always

  - url: /.*
    static_files: dist/index.html
    upload: dist/index.html
    secure: always
```

**Deploy:**
```bash
# Instalar gcloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init

# Deploy
gcloud app deploy
```

#### 8.2.2 Cloud Run
**Dockerfile**
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Deploy:**
```bash
# Build e push
gcloud builds submit --tag gcr.io/PROJECT-ID/uniodonto-sistema

# Deploy no Cloud Run
gcloud run deploy uniodonto-sistema \
  --image gcr.io/PROJECT-ID/uniodonto-sistema \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### 8.3 AWS (Amazon Web Services)

#### 8.3.1 S3 + CloudFront (Estático)
```bash
# Instalar AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configurar credenciais
aws configure

# Criar bucket S3
aws s3 mb s3://uniodonto-sistema-frontend

# Upload do build
aws s3 sync dist/ s3://uniodonto-sistema-frontend --delete

# Configurar website estático
aws s3 website s3://uniodonto-sistema-frontend \
  --index-document index.html \
  --error-document index.html
```

#### 8.3.2 EC2 (Servidor Completo)
```bash
# Conectar via SSH
ssh -i your-key.pem ec2-user@your-instance-ip

# Instalar dependências (Amazon Linux 2)
sudo yum update -y
sudo yum install -y nodejs npm nginx git

# Seguir os mesmos passos do Ubuntu
# (ajustar comandos para yum ao invés de apt)
```

### 8.4 Vercel (Deploy Rápido)

**vercel.json**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**Deploy:**
```bash
# Instalar Vercel CLI
npm install -g vercel

# Deploy
vercel

# Configurar domínio personalizado
vercel domains add seu-dominio.com
```

### 8.2 Cloudflare Tunnel (Domínio custom no local)

Recomendado para expor o ambiente local com HTTPS.

Opção A (subdomínios):
- `app.seu-dominio.com.br` → `http://localhost:3400`
- `api.seu-dominio.com.br` → `http://localhost:54321`

Passos (no painel do Cloudflare Tunnel crie o túnel e os dois mapas):
- App aponta para a porta do Vite (3400)
- API aponta para a porta do Supabase Functions serve (54321 ou a escolhida)

Ajuste no `.env` do frontend:
```
VITE_API_BASE_URL=https://api.seu-dominio.com.br/functions/v1/server/make-server-96c6e32f
```

Opção B (domínio único):
- `seu-dominio.com.br` → encaminhar `/functions/v1/*` para a porta da API e o restante para o Vite.

---

## 9. Estrutura de Arquivos

### 9.1 Frontend Structure
```
frontend/
├── public/
│   ├── vite.svg
│   └── index.html
├── src/
│   ├── App.tsx                    # Componente principal
│   ├── main.tsx                   # Entry point
│   ├── components/
│   │   ├── AuthScreen.tsx         # Tela de login/registro
│   │   ├── Dashboard.tsx          # Dashboard com métricas
│   │   ├── Layout.tsx             # Layout principal
│   │   ├── LoginForm.tsx          # Formulário de login
│   │   ├── RegisterForm.tsx       # Formulário de registro
│   │   ├── NovoPedidoForm.tsx     # Formulário novo pedido
│   │   ├── PedidosLista.tsx       # Lista de pedidos
│   │   ├── PedidoDetalhes.tsx     # Detalhes do pedido
│   │   ├── OperadoresLista.tsx    # Lista de operadores
│   │   ├── AdminPanel.tsx         # Painel administrativo
│   │   ├── figma/
│   │   │   └── ImageWithFallback.tsx
│   │   └── ui/                    # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       ├── select.tsx
│   │       ├── table.tsx
│   │       ├── dialog.tsx
│   │       ├── form.tsx
│   │       ├── badge.tsx
│   │       ├── alert.tsx
│   │       └── ...                # 40+ componentes UI
│   ├── contexts/
│   │   └── AuthContext.tsx        # Contexto de autenticação
│   ├── services/
│   │   ├── apiService.ts          # Chamadas API
│   │   └── authService.ts         # Serviços de autenticação
│   ├── types/
│   │   └── index.ts               # TypeScript types
│   ├── utils/
│   │   └── supabase/
│   │       ├── client.ts          # Cliente Supabase
│   │       └── info.tsx           # Configurações
│   └── styles/
│       └── globals.css            # Tailwind + CSS customizado
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── .env                           # Variáveis de ambiente
```

### 9.2 Backend Structure (Supabase)
```
supabase/
├── functions/
│   └── server/
│       └── index.tsx              # API principal (Hono, 100% SQL)
├── migrations/                    # SQL migrations
│   └── 001_initial_schema.sql
└── config.toml                    # Configurações Supabase
```

### 9.3 Arquivos de Configuração

**package.json**
```json
{
  "name": "uniodonto-sistema",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@supabase/supabase-js": "^2.38.0",
    "lucide-react": "^0.294.0",
    "recharts": "^2.8.0",
    "react-hook-form": "^7.55.0",
    "sonner": "^2.0.3",
    "motion": "^10.16.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/node": "^20.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^4.4.0",
    "tailwindcss": "^4.0.0-alpha.0",
    "@tailwindcss/vite": "^4.0.0-alpha.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0",
    "eslint": "^8.45.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.0"
  }
}
```

---

## 10. Variáveis de Ambiente

### 10.1 Frontend (.env)
```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# API Base (Edge Function)
# Local (CLI): http://127.0.0.1:54321/functions/v1/server/make-server-96c6e32f
# Remoto (deploy): https://your-project-id.supabase.co/functions/v1/server/make-server-96c6e32f
# Cloudflare (recomendado): https://api.seu-dominio.com.br/functions/v1/server/make-server-96c6e32f
VITE_API_BASE_URL=

# Environment (opcional)
VITE_APP_ENV=development

# Optional: Analytics
VITE_GOOGLE_ANALYTICS_ID=GA_MEASUREMENT_ID
VITE_SENTRY_DSN=https://your-sentry-dsn
```

### 10.2 Supabase Edge Functions
```bash
# Supabase Secrets (configurar via CLI/Dashboard)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# (opcionais)
# DATABASE_URL=postgresql://postgres:[password]@db.your-project.supabase.co:5432/postgres
# JWT_SECRET=your-jwt-secret
# JWT_EXPIRATION=24h
# SMTP_HOST=...
# SENTRY_DSN=...
# LOG_LEVEL=info
```

### 10.3 Configuração de Secrets no Supabase

```bash
# Via CLI
supabase secrets set SUPABASE_URL="https://your-project-id.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Via Dashboard
# Project Settings > Edge Functions > Environment Variables
```

---

## 11. Scripts de Configuração

### 11.1 Setup Script (setup.sh)

```bash
#!/bin/bash

# setup.sh - Script de instalação automatizada
set -e

echo "🚀 Instalando Sistema de Gestão Uniodonto"

# Verificar se está rodando como root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Não execute este script como root"
    exit 1
fi

# Variáveis
PROJECT_DIR="/var/www/uniodonto-sistema"
DOMAIN_NAME=${1:-"localhost"}

echo "📋 Configurações:"
echo "   Diretório: $PROJECT_DIR"
echo "   Domínio: $DOMAIN_NAME"

# Criar diretório do projeto
echo "📁 Criando estrutura de diretórios..."
sudo mkdir -p $PROJECT_DIR
sudo chown -R $USER:$USER $PROJECT_DIR
cd $PROJECT_DIR

# Instalar Node.js se necessário
if ! command -v node &> /dev/null; then
    echo "📦 Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Instalar dependências do sistema
echo "🔧 Instalando dependências do sistema..."
sudo apt update
sudo apt install -y nginx git curl wget unzip build-essential

# Instalar PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 Instalando PM2..."
    sudo npm install -g pm2
fi

# Instalar Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "📦 Instalando Supabase CLI..."
    npm install -g supabase
fi

# Criar projeto React
echo "⚛️  Criando projeto React..."
npm create vite@latest frontend -- --template react-ts
cd frontend

# Instalar dependências
echo "📦 Instalando dependências do projeto..."
npm install @supabase/supabase-js@^2.38.0
npm install lucide-react recharts
npm install react-hook-form@7.55.0
npm install sonner@2.0.3
npm install motion
npm install class-variance-authority clsx tailwind-merge
npm install tailwindcss@next @tailwindcss/vite@next
npm install -D @types/node

# Configurar Nginx
echo "🌐 Configurando Nginx..."
sudo tee /etc/nginx/sites-available/uniodonto > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;
    root $PROJECT_DIR/frontend/dist;
    index index.html index.htm;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/uniodonto /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

echo "✅ Instalação base concluída!"
echo ""
echo "📝 Próximos passos:"
echo "1. Configurar variáveis de ambiente (.env)"
echo "2. Copiar código fonte dos componentes"
echo "3. Configurar projeto Supabase"
echo "4. Fazer build: npm run build"
echo "5. Configurar SSL com certbot"
echo ""
echo "🔗 Acesse: http://$DOMAIN_NAME"
```

### 11.2 Deploy Script (deploy.sh)

```bash
#!/bin/bash

# deploy.sh - Script de deploy automatizado
set -e

echo "🚀 Iniciando deploy do Sistema Uniodonto"

# Variáveis
PROJECT_DIR="/var/www/uniodonto-sistema"
BACKUP_DIR="/var/backups/uniodonto"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Criar backup
echo "💾 Criando backup..."
sudo mkdir -p $BACKUP_DIR
sudo cp -r $PROJECT_DIR/frontend/dist $BACKUP_DIR/dist_$TIMESTAMP

cd $PROJECT_DIR/frontend

# Verificar se há mudanças no Git
if [ -d ".git" ]; then
    echo "📡 Atualizando código..."
    git pull origin main
fi

# Instalar dependências atualizadas
echo "📦 Instalando dependências..."
npm ci

# Executar testes (se houver)
if npm run test --if-present; then
    echo "✅ Testes passaram"
else
    echo "❌ Testes falharam"
    exit 1
fi

# Build de produção
echo "🏗️  Fazendo build..."
npm run build

# Verificar se build foi bem-sucedido
if [ ! -d "dist" ]; then
    echo "❌ Build falhou"
    exit 1
fi

# Restart do Nginx
echo "🔄 Reiniciando Nginx..."
sudo systemctl reload nginx

# Deploy das Edge Functions (se aplicável)
if [ -d "../supabase" ]; then
    echo "☁️  Deployando Edge Functions..."
    cd ../supabase
    supabase functions deploy server
fi

echo "✅ Deploy concluído com sucesso!"
echo "🕐 Timestamp: $TIMESTAMP"
echo "💾 Backup salvo em: $BACKUP_DIR/dist_$TIMESTAMP"
```

### 11.3 Health Check Script (health-check.sh)

```bash
#!/bin/bash

# health-check.sh - Monitoramento de saúde do sistema
set -e

PROJECT_DIR="/var/www/uniodonto-sistema"
LOG_FILE="/var/log/uniodonto-health.log"

# Função de log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | sudo tee -a $LOG_FILE
}

# Verificar se Nginx está rodando
if ! systemctl is-active --quiet nginx; then
    log "❌ NGINX não está rodando"
    sudo systemctl start nginx
    log "✅ NGINX reiniciado"
fi

# Verificar se site responde
if ! curl -f -s "http://localhost" > /dev/null; then
    log "❌ Site não responde"
    sudo systemctl reload nginx
    log "🔄 NGINX recarregado"
fi

# Verificar espaço em disco
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    log "⚠️  Espaço em disco baixo: ${DISK_USAGE}%"
fi

# Verificar uso de memória
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $MEMORY_USAGE -gt 80 ]; then
    log "⚠️  Uso de memória alto: ${MEMORY_USAGE}%"
fi

log "✅ Health check concluído"
```

### 11.4 Cron Jobs

```bash
# Adicionar ao crontab: crontab -e

# Health check a cada 5 minutos
*/5 * * * * /var/www/uniodonto-sistema/health-check.sh

# Backup diário às 2h
0 2 * * * /var/www/uniodonto-sistema/backup.sh

# Limpeza de logs antigos (30 dias)
0 0 * * 0 find /var/log -name "*.log" -mtime +30 -delete

# Renovação SSL automática
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 12. Monitoramento e Logs

### 12.1 Logs do Sistema

**Localização dos Logs:**
```bash
# Nginx
/var/log/nginx/access.log
/var/log/nginx/error.log

# Sistema
/var/log/syslog
/var/log/auth.log

# Aplicação (se usando PM2)
~/.pm2/logs/

# Supabase Edge Functions
supabase functions logs server --follow
```

**Configuração de Log Rotation:**
```bash
# /etc/logrotate.d/uniodonto
/var/log/nginx/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    sharedscripts
    prerotate
        if [ -d /etc/logrotate.d/httpd-prerotate ]; then \
            run-parts /etc/logrotate.d/httpd-prerotate; \
        fi \
    endscript
    postrotate
        invoke-rc.d nginx reload >/dev/null 2>&1
    endscript
}
```

### 12.2 Monitoramento com Prometheus (Opcional)

**docker-compose.yml para monitoring:**
```yaml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana

volumes:
  grafana-data:
```

### 12.3 Alertas via Email/Slack

**Script de alerta (alert.sh):**
```bash
#!/bin/bash

# Configurar webhook do Slack
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"

# Função para enviar alerta
send_alert() {
    local message="$1"
    local color="$2"
    
    curl -X POST -H 'Content-type: application/json' \
        --data "{
            \"attachments\": [{
                \"color\": \"$color\",
                \"title\": \"🚨 Sistema Uniodonto\",
                \"text\": \"$message\",
                \"ts\": $(date +%s)
            }]
        }" \
        $SLACK_WEBHOOK
}

# Uso: send_alert "Servidor offline" "danger"
```

---

## 13. Troubleshooting

### 13.1 Problemas Comuns

#### **Erro: "Cannot connect to Supabase"**
```bash
# Verificar conectividade
curl -I https://your-project.supabase.co

# Verificar variáveis de ambiente
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY

# Verificar logs da Edge Function
supabase functions logs server
```

#### **Erro: "Build failed"**
```bash
# Limpar cache do Node
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# Verificar versão do Node
node --version  # deve ser 18+

# Build com logs detalhados
npm run build -- --verbose
```

#### **Erro: "Nginx 502 Bad Gateway"**
```bash
# Verificar configuração do Nginx
sudo nginx -t

# Verificar se arquivos existem
ls -la /var/www/uniodonto-sistema/frontend/dist/

# Verificar logs do Nginx
sudo tail -f /var/log/nginx/error.log
```

#### **Erro: "Permission denied"**
```bash
# Corrigir permissões
sudo chown -R www-data:www-data /var/www/uniodonto-sistema/frontend/dist/
sudo chmod -R 755 /var/www/uniodonto-sistema/frontend/dist/
```

### 13.2 Comandos de Diagnóstico

```bash
# Status do sistema
systemctl status nginx
systemctl status ssh
df -h
free -h
top

# Verificar portas em uso  
netstat -tulpn | grep :80
netstat -tulpn | grep :443

# Verificar conectividade
ping google.com
curl -I http://localhost

# Logs em tempo real
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
journalctl -f -u nginx

# Verificar certificados SSL
openssl x509 -in /etc/letsencrypt/live/seu-dominio.com/cert.pem -text -noout
```

### 13.3 Recovery Procedures

#### **Restaurar Backup**
```bash
# Parar Nginx
sudo systemctl stop nginx

# Restaurar arquivos
sudo cp -r /var/backups/uniodonto/dist_TIMESTAMP/* /var/www/uniodonto-sistema/frontend/dist/

# Reiniciar Nginx
sudo systemctl start nginx
```

#### **Rollback Deploy**
```bash
# Voltar para commit anterior
git log --oneline -10
git checkout COMMIT_HASH
npm run build
sudo systemctl reload nginx
```

#### **Reinstalação Completa**
```bash
# Backup dos dados importantes
sudo cp /var/www/uniodonto-sistema/frontend/.env /tmp/

# Remover instalação
sudo rm -rf /var/www/uniodonto-sistema

# Executar script de setup novamente
./setup.sh
```

---

## 📞 Suporte e Contato

### Documentação Adicional
- **Supabase**: https://supabase.com/docs
- **React**: https://react.dev/
- **Tailwind CSS**: https://tailwindcss.com/
- **Vite**: https://vitejs.dev/
- **shadcn/ui**: https://ui.shadcn.com/

### Versões Testadas
- **Node.js**: 18.19.0
- **NPM**: 10.2.3
- **Supabase CLI**: 1.100.0
- **Ubuntu**: 22.04 LTS
- **Nginx**: 1.18.0

---

**📅 Última atualização:** Setembro 2025  
**🔄 Versão da documentação:** 1.1  
**✅ Status:** SQL-only (sem KV), pronto para local + túnel  

---

> 🚀 **Sistema pronto para deploy em qualquer VPS!** Esta documentação permite a instalação completa do sistema em servidores Ubuntu, CentOS, Google Cloud, AWS, Hostinger, DigitalOcean e outras plataformas de nuvem.
