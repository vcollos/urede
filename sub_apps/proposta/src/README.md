# Gerador de Propostas Comerciais Collos

## 📋 Sobre o Projeto

Sistema completo e moderno para geração de propostas comerciais profissionais, desenvolvido para a empresa **Collos**. A aplicação permite criar propostas personalizadas para produtos e serviços, comparar diferentes modalidades de negócio (SaaS, venda direta, fee for service, etc.) e exportar em múltiplos formatos com layout minimalista e profissional.

### Objetivo

Evoluir a plataforma para que outras empresas também possam utilizar para gerar orçamentos e propostas comerciais de forma rápida e eficiente, com foco em:
- Contratos mensais (SaaS)
- Fee for service
- Preços fechados (venda única)
- Principalmente serviços

## ✨ Funcionalidades Principais

### 1. **Gestão de Propostas**
- ✅ Criação de propostas com informações detalhadas
- ✅ Múltiplas modalidades de produtos/serviços por proposta
- ✅ Sistema de salvar/carregar propostas com localStorage
- ✅ Duplicação de propostas existentes
- ✅ Exclusão de propostas
- ✅ Importação/Exportação em formato JSON

### 2. **Modalidades de Produtos/Serviços**
- ✅ Tipos de cobrança: Mensal, Pagamento Único, Customizado
- ✅ Informações de preços e valores
- ✅ Lista de itens inclusos
- ✅ Lista de itens não inclusos (opcional)
- ✅ Responsabilidades do fornecedor e cliente
- ✅ Vantagens competitivas
- ✅ Link de detalhamento externo (opcional)
- ✅ **Cópia automática de dados**: Ao adicionar uma segunda modalidade, os dados de "O que está incluso", "O que não está incluso" e "Vantagens" da primeira modalidade são copiados automaticamente

### 3. **Comparativo entre Modalidades**
- ✅ Tabela comparativa automática quando há 2+ modalidades
- ✅ Comparação visual de características e preços
- ✅ Destaque de investimento inicial e forma de pagamento

### 4. **Informações Adicionais**
- ✅ Formas de pagamento
- ✅ Descontos aplicáveis
- ✅ Observações gerais
- ✅ Notas técnicas
- ✅ Termos e condições de contratação

### 5. **Modos de Visualização**
- ✅ **Modo Formulário**: Edição completa da proposta
- ✅ **Modo Preview**: Visualização final da proposta
- ✅ **Modo Split (Preview ao Vivo)**: Edição e preview simultâneos

### 6. **Exportação**
- ✅ **Exportação HTML**: Landing page standalone com CSS embutido
- ✅ **Exportação PDF**: Formato A4 com jsPDF nativo (sem dependências de renderização)
- ✅ **Exportação JSON**: Backup e compartilhamento de propostas
- ✅ Logo da empresa Collos incluído nas exportações

### 7. **Interface Moderna**
- ✅ Design minimalista e profissional
- ✅ Responsiva para desktop e mobile
- ✅ Sistema de notificações (toast)
- ✅ Drawer lateral para gerenciar propostas salvas
- ✅ Componentes UI baseados em shadcn/ui

## 🛠️ Tecnologias Utilizadas

### **Core**
- **React 18** - Biblioteca principal para UI
- **TypeScript** - Tipagem estática
- **Vite** - Build tool e dev server

### **Estilização**
- **Tailwind CSS v4** - Framework CSS utility-first
- **CSS Custom Properties** - Variáveis CSS para temas

### **Componentes UI**
- **Radix UI** - Componentes primitivos acessíveis
  - `@radix-ui/react-accordion`
  - `@radix-ui/react-alert-dialog`
  - `@radix-ui/react-dialog`
  - `@radix-ui/react-dropdown-menu`
  - `@radix-ui/react-label`
  - `@radix-ui/react-select`
  - `@radix-ui/react-separator`
  - `@radix-ui/react-slot`
  - `@radix-ui/react-tabs`
  - `@radix-ui/react-toast`
- **shadcn/ui** - Biblioteca de componentes construída sobre Radix UI

### **Ícones**
- **lucide-react** - Biblioteca de ícones SVG

### **Notificações**
- **sonner@2.0.3** - Sistema de toast notifications

### **Exportação**
- **jsPDF** - Geração de PDFs nativos

