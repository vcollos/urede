# 📦 Lista Completa de Dependências

Este documento lista todas as dependências e módulos utilizados no projeto **Gerador de Propostas Collos**.

## 🎯 Como Instalar

```bash
npm install
```

Ou especificar pacotes individualmente:

```bash
npm install [nome-do-pacote]@[versão]
```

---

## 📚 Dependencies (Produção)

### Core React

```json
"react": "^18.3.1"
"react-dom": "^18.3.1"
```

**Descrição**: Biblioteca principal para construção de interfaces.

---

### UI Components - Radix UI

```json
"@radix-ui/react-accordion": "^1.1.2"
"@radix-ui/react-alert-dialog": "^1.0.5"
"@radix-ui/react-avatar": "^1.0.4"
"@radix-ui/react-checkbox": "^1.0.4"
"@radix-ui/react-collapsible": "^1.0.3"
"@radix-ui/react-dialog": "^1.0.5"
"@radix-ui/react-dropdown-menu": "^2.0.6"
"@radix-ui/react-label": "^2.0.2"
"@radix-ui/react-popover": "^1.0.7"
"@radix-ui/react-progress": "^1.0.3"
"@radix-ui/react-radio-group": "^1.1.3"
"@radix-ui/react-select": "^2.0.0"
"@radix-ui/react-separator": "^1.0.3"
"@radix-ui/react-slider": "^1.1.2"
"@radix-ui/react-slot": "^1.0.2"
"@radix-ui/react-switch": "^1.0.3"
"@radix-ui/react-tabs": "^1.0.4"
"@radix-ui/react-toast": "^1.1.5"
"@radix-ui/react-tooltip": "^1.0.7"
```

**Descrição**: Componentes primitivos não estilizados e acessíveis para construir UI.

**Site**: https://www.radix-ui.com/

---

### Icons

```json
"lucide-react": "^0.309.0"
```

**Descrição**: Biblioteca de ícones SVG moderna e tree-shakeable.

**Site**: https://lucide.dev/

**Ícones utilizados no projeto**:
- FileText, Edit, Eye, Save
- Plus, X, Trash2
- Download, Upload, Copy
- FolderOpen, Columns2
- ExternalLink, Link
- Check, AlertCircle

---

### Notifications

```json
"sonner": "2.0.3"
```

**Descrição**: Sistema de toast notifications elegante e fácil de usar.

**Site**: https://sonner.emilkowal.ski/

**Uso no projeto**:
```typescript
import { toast } from 'sonner@2.0.3';
toast.success('Proposta salva!');
```

---

### PDF Generation

```json
"jspdf": "^2.5.1"
```

**Descrição**: Biblioteca para gerar PDFs no navegador com texto nativo.

**Site**: https://github.com/parallax/jsPDF

**Uso no projeto**: Exportação de propostas em formato PDF A4 com texto selecionável e links clicáveis.

---

### Styling Utilities

```json
"clsx": "^2.1.0"
"tailwind-merge": "^2.2.0"
"class-variance-authority": "^0.7.0"
```

**clsx**:
- **Descrição**: Utilitário para construir className condicionalmente
- **Uso**: `clsx('base', condition && 'conditional')`
- **Site**: https://github.com/lukeed/clsx

**tailwind-merge**:
- **Descrição**: Merge inteligente de classes Tailwind para evitar conflitos
- **Uso**: `twMerge('px-2 px-4')` → `'px-4'`
- **Site**: https://github.com/dcastil/tailwind-merge

**class-variance-authority**:
- **Descrição**: Sistema de variantes para componentes
- **Uso**: Definir variações consistentes de estilos
- **Site**: https://cva.style/

---

## 🛠️ DevDependencies (Desenvolvimento)

### TypeScript

```json
"typescript": "^5.3.3"
"@types/react": "^18.2.48"
"@types/react-dom": "^18.2.18"
```

**Descrição**: Superset tipado do JavaScript.

**Site**: https://www.typescriptlang.org/

---

### Build Tool

```json
"vite": "^5.0.11"
"@vitejs/plugin-react": "^4.2.1"
```

**Vite**:
- **Descrição**: Build tool e dev server ultra-rápido
- **Features**: HMR, Tree shaking, Code splitting
- **Site**: https://vitejs.dev/

**@vitejs/plugin-react**:
- **Descrição**: Plugin oficial do React para Vite
- **Features**: Fast Refresh, JSX optimization

---

### CSS Framework

```json
"tailwindcss": "^4.0.0"
"postcss": "^8.4.33"
"autoprefixer": "^10.4.16"
```

**Tailwind CSS**:
- **Descrição**: Framework CSS utility-first
- **Versão**: 4.0 (usa CSS custom properties)
- **Site**: https://tailwindcss.com/

**PostCSS**:
- **Descrição**: Ferramenta para transformar CSS com plugins
- **Site**: https://postcss.org/

