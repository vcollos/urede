# 🛠️ Comandos Úteis e Referência Rápida

Guia de referência rápida com todos os comandos e snippets úteis para desenvolvimento.

---

## 📦 NPM / Package Manager

### Instalação

```bash
# Instalar todas as dependências
npm install

# Instalar dependência de produção
npm install [pacote]

# Instalar dependência de desenvolvimento
npm install -D [pacote]

# Instalar versão específica
npm install [pacote]@[versao]

# Forçar instalação (resolver conflitos)
npm install --force

# Usar legacy peer deps
npm install --legacy-peer-deps
```

### Atualização

```bash
# Verificar pacotes desatualizados
npm outdated

# Atualizar todos (minor/patch)
npm update

# Atualizar pacote específico
npm update [pacote]

# Ferramenta para major updates
npx npm-check-updates
npx ncu -u  # Atualiza package.json
npm install
```

### Limpeza

```bash
# Limpar cache
npm cache clean --force

# Remover node_modules e reinstalar
rm -rf node_modules package-lock.json
npm install

# Windows (PowerShell)
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install
```

### Segurança

```bash
# Verificar vulnerabilidades
npm audit

# Corrigir automaticamente
npm audit fix

# Forçar correções (cuidado!)
npm audit fix --force
```

---

## 🚀 Scripts do Projeto

### Desenvolvimento

```bash
# Iniciar dev server (padrão: porta 5173)
npm run dev

# Iniciar com host exposto (rede local)
npm run dev -- --host

# Iniciar em porta específica
npm run dev -- --port 3000
```

### Build

```bash
# Build de produção
npm run build

# Preview da build
npm run preview

# Preview em porta específica
npm run preview -- --port 4000
```

### Verificações

```bash
# Verificar tipos TypeScript (sem emitir)
npm run typecheck

# Lint (se configurado)
npm run lint

# Lint com auto-fix
npm run lint -- --fix
```

---

## 🔧 Git Commands

### Setup Inicial

```bash
# Inicializar repositório
git init

# Configurar user
git config user.name "Seu Nome"
git config user.email "seu@email.com"

# Adicionar remote
git remote add origin [url-do-repositorio]
```

### Workflow Básico

```bash
# Ver status
git status

# Adicionar arquivos
git add .
git add [arquivo]

# Commit
git commit -m "feat: adiciona nova funcionalidade"

# Push
git push origin main
git push origin [branch]

# Pull
git pull origin main
```

### Branches

```bash
# Criar e mudar para nova branch
git checkout -b feature/nova-funcionalidade

# Listar branches
git branch

# Mudar de branch
git checkout [branch]

# Deletar branch local
git branch -d [branch]

# Deletar branch remota
git push origin --delete [branch]
```

### Commits Semânticos

```bash
# Features
git commit -m "feat: adiciona exportação Excel"

# Bug fixes
git commit -m "fix: corrige quebra de página no PDF"

# Documentação
git commit -m "docs: atualiza README"

# Estilo/formatação
git commit -m "style: formata código com prettier"

# Refatoração
git commit -m "refactor: reorganiza componentes"

# Performance
git commit -m "perf: otimiza renderização da tabela"

# Testes
git commit -m "test: adiciona testes para ProposalForm"

# Chores
git commit -m "chore: atualiza dependências"
```

### Desfazer Mudanças

```bash
# Desfazer mudanças não commitadas
git checkout -- [arquivo]

# Desfazer último commit (mantém mudanças)
git reset --soft HEAD~1

# Desfazer último commit (remove mudanças)
git reset --hard HEAD~1

# Reverter commit específico
git revert [hash-do-commit]
```

---

## 📝 TypeScript

### Comandos

```bash
# Verificar tipos
tsc --noEmit

# Watch mode
tsc --watch

# Gerar tsconfig.json
tsc --init
```

### Tipos Úteis do Projeto

```typescript
import { ProposalData, Modality } from './App';

// Usar tipos
const proposal: ProposalData = {
  title: 'Proposta',
  clientName: 'Cliente',
  objective: 'Objetivo',
  modalities: []
};

const modality: Modality = {
  id: crypto.randomUUID(),
  name: 'Plano Básico',
  price: 'R$ 500,00',
  billingType: 'monthly',
  included: []
};
```

---

## 🎨 Tailwind CSS

### Comandos

```bash
# Build CSS
npx tailwindcss -i ./src/styles/input.css -o ./src/styles/output.css

# Watch mode
npx tailwindcss -i ./src/styles/input.css -o ./src/styles/output.css --watch
```

### Classes Úteis do Projeto

```typescript
// Containers
<div className="container mx-auto max-w-7xl px-4">

// Cards
<div className="rounded-lg border border-border bg-card p-6">

// Buttons
<button className="h-10 px-4 rounded-lg bg-primary text-primary-foreground">

// Inputs
<input className="flex h-10 w-full rounded-lg border border-input bg-input-background px-3">

// Grid
<div className="grid gap-4 md:grid-cols-2">

// Flex
<div className="flex items-center justify-between gap-2">
```

---

## 🧪 Testing (Configuração Futura)

### Vitest

```bash
# Instalar Vitest
npm install -D vitest @vitest/ui

# Rodar testes
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# UI
npm run test:ui
```

### React Testing Library

```bash
# Instalar
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event

# Exemplo de teste
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

test('renders button', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

---

## 🚀 Deploy

### Vercel

```bash
# Instalar CLI
npm install -g vercel

# Deploy
vercel