### **Utilitários**
- **class-variance-authority (cva)** - Gerenciamento de variantes de classes CSS
- **clsx** - Utilitário para construção de classes condicionais
- **tailwind-merge** - Merge inteligente de classes Tailwind

## 📁 Estrutura do Projeto

```
/
├── App.tsx                          # Componente principal e roteamento de views
├── styles/
│   └── globals.css                  # Estilos globais e tokens CSS
├── components/
│   ├── ProposalForm.tsx            # Formulário principal de criação/edição
│   ├── ProposalPreview.tsx         # Preview da proposta gerada
│   ├── ModalityForm.tsx            # Formulário de modalidade individual
│   ├── ModalityComparison.tsx      # Tabela comparativa entre modalidades
│   ├── SavedProposals.tsx          # Gerenciador de propostas salvas
│   ├── figma/
│   │   └── ImageWithFallback.tsx   # Componente protegido para imagens
│   └── ui/                          # Componentes UI reutilizáveis (shadcn/ui)
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── textarea.tsx
│       ├── select.tsx
│       ├── dialog.tsx
│       ├── sheet.tsx
│       ├── drawer.tsx
│       ├── separator.tsx
│       ├── tabs.tsx
│       ├── table.tsx
│       ├── badge.tsx
│       ├── sonner.tsx
│       └── ... (outros componentes)
├── hooks/
│   └── useProposals.ts             # Hook customizado para gerenciar propostas
├── utils/
│   ├── exportHTML.ts               # Utilitário de exportação HTML
│   └── exportPDF.ts                # Utilitário de exportação PDF
├── guidelines/
│   └── Guidelines.md               # Diretrizes do projeto
└── Attributions.md                 # Atribuições e licenças

```

## 🚀 Instalação e Configuração

### Pré-requisitos

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0 ou **yarn** >= 1.22.0

### Passo a Passo

1. **Clone o repositório** (ou extraia os arquivos do projeto):
```bash
cd gerador-propostas-collos
```

2. **Instale as dependências**:
```bash
npm install
```

Ou se preferir usar yarn:
```bash
yarn install
```

3. **Inicie o servidor de desenvolvimento**:
```bash
npm run dev
```

Ou com yarn:
```bash
yarn dev
```

4. **Acesse a aplicação**:
Abra seu navegador em `http://localhost:5173` (ou a porta indicada no terminal)

### Build para Produção

Para criar uma build otimizada para produção:

```bash
npm run build
```

Os arquivos compilados estarão na pasta `dist/`.

Para testar a build de produção localmente:

```bash
npm run preview
```

## 📦 Dependências Principais

### Dependencies (Produção)

```json
{
  "@radix-ui/react-*": "^1.x.x",     // Componentes UI primitivos
  "lucide-react": "^0.x.x",           // Ícones
  "sonner": "2.0.3",                  // Toast notifications
  "jspdf": "^2.x.x",                  // Geração de PDF
  "clsx": "^2.x.x",                   // Utilitário de classes
  "tailwind-merge": "^2.x.x",         // Merge de classes Tailwind
  "class-variance-authority": "^0.x.x" // Gerenciamento de variantes
}
```

### DevDependencies (Desenvolvimento)

```json
{
  "react": "^18.x.x",
  "react-dom": "^18.x.x",
  "typescript": "^5.x.x",
  "vite": "^5.x.x",
  "@vitejs/plugin-react": "^4.x.x",
  "tailwindcss": "^4.x.x",
  "postcss": "^8.x.x",
  "autoprefixer": "^10.x.x"
}
```

## 💡 Como Usar

### 1. Criar uma Nova Proposta

1. Preencha as **Informações Gerais**:
   - Título da Proposta
   - Nome do Cliente
   - Objetivo do projeto

2. Adicione **Modalidades** clicando em "Adicionar Modalidade":
   - Nome da modalidade (ex: "SaaS", "Venda Direta")
   - Valor (ex: "R$ 490,00")
   - Tipo de cobrança (Mensal/Único/Customizado)
   - Itens inclusos
   - Itens não inclusos (opcional)
   - Responsabilidades do fornecedor e cliente
   - Vantagens
   - Link de detalhamento (opcional)

3. Preencha as **Informações Adicionais** (opcionais):
   - Formas de pagamento
   - Descontos
   - Observações
   - Notas técnicas
   - Termos e condições

4. Clique em **"Visualizar Proposta"** ou use o **"Preview ao Vivo"**

