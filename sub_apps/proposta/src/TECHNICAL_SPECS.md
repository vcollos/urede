# Especificações Técnicas Detalhadas

## 📦 Módulos e Bibliotecas

### Core Dependencies

#### React 18.3.1
- **Propósito**: Biblioteca principal para construção da interface
- **Uso**: Componentes funcionais com hooks
- **Configuração**: Modo StrictMode habilitado
- **Patterns**: Composition pattern, custom hooks, controlled components

#### TypeScript 5.x
- **Propósito**: Tipagem estática para JavaScript
- **Configuração**: `tsconfig.json` com strict mode
- **Uso**: Tipos customizados para Props, State e Data models
- **Benefícios**: IntelliSense, detecção de erros em tempo de desenvolvimento

#### Vite 5.x
- **Propósito**: Build tool e dev server de alta performance
- **Configuração**: `vite.config.ts` com React plugin
- **Features utilizadas**:
  - Hot Module Replacement (HMR)
  - Tree shaking automático
  - Code splitting
  - Asset optimization

### UI Component Libraries

#### Radix UI Primitives
Biblioteca de componentes primitivos não estilizados, acessíveis e composáveis.

**Componentes utilizados**:

1. **@radix-ui/react-dialog** (v1.x)
   - Uso: Modais e diálogos
   - Props principais: `open`, `onOpenChange`, `modal`
   - Acessibilidade: ARIA completo, focus trap, escape para fechar

2. **@radix-ui/react-dropdown-menu** (v2.x)
   - Uso: Menus dropdown de ações
   - Features: Keyboard navigation, submenu support
   - Acessibilidade: Arrow key navigation, typeahead

3. **@radix-ui/react-label** (v2.x)
   - Uso: Labels de formulário
   - Features: Associação automática com inputs
   - Acessibilidade: Propagação de click para inputs

4. **@radix-ui/react-select** (v2.x)
   - Uso: Dropdowns de seleção
   - Features: Search, keyboard navigation, grouping
   - Acessibilidade: Screen reader support completo

5. **@radix-ui/react-separator** (v1.x)
   - Uso: Separadores visuais
   - Implementação: Semantic HTML com role="separator"

6. **@radix-ui/react-slot** (v1.x)
   - Uso: Composição de componentes flexível
   - Pattern: Polymorphic components (asChild pattern)

7. **@radix-ui/react-tabs** (v1.x)
   - Uso: Interface com abas
   - Features: Controlled/uncontrolled mode
   - Acessibilidade: Arrow navigation, roving tabindex

8. **@radix-ui/react-toast** (v1.x)
   - Uso: Base para notificações
   - Features: Queue management, dismiss actions
   - Acessibilidade: Announce para screen readers

9. **@radix-ui/react-accordion** (v1.x)
   - Uso: Seções expansíveis/colapsáveis
   - Features: Single/multiple items expanded
   - Acessibilidade: Arrow navigation

10. **@radix-ui/react-alert-dialog** (v1.x)
    - Uso: Diálogos de confirmação/alerta
    - Features: Forced action, no dismiss on outside click
    - Acessibilidade: Focus trap, required action

### Styling & Theme

#### Tailwind CSS 4.0
- **Propósito**: Framework CSS utility-first
- **Configuração**: `/styles/globals.css` com CSS custom properties
- **Features utilizadas**:
  - Utility classes
  - Responsive design (@media breakpoints)
  - Custom color tokens
  - Dark mode support (preparado)
  - Arbitrary values
  
**Tokens customizados principais**:
```css
--background: #ffffff;
--foreground: #111827;
--card: #ffffff;
--card-foreground: #111827;
--popover: #ffffff;
--popover-foreground: #111827;
--primary: #2563eb;
--primary-foreground: #ffffff;
--secondary: #f3f4f6;
--secondary-foreground: #111827;
--muted: #f3f4f6;
--muted-foreground: #6b7280;
--accent: #f3f4f6;
--accent-foreground: #111827;
--destructive: #ef4444;
--destructive-foreground: #ffffff;
--border: #e5e7eb;
--input: #e5e7eb;
--ring: #2563eb;
--radius: 0.75rem;
```