**Autoprefixer**:
- **Descrição**: Adiciona prefixos de vendor automaticamente
- **Site**: https://github.com/postcss/autoprefixer

---

### Linting (Opcional - Recomendado)

```json
"eslint": "^8.56.0"
"@typescript-eslint/eslint-plugin": "^6.19.0"
"@typescript-eslint/parser": "^6.19.0"
"eslint-plugin-react": "^7.33.2"
"eslint-plugin-react-hooks": "^4.6.0"
```

**Descrição**: Ferramenta de linting para identificar padrões problemáticos.

**Site**: https://eslint.org/

---

## 📋 Package.json Completo (Referência)

```json
{
  "name": "gerador-propostas-collos",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
  },
  "dependencies": {
    "@radix-ui/react-accordion": "^1.1.2",
    "@radix-ui/react-alert-dialog": "^1.0.5",
    "@radix-ui/react-avatar": "^1.0.4",
    "@radix-ui/react-checkbox": "^1.0.4",
    "@radix-ui/react-collapsible": "^1.0.3",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-popover": "^1.0.7",
    "@radix-ui/react-progress": "^1.0.3",
    "@radix-ui/react-radio-group": "^1.1.3",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-separator": "^1.0.3",
    "@radix-ui/react-slider": "^1.1.2",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-switch": "^1.0.3",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5",
    "@radix-ui/react-tooltip": "^1.0.7",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "jspdf": "^2.5.1",
    "lucide-react": "^0.309.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "sonner": "2.0.3",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "@typescript-eslint/parser": "^6.19.0",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "eslint": "^8.56.0",
    "eslint-plugin-react": "^7.33.2",
    "eslint-plugin-react-hooks": "^4.6.0",
    "postcss": "^8.4.33",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.3.3",
    "vite": "^5.0.11"
  }
}
```

---

## 🔄 Atualização de Dependências

### Verificar atualizações disponíveis

```bash
npm outdated
```

### Atualizar todas as dependências (minor e patch)

```bash
npm update
```

### Atualizar para versões major (com cautela)

```bash
npm install [package]@latest
```

### Ferramenta recomendada: npm-check-updates

```bash
npm install -g npm-check-updates
ncu
ncu -u  # Atualiza package.json
npm install
```

---

## 🔒 Segurança

### Verificar vulnerabilidades

```bash
npm audit
```

### Corrigir vulnerabilidades automaticamente

```bash
npm audit fix
```

### Forçar correções (pode causar breaking changes)

```bash
npm audit fix --force
```

---

## 📊 Tamanho dos Pacotes

### Analisar bundle size

```bash
npm run build
```

### Ferramenta de análise recomendada

```bash
npm install -D rollup-plugin-visualizer
```

Adicionar ao `vite.config.ts`:
```typescript
import { visualizer } from 'rollup-plugin-visualizer';

export default {
  plugins: [
    visualizer({ open: true })
  ]
}
```

---

## 🎯 Dependências por Categoria

### 1. UI Framework (React)
- react
- react-dom
- @types/react
- @types/react-dom

### 2. Component Library (Radix UI)
- Todos os @radix-ui/react-*

### 3. Styling
- tailwindcss
- postcss
- autoprefixer
- clsx
- tailwind-merge
- class-variance-authority

### 4. Icons & Assets
- lucide-react

### 5. Notifications
- sonner

### 6. Export
- jspdf

### 7. Build Tools
- vite
- @vitejs/plugin-react
- typescript

### 8. Code Quality (Opcional)
- eslint
- @typescript-eslint/*
- eslint-plugin-react*

---

## 🆘 Problemas Comuns

### "Cannot find module 'X'"

```bash
npm install
```

### "ERESOLVE unable to resolve dependency tree"

```bash
npm install --legacy-peer-deps
```

### "Module not found: Can't resolve 'X'"

Verifique se o módulo está em `dependencies` e não em `devDependencies`.

### Limpar cache do npm

```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

---

## 📚 Documentação Oficial

- **React**: https://react.dev/
- **TypeScript**: https://www.typescriptlang.org/
- **Vite**: https://vitejs.dev/
- **Tailwind CSS**: https://tailwindcss.com/
- **Radix UI**: https://www.radix-ui.com/
- **Lucide Icons**: https://lucide.dev/
- **jsPDF**: https://github.com/parallax/jsPDF
- **Sonner**: https://sonner.emilkowal.ski/

---

## 🔖 Versões Específicas

### Pacotes com versão fixa:

**sonner@2.0.3**
- Deve usar exatamente esta versão
- Importação: `import { toast } from 'sonner@2.0.3'`

### Pacotes com versão flexível (^):

- `^1.0.0` = Aceita 1.x.x (não sobe para 2.0.0)
- `~1.0.0` = Aceita 1.0.x (não sobe para 1.1.0)

---

**Documento de Referência**  
**Última atualização**: Fevereiro de 2026  
**Mantido por**: Equipe Collos