# Deploy em produção
vercel --prod
```

### Netlify

```bash
# Instalar CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy

# Deploy em produção
netlify deploy --prod
```

### Build Manual

```bash
# Build
npm run build

# Arquivos em /dist
# Copiar para servidor ou CDN
```

---

## 🔍 Debug

### Browser DevTools

```bash
# Abrir DevTools
F12 ou Ctrl+Shift+I (Windows/Linux)
Cmd+Option+I (Mac)

# Console
Ctrl+Shift+J (Windows/Linux)
Cmd+Option+J (Mac)
```

### React DevTools

```bash
# Instalar extensão
# Chrome: https://chrome.google.com/webstore
# Firefox: https://addons.mozilla.org

# Usar no navegador (aba React)
```

### VS Code

```typescript
// Adicionar breakpoint
debugger;

// Launch configuration (.vscode/launch.json)
{
  "type": "chrome",
  "request": "launch",
  "url": "http://localhost:5173"
}
```

---

## 📊 Bundle Analysis

### Visualizar bundle

```bash
# Instalar
npm install -D rollup-plugin-visualizer

# Adicionar ao vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: true })
  ]
});

# Build (abre visualização)
npm run build
```

---

## 🔧 Utilitários Gerais

### Gerar UUID

```typescript
const id = crypto.randomUUID();
// Output: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
```

### Formatar Data

```typescript
const now = new Date();
const formatted = now.toLocaleDateString('pt-BR');
// Output: "14/02/2026"

const iso = now.toISOString();
// Output: "2026-02-14T10:30:00.000Z"
```

### LocalStorage

```typescript
// Salvar
localStorage.setItem('key', JSON.stringify(data));

// Ler
const data = JSON.parse(localStorage.getItem('key') || '{}');

// Remover
localStorage.removeItem('key');

// Limpar tudo
localStorage.clear();
```

---

## 🎨 Tailwind Utilities

### Custom Utils (criar em globals.css)

```css
@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
  
  .scrollbar-hide {
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
}
```

---

## 📝 VS Code Snippets

### Criar arquivo: `.vscode/react.code-snippets`

```json
{
  "React Functional Component": {
    "prefix": "rfc",
    "body": [
      "type ${1:Component}Props = {",
      "  $2",
      "};",
      "",
      "export function ${1:Component}({ $3 }: ${1:Component}Props) {",
      "  return (",
      "    <div>",
      "      $0",
      "    </div>",
      "  );",
      "}"
    ]
  }
}
```

---

## 🔐 Environment Variables

### Criar arquivo `.env`

```env
VITE_API_URL=https://api.example.com
VITE_ENV=development
```

### Usar no código

```typescript
const apiUrl = import.meta.env.VITE_API_URL;
const env = import.meta.env.MODE; // 'development' ou 'production'
```

---

## 🐳 Docker (Futuro)

### Dockerfile exemplo

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=0 /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "80:80"
```

---

## 📱 Mobile Testing

### Expor servidor na rede local

```bash
npm run dev -- --host

# Acessar de outro dispositivo:
# http://[seu-ip-local]:5173
# Ex: http://192.168.1.100:5173
```

### Descobrir seu IP

```bash
# Windows
ipconfig

# Mac/Linux
ifconfig
# ou
ip addr show
```

---

## 🔄 Hot Reload Issues

### Se hot reload não funcionar:

```bash
# 1. Reiniciar dev server
# Ctrl+C, depois npm run dev

# 2. Limpar cache do Vite
rm -rf node_modules/.vite

# 3. Limpar tudo e reinstalar
rm -rf node_modules .vite dist
npm install
npm run dev
```

---

## 📊 Performance

### Lighthouse (Chrome DevTools)

```bash
# Abrir DevTools
F12 → Aba "Lighthouse"

# Ou CLI
npm install -g lighthouse
lighthouse http://localhost:5173
```

### Medir Web Vitals

```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getFCP(console.log);
getLCP(console.log);
getTTFB(console.log);
```

---

## 🎓 Links Rápidos

### Documentação Oficial
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)

### Ferramentas
- [Can I Use](https://caniuse.com/) - Browser support
- [BundlePhobia](https://bundlephobia.com/) - Package size
- [TypeScript Playground](https://www.typescriptlang.org/play)
- [Tailwind Play](https://play.tailwindcss.com/)

### Comunidades
- [React Brasil (Discord)](https://react.dev/community)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/reactjs)

---

## 🎯 Atalhos de Teclado (VS Code)

```
Ctrl+P - Quick open file
Ctrl+Shift+P - Command palette
Ctrl+B - Toggle sidebar
Ctrl+` - Toggle terminal
Ctrl+/ - Toggle comment
Alt+Up/Down - Move line
Shift+Alt+Up/Down - Duplicate line
Ctrl+D - Select next occurrence
F2 - Rename symbol
Ctrl+Space - Trigger suggestions
```

---

## 📋 Checklist de Deploy

```
[ ] npm run build sem erros
[ ] npm run typecheck passou
[ ] Testar build localmente (npm run preview)
[ ] Testar em diferentes navegadores
[ ] Testar responsividade (mobile/tablet)
[ ] Verificar variáveis de ambiente
[ ] Atualizar CHANGELOG.md
[ ] Tag no Git (git tag v1.x.x)
[ ] Deploy!
```

---

**Mantido por**: Equipe Collos  
**Última atualização**: 14 de Fevereiro de 2026  
**Versão**: 1.0.0

💡 **Dica**: Mantenha este arquivo aberto durante o desenvolvimento!