#### Class Utilities

1. **clsx** (v2.x)
   - **Propósito**: Construção condicional de className
   - **Uso**: Combinar classes dinamicamente
   ```typescript
   clsx('base-class', condition && 'conditional-class')
   ```

2. **tailwind-merge** (v2.x)
   - **Propósito**: Merge inteligente de classes Tailwind
   - **Uso**: Evitar conflitos de classes
   - **Benefício**: Resolve conflitos como `px-2 px-4` → `px-4`

3. **class-variance-authority (cva)** (v0.7.x)
   - **Propósito**: Sistema de variantes para componentes
   - **Uso**: Definir variações consistentes
   - **Exemplo**:
   ```typescript
   const buttonVariants = cva('base-styles', {
     variants: {
       variant: {
         default: 'bg-primary text-primary-foreground',
         outline: 'border border-input'
       },
       size: {
         default: 'h-10 px-4',
         sm: 'h-9 px-3'
       }
     }
   })
   ```

### Icons

#### lucide-react (v0.x)
- **Propósito**: Biblioteca de ícones SVG
- **Características**:
  - Tree-shakeable (apenas ícones usados são incluídos)
  - Customizável via props (size, color, strokeWidth)
  - Acessível (aria-hidden por padrão)
  
**Ícones utilizados no projeto**:
- `FileText` - Representar documentos/propostas
- `Edit` - Ação de editar
- `Columns2` - Modo split view
- `FolderOpen` - Propostas salvas
- `Plus` - Adicionar item
- `X` - Remover/fechar
- `Trash2` - Deletar
- `Eye` - Visualizar
- `Save` - Salvar
- `Download` - Exportar
- `Upload` - Importar
- `Copy` - Duplicar
- `ExternalLink` - Links externos
- `Check` - Confirmação
- `AlertCircle` - Alertas

### Notifications

#### sonner@2.0.3
- **Propósito**: Sistema de toast notifications
- **Features**:
  - Queue automático de notificações
  - Tipos: success, error, info, warning
  - Promise handling
  - Custom JSX content
  - Dismiss manual ou automático
  - Position configurável
  
**Implementação**:
```typescript
import { toast } from 'sonner@2.0.3';

// Success
toast.success('Proposta salva com sucesso!');

// Error
toast.error('Erro ao salvar proposta');

// Custom
toast('Mensagem customizada', {
  description: 'Descrição adicional',
  duration: 3000
});
```

**Configuração no App.tsx**:
```typescript
<Toaster position="top-right" />
```

### Export Libraries

#### jsPDF (v2.x)
- **Propósito**: Geração de arquivos PDF no navegador
- **Features utilizadas**:
  - Text rendering nativo
  - Line breaks e word wrap
  - Multiple pages
  - Page breaks automáticos
  - Links clicáveis
  - Shapes e borders
  - Custom fonts (futuro)
  
**Implementação no projeto**:
```typescript
import { jsPDF } from 'jspdf';

const pdf = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4'
});

// Adicionar texto
pdf.text('Título', x, y);

// Adicionar link clicável
pdf.textWithLink('Link', x, y, { url: 'https://...' });

// Salvar
pdf.save('proposta.pdf');
```

**Formato A4**:
- Largura: 210mm
- Altura: 297mm
- Margens: 20mm
- Content width: 170mm

## 🏗️ Arquitetura de Componentes

### Design Pattern: Composition

#### Container Components
Gerenciam estado e lógica de negócio:
- `App.tsx` - Estado global, navegação entre views
- `ProposalForm.tsx` - Estado do formulário, validações
- `SavedProposals.tsx` - Gerenciamento de propostas salvas