### 2. Salvar uma Proposta

- No formulário: Clique em **"Salvar Proposta"** (exige título e nome do cliente)
- No preview: Clique em **"Salvar na Biblioteca"**

As propostas são salvas automaticamente no **localStorage** do navegador.

### 3. Gerenciar Propostas Salvas

1. Clique em **"Propostas Salvas"** no header
2. No drawer lateral você pode:
   - **Carregar**: Retomar edição de uma proposta
   - **Duplicar**: Criar cópia de uma proposta existente
   - **Exportar JSON**: Baixar backup da proposta
   - **Excluir**: Remover proposta (com confirmação)
   - **Importar JSON**: Carregar proposta de arquivo

### 4. Exportar uma Proposta

No modo preview, você pode exportar em 3 formatos:

1. **Exportar HTML**:
   - Landing page standalone
   - CSS embutido
   - Funciona sem internet
   - Inclui logo da Collos

2. **Exportar PDF**:
   - Formato A4 profissional
   - Geração nativa com jsPDF
   - Inclui todas as seções
   - Links clicáveis (detalhamento)

3. **Exportar JSON**:
   - Backup completo dos dados
   - Importação posterior
   - Compartilhamento entre usuários

## 🎨 Personalização

### Cores e Temas

Os tokens de cor estão definidos em `/styles/globals.css`:

```css
:root {
  --background: #ffffff;
  --foreground: #111827;
  --primary: #2563eb;
  --muted: #f3f4f6;
  /* ... outros tokens */
}
```

Para personalizar, edite esses valores mantendo o formato CSS custom properties.

### Logo da Empresa

O logo da Collos está referenciado em:
- `App.tsx` (header da aplicação)
- `exportHTML.ts` (exportação HTML)
- `exportPDF.ts` (exportação PDF)

Para trocar o logo, substitua a referência `figma:asset/55665678682f81e5dab672710086b014bc798337.png` pelo caminho do seu logo.

## 🔒 Armazenamento de Dados

### LocalStorage

As propostas são armazenadas localmente usando a chave `collos_saved_proposals`. Os dados incluem:

```typescript
{
  id: string;              // UUID único
  name: string;            // Nome da proposta
  data: ProposalData;      // Todos os dados da proposta
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
}
```

### Backup e Restauração

- **Backup manual**: Use "Exportar JSON" para cada proposta
- **Restauração**: Use "Importar JSON" no gerenciador de propostas
- **Limpeza**: Limpar localStorage do navegador remove todas as propostas

## 📄 Tipos TypeScript

### ProposalData

```typescript
type ProposalData = {
  title: string;              // Título da proposta
  clientName: string;         // Nome do cliente
  objective: string;          // Objetivo do projeto
  modalities: Modality[];     // Array de modalidades
  paymentMethods?: string;    // Formas de pagamento (opcional)
  discounts?: string;         // Descontos (opcional)
  observations?: string;      // Observações (opcional)
  technicalNotes?: string;    // Notas técnicas (opcional)
  terms?: string;             // Termos e condições (opcional)
};
```

### Modality

```typescript
type Modality = {
  id: string;                 // UUID único
  name: string;               // Nome da modalidade
  price: string;              // Valor formatado
  billingType: 'monthly' | 'oneTime' | 'custom';
  included: string[];         // Itens inclusos
  notIncluded?: string[];     // Itens não inclusos (opcional)
  responsibilities?: {
    provider: string;         // Responsabilidades do fornecedor
    client: string;           // Responsabilidades do cliente
  };
  advantages?: string[];      // Vantagens (opcional)
  detailsLink?: string;       // Link de detalhamento (opcional)
};
```

## 🧩 Componentes Principais

### ProposalForm
**Local**: `/components/ProposalForm.tsx`

Formulário principal para criação e edição de propostas. Gerencia estado local e sincronização com componente pai.

**Props**:
- `initialData`: Dados iniciais da proposta
- `onSave`: Callback ao submeter formulário
- `onChange`: Callback para mudanças em tempo real
- `livePreview`: Modo de preview ao vivo
- `onSaveToLibrary`: Callback para salvar na biblioteca

### ProposalPreview
**Local**: `/components/ProposalPreview.tsx`

Visualização final da proposta com layout profissional. Inclui botões de exportação.