#### Presentation Components
Focam apenas em renderização:
- `ProposalPreview.tsx` - Exibe proposta formatada
- `ModalityForm.tsx` - Form fields de modalidade
- `ModalityComparison.tsx` - Tabela comparativa

#### Utility Components (UI)
Componentes reutilizáveis sem lógica de negócio:
- `Button` - Botões estilizados
- `Input` - Campos de texto
- `Card` - Containers
- `Dialog` - Modais

### State Management

#### Local State (useState)
Usado para:
- Estado efêmero de UI (menus abertos, modais)
- Valores de formulários controlados
- Loading states

#### Custom Hooks (useProposals)
Encapsula lógica de:
- Persistência no localStorage
- CRUD de propostas
- Import/Export JSON

**Vantagens**:
- Reutilização de lógica
- Separação de concerns
- Testabilidade

### Data Flow

```
App.tsx (estado principal)
    ↓
ProposalForm (controlled component)
    ↓
ModalityForm (controlled component)
    ↓
Input/Textarea (controlled components)
```

**Padrão Controlled Components**:
- Todos os inputs são controlados pelo React
- Single source of truth no estado
- Validação em tempo real possível

## 🔐 Persistência de Dados

### LocalStorage Strategy

#### Estrutura de Dados
```typescript
// Key: 'collos_saved_proposals'
// Value: JSON stringified array
[
  {
    id: 'proposal_1707858000000_abc123',
    name: 'Proposta Website Uniodonto',
    data: ProposalData,
    createdAt: '2026-02-14T10:30:00.000Z',
    updatedAt: '2026-02-14T15:45:00.000Z'
  }
]
```

#### CRUD Operations

**Create**:
```typescript
const saveProposal = (data: ProposalData, name?: string) => {
  const newProposal: SavedProposal = {
    id: `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name || data.title,
    data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  setProposals(prev => [newProposal, ...prev]);
  return newProposal.id;
};
```

**Read**:
```typescript
useEffect(() => {
  const saved = localStorage.getItem('collos_saved_proposals');
  if (saved) {
    setProposals(JSON.parse(saved));
  }
}, []);
```

**Update**:
```typescript
const updateProposal = (id: string, data: ProposalData, name?: string) => {
  setProposals(prev =>
    prev.map(p =>
      p.id === id
        ? { ...p, data, name: name || p.name, updatedAt: new Date().toISOString() }
        : p
    )
  );
};
```

**Delete**:
```typescript
const deleteProposal = (id: string) => {
  setProposals(prev => prev.filter(p => p.id !== id));
};
```

#### Sync com localStorage
```typescript
useEffect(() => {
  localStorage.setItem('collos_saved_proposals', JSON.stringify(proposals));
}, [proposals]);
```

### Backup & Recovery

#### JSON Export
```typescript
const exportToJSON = (id: string) => {
  const proposal = proposals.find(p => p.id === id);
  if (proposal) {
    const dataStr = JSON.stringify(proposal, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = `${proposal.name}.json`;
    link.click();
  }
};
```

#### JSON Import
```typescript
const importFromJSON = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        const newProposal = {
          ...imported,
          id: generateNewId(),
          name: `${imported.name} (importado)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setProposals(prev => [newProposal, ...prev]);
        resolve(newProposal.id);
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsText(file);
  });
};
```

## 📤 Sistema de Exportação

### HTML Export

#### Características
- **Standalone**: Funciona sem dependências externas
- **Embedded CSS**: Todos os estilos inline ou no `<style>`
- **Responsive**: Media queries para mobile
- **Print-friendly**: Estilos específicos para impressão

#### Estrutura do HTML gerado
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} - {clientName}</title>
  <style>
    /* Todos os estilos embutidos */
  </style>
</head>
<body>
  <div class="container">
    <!-- Logo em base64 -->
    <!-- Header com título -->
    <!-- Objetivo -->
    <!-- Modalidades -->
    <!-- Tabela comparativa -->
    <!-- Informações adicionais -->
    <!-- Footer -->
  </div>
</body>
</html>
```

#### Conversão de Logo para Base64
```typescript
const img = new Image();
img.crossOrigin = 'anonymous';
img.onload = () => {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(img, 0, 0);
  const logoBase64 = canvas.toDataURL('image/png');
  // Usar no HTML
};
img.src = logoUrl;
```

### PDF Export

#### Estratégia: Native Text Rendering
Diferente de screenshot-based PDFs, usamos **texto nativo**:
- ✅ Texto selecionável e copiável
- ✅ Pesquisável (Ctrl+F funciona)
- ✅ Menor tamanho de arquivo
- ✅ Links clicáveis
- ✅ Melhor qualidade

#### Page Layout (A4)
```typescript
const pageWidth = 210;  // mm
const pageHeight = 297; // mm
const margin = 20;      // mm
const contentWidth = pageWidth - (2 * margin); // 170mm
```

#### Page Break Management
```typescript
const checkPageBreak = (requiredSpace: number = 10) => {
  if (yPosition + requiredSpace > pageHeight - margin) {
    pdf.addPage();
    yPosition = margin;
    return true;
  }
  return false;
};
```

#### Typography
```typescript
// Título principal
pdf.setFontSize(24);
pdf.setFont('helvetica', 'bold');

// Subtítulos
pdf.setFontSize(14);
pdf.setFont('helvetica', 'bold');

// Corpo de texto
pdf.setFontSize(11);
pdf.setFont('helvetica', 'normal');

// Texto secundário
pdf.setFontSize(10);
pdf.setTextColor(100, 100, 100);
```

#### Word Wrapping
```typescript
const lines = pdf.splitTextToSize(longText, contentWidth);
lines.forEach((line: string) => {
  checkPageBreak();
  pdf.text(line, margin, yPosition);
  yPosition += lineHeight;
});
```

#### Links Clicáveis
```typescript
pdf.textWithLink('Ver Detalhamento', x, y, { 
  url: modality.detailsLink 
});
```

## 🎨 Design System

### Color Palette

#### Primary Colors
- **Primary**: `#2563eb` (Blue 600) - Ações principais
- **Background**: `#ffffff` (White) - Fundo principal
- **Foreground**: `#111827` (Gray 900) - Texto principal

#### Semantic Colors
- **Success**: `#16a34a` (Green 600) - Confirmações
- **Destructive**: `#ef4444` (Red 500) - Ações destrutivas
- **Warning**: `#f59e0b` (Amber 500) - Avisos
- **Info**: `#3b82f6` (Blue 500) - Informações

#### Neutral Colors
- **Muted**: `#f3f4f6` (Gray 100) - Backgrounds secundários
- **Border**: `#e5e7eb` (Gray 200) - Bordas e separadores
- **Muted Foreground**: `#6b7280` (Gray 500) - Texto secundário

### Typography Scale

```css
/* Headings */
h1: 2.5rem (40px) - font-weight: 700
h2: 1.875rem (30px) - font-weight: 600
h3: 1.25rem (20px) - font-weight: 600
h4: 1rem (16px) - font-weight: 500

/* Body */
body: 1rem (16px) - line-height: 1.6
small: 0.875rem (14px)
```

### Spacing Scale

Baseado em múltiplos de 4px (0.25rem):
```
0.5rem = 8px
1rem = 16px
1.5rem = 24px
2rem = 32px
3rem = 48px
4rem = 64px
```

### Border Radius
```css
--radius: 0.75rem (12px) - Padrão para cards e botões
```

### Shadows

```css
/* Card shadow */
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

/* Popover shadow */
box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
```

## 🧪 Testing Strategy (Recomendado)

### Unit Tests
- Componentes individuais
- Hooks customizados
- Utility functions

### Integration Tests
- Fluxo completo de criação de proposta
- Sistema de salvar/carregar
- Exportação de arquivos

### E2E Tests
- Jornada completa do usuário
- Multi-browser testing
- Responsividade

### Ferramentas Recomendadas
- **Vitest** - Unit tests (compatível com Vite)
- **React Testing Library** - Component tests
- **Playwright** - E2E tests

## 🚀 Performance Optimizations

### Code Splitting
Vite faz automaticamente, mas pode-se usar:
```typescript
const Component = lazy(() => import('./Component'));
```

### Memoization
```typescript
const memoizedValue = useMemo(() => expensiveCalculation(), [deps]);
const memoizedCallback = useCallback(() => {}, [deps]);
```

### Virtual Scrolling
Para listas grandes de propostas (futuro):
```typescript
import { useVirtual } from 'react-virtual';
```

### Image Optimization
- Logo em formato otimizado (WebP ou SVG)
- Lazy loading de imagens
- Responsive images

## 📱 Responsividade

### Breakpoints (Tailwind)
```
sm: 640px   - Mobile landscape
md: 768px   - Tablet
lg: 1024px  - Desktop
xl: 1280px  - Large desktop
2xl: 1536px - Extra large
```

### Mobile-First Approach
```tsx
<div className="p-4 md:p-8 lg:p-12">
  {/* Padding increases with screen size */}
</div>
```

### Touch-Friendly
- Botões mínimo 44x44px
- Spacing adequado entre elementos clicáveis
- Gestos naturais (swipe, tap)

## 🔒 Security Considerations

### XSS Prevention
```typescript
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

### LocalStorage Limits
- Máximo ~5-10MB por domínio
- Implementar limpeza de propostas antigas (futuro)
- Avisar usuário quando próximo do limite

### Input Validation
- Sanitização de inputs
- Validação de URLs
- Limite de caracteres

## 📊 Browser Compatibility

### Supported Browsers
- Chrome/Edge >= 90
- Firefox >= 88
- Safari >= 14
- Opera >= 76

### Polyfills Necessários
Nenhum necessário para browsers modernos.

Para suporte IE11 (não recomendado):
- Promise polyfill
- Array methods polyfills
- CSS custom properties polyfill

## 🛠️ Development Workflow

### Scripts NPM

```json
{
  "dev": "vite",              // Dev server com HMR
  "build": "tsc && vite build", // Build de produção
  "preview": "vite preview",   // Preview da build
  "lint": "eslint .",          // Linting (se configurado)
  "typecheck": "tsc --noEmit"  // Type checking
}
```

### Git Workflow Recomendado
```bash
# Feature branch
git checkout -b feature/nova-funcionalidade

# Commits semânticos
git commit -m "feat: adiciona exportação Excel"
git commit -m "fix: corrige quebra de página no PDF"
git commit -m "docs: atualiza README"

# Merge para main
git checkout main
git merge feature/nova-funcionalidade
```

### Environment Variables (Futuro)
```env
VITE_API_URL=https://api.collos.com
VITE_ENV=production
```

## 📈 Monitoring & Analytics (Futuro)

### Métricas Recomendadas
- Taxa de conclusão de propostas
- Tempo médio de criação
- Formatos de exportação mais usados
- Navegador e dispositivo dos usuários

### Error Tracking
Integração sugerida:
- **Sentry** - Error tracking e performance
- **LogRocket** - Session replay

### Analytics
- **Google Analytics 4** - Comportamento do usuário
- **Mixpanel** - Product analytics

## 🔄 Update Strategy

### Versionamento Semântico
```
MAJOR.MINOR.PATCH
2.1.3

MAJOR: Breaking changes
MINOR: New features (backward compatible)
PATCH: Bug fixes
```

### Changelog
Manter arquivo `CHANGELOG.md` com:
- Data de release
- Tipo de mudança (Added, Changed, Fixed, Removed)
- Descrição detalhada

### Migration Guides
Para breaking changes, fornecer guia de migração.

---

**Documento mantido por**: Equipe de Desenvolvimento Collos  
**Última atualização**: 14 de Fevereiro de 2026  
**Versão do documento**: 1.0.0