**Props**:
- `data`: Dados da proposta
- `onSave`: Callback para salvar
- `hideActions`: Ocultar botões de ação

### ModalityForm
**Local**: `/components/ModalityForm.tsx`

Formulário para configurar uma modalidade individual. Interface interativa para adicionar/remover itens.

**Props**:
- `modality`: Dados da modalidade
- `onChange`: Callback para mudanças

### SavedProposals
**Local**: `/components/SavedProposals.tsx`

Gerenciador de propostas salvas com opções de carregar, duplicar, exportar e excluir.

**Props**:
- `proposals`: Lista de propostas salvas
- `onLoad`: Callback ao carregar proposta
- `onDuplicate`: Callback ao duplicar
- `onDelete`: Callback ao excluir
- `onExportJSON`: Callback ao exportar JSON
- `onImportJSON`: Callback ao importar JSON

## 🪝 Hooks Customizados

### useProposals
**Local**: `/hooks/useProposals.ts`

Hook para gerenciar todas as operações com propostas salvas:

```typescript
const {
  proposals,           // Lista de propostas
  saveProposal,        // Salvar nova proposta
  updateProposal,      // Atualizar proposta existente
  deleteProposal,      // Excluir proposta
  duplicateProposal,   // Duplicar proposta
  exportToJSON,        // Exportar proposta para JSON
  importFromJSON,      // Importar proposta de JSON
} = useProposals();
```

## 🔧 Utilitários

### exportHTML
**Local**: `/utils/exportHTML.ts`

Gera HTML standalone completo com CSS embutido. Inclui:
- Todas as seções da proposta
- Tabela comparativa (se múltiplas modalidades)
- Estilos responsivos
- Logo da empresa
- Links clicáveis

### exportPDF
**Local**: `/utils/exportPDF.ts`

Gera PDF nativo usando jsPDF. Características:
- Formato A4 (210mm x 297mm)
- Quebra de página automática
- Texto nativo (copiável e pesquisável)
- Links clicáveis
- Layout profissional
- Footer com data de geração

## 🎯 Melhorias Implementadas Recentemente

### 1. Cópia Automática de Dados entre Modalidades
Quando você adiciona uma segunda modalidade (ou subsequentes), o sistema automaticamente copia:
- Todos os itens de "O que está incluso"
- Todos os itens de "O que não está incluso"
- Todas as vantagens

Isso evita retrabalho ao criar propostas com múltiplas modalidades similares.

### 2. Campo de Link de Detalhamento
Cada modalidade pode ter um link opcional para mais informações. O link:
- Aparece como botão estilizado no preview
- É incluído nas exportações HTML como link clicável
- É incluído nas exportações PDF como link clicável
- Perfeito para links de download de especificações técnicas

## 🐛 Troubleshooting

### Problema: Propostas não estão sendo salvas
**Solução**: Verifique se o localStorage está habilitado no navegador e não está cheio.

### Problema: PDF não está gerando corretamente
**Solução**: Verifique se a biblioteca jsPDF está instalada corretamente com `npm install jspdf`.

### Problema: Logo não aparece nas exportações
**Solução**: Verifique se o caminho do logo está correto e se a imagem é acessível.

### Problema: Estilos não aplicados corretamente
**Solução**: Limpe o cache do navegador e reconstrua o projeto com `npm run build`.

## 📈 Próximas Evoluções Sugeridas

1. **Backend Integration**:
   - Persistência em banco de dados
   - Autenticação de usuários
   - Multi-empresa (white-label)

2. **Funcionalidades Adicionais**:
   - Templates de propostas
   - Histórico de versões
   - Comentários e aprovações
   - Assinatura digital

3. **Customização**:
   - Editor de temas visuais
   - Upload de logo personalizado
   - Campos customizados por empresa

4. **Integrações**:
   - CRM (Salesforce, HubSpot, Pipedrive)
   - E-mail marketing
   - Assinatura eletrônica (DocuSign, ClickSign)

5. **Análises**:
   - Tracking de visualização
   - Taxa de conversão
   - Relatórios de propostas

## 📝 Licença

Este projeto foi desenvolvido exclusivamente para a empresa **Collos**. Todos os direitos reservados.

## 👥 Suporte

Para dúvidas ou suporte técnico, entre em contato com a equipe de desenvolvimento da Collos.

---

**Desenvolvido com ❤️ para Collos**

*Última atualização: Fevereiro de 2026*
