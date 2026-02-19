# 📝 Histórico de Mudanças (Changelog)

Todas as mudanças notáveis neste projeto estão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [1.3.0] - 2026-02-14

### ✨ Adicionado
- **Campo de Link de Detalhamento**: Cada modalidade agora pode ter um link opcional para mais informações
  - Campo opcional no formulário de modalidade
  - Exibição como botão estilizado no preview da proposta
  - Link clicável nas exportações HTML
  - Link clicável nas exportações PDF (usando `textWithLink`)
  - Útil para documentação técnica, PDFs de especificações, etc.

### 🔄 Melhorado
- **Cópia Automática entre Modalidades**: Ao adicionar uma segunda modalidade ou subsequentes, o sistema agora copia automaticamente:
  - Todos os itens de "O que está incluso"
  - Todos os itens de "O que não está incluso"  
  - Todas as vantagens
  - Objetivo: Reduzir retrabalho em propostas com modalidades similares

### 🐛 Corrigido
- Nenhuma correção nesta versão

---

## [1.2.0] - 2026-02-13

### ✨ Adicionado
- **Sistema de Propostas Salvas**: Gerenciamento completo de propostas
  - Salvar propostas com nome customizado
  - Listar todas as propostas salvas
  - Carregar proposta para edição
  - Duplicar propostas existentes
  - Excluir propostas (com confirmação)
  - Armazenamento no localStorage do navegador

- **Import/Export JSON**: Backup e compartilhamento
  - Exportar propostas individuais para JSON
  - Importar propostas de arquivos JSON
  - Preservação completa dos dados
  - Timestamps de criação e atualização

- **Drawer Lateral**: Interface para gerenciar propostas
  - Componente Sheet (drawer) do lado direito
  - Visualização em cards das propostas salvas
  - Ações rápidas para cada proposta
  - Contador de propostas no header
  - Responsivo para mobile

### 🔄 Melhorado
- Interface do header com melhor organização dos botões
- Feedback visual com toasts para todas as ações
- Persistência automática no localStorage

---

## [1.1.0] - 2026-02-12

### ✨ Adicionado
- **Exportação HTML Standalone**: 
  - Landing page completa com CSS embutido
  - Funciona offline sem dependências
  - Logo da Collos incluído em base64
  - Estilos responsivos para impressão
  - Compatível com todos os navegadores modernos

- **Exportação PDF Nativa**:
  - Geração usando jsPDF (texto nativo, não screenshot)
  - Formato A4 profissional (210x297mm)
  - Texto selecionável e copiável
  - Pesquisável (Ctrl+F funciona no PDF)
  - Quebra de página automática e inteligente
  - Todas as seções da proposta incluídas
  - Footer com data de geração

- **Tabela Comparativa**:
  - Comparação automática entre modalidades (quando 2+)
  - Tabela visual com características
  - Comparação de preços e investimento inicial
  - Incluída em preview, HTML e PDF

### 🔄 Melhorado
- Layout de exportação mais profissional
- Tipografia melhorada no PDF
- Separadores visuais entre seções

---

## [1.0.0] - 2026-02-10

### ✨ Adicionado - Release Inicial

**Core Functionality**:
- Criação de propostas comerciais
- Sistema de modalidades múltiplas
- Três modos de visualização:
  - Formulário completo
  - Preview da proposta
  - Split view (edição + preview)

**Informações da Proposta**:
- Título da proposta
- Nome do cliente
- Objetivo do projeto
- Múltiplas modalidades configuráveis
- Formas de pagamento
- Descontos
- Observações gerais
- Notas técnicas
- Termos e condições

**Modalidades de Produtos/Serviços**:
- Nome da modalidade
- Valor/preço
- Tipo de cobrança (Mensal, Único, Customizado)
- Lista de itens inclusos
- Lista de itens não inclusos (opcional)
- Responsabilidades do fornecedor
- Responsabilidades do cliente
- Vantagens competitivas (opcional)

**Interface**:
- Design minimalista e profissional
- Responsivo (desktop e mobile)
- Header com logo da Collos
- Sistema de notificações (toast)
- Formulários interativos com validação

**Componentes UI**:
- Biblioteca completa baseada em shadcn/ui
- Componentes Radix UI para acessibilidade
- Ícones Lucide React
- Cards, Buttons, Inputs, Textareas
- Dialogs, Sheets, Separators
- Tabs, Tables, Badges

**Tecnologias**:
- React 18 com TypeScript
- Vite para build e dev server
- Tailwind CSS 4 para estilização
- localStorage para persistência
- jsPDF para geração de PDF

---

## 🎯 Roadmap - Próximas Versões

### [1.4.0] - Planejado
- [ ] Templates de propostas pré-configuradas
- [ ] Sistema de tags para categorização
- [ ] Busca e filtros avançados
- [ ] Histórico de versões das propostas
- [ ] Preview de impressão otimizado

### [1.5.0] - Planejado
- [ ] Temas personalizáveis (dark mode)
- [ ] Upload de logo customizado
- [ ] Customização de cores e fontes
- [ ] Campos customizados por empresa
- [ ] Multi-idioma (i18n)

### [2.0.0] - Futuro
- [ ] Backend com persistência em banco de dados
- [ ] Autenticação de usuários
- [ ] Multi-empresa (white-label)
- [ ] Compartilhamento de propostas por link
- [ ] Sistema de aprovações e comentários
- [ ] Assinatura digital integrada
- [ ] Integrações com CRM (Salesforce, HubSpot)
- [ ] Analytics e tracking de visualizações
- [ ] API REST para integrações

---

## 📊 Estatísticas do Projeto

### Versão Atual: 1.3.0

**Componentes**:
- 6 componentes principais
- 40+ componentes UI reutilizáveis
- 1 hook customizado
- 2 utilitários de exportação

**Linhas de Código** (aproximado):
- TypeScript/React: ~3.500 linhas
- CSS: ~500 linhas
- Total: ~4.000 linhas

**Funcionalidades**:
- 3 modos de visualização
- 3 formatos de exportação
- 6 tipos de informações principais
- Ilimitadas modalidades por proposta

**Tecnologias**:
- 1 framework principal (React)
- 18+ bibliotecas de componentes
- 3 utilitários de estilização
- 1 biblioteca de exportação

---

## 🔖 Convenções de Versionamento

### Tipos de Mudanças:
- **Added**: Novas funcionalidades
- **Changed**: Mudanças em funcionalidades existentes
- **Deprecated**: Funcionalidades que serão removidas
- **Removed**: Funcionalidades removidas
- **Fixed**: Correções de bugs
- **Security**: Correções de segurança

### Versionamento Semântico (SemVer):

```
MAJOR.MINOR.PATCH

1.3.0
│ │ │
│ │ └─ PATCH: Correções de bugs e pequenas melhorias
│ └─── MINOR: Novas funcionalidades (backward compatible)
└───── MAJOR: Mudanças que quebram compatibilidade
```

**Exemplos**:
- `1.0.0` → `1.0.1`: Bug fix (incrementa PATCH)
- `1.0.1` → `1.1.0`: Nova feature (incrementa MINOR)
- `1.9.9` → `2.0.0`: Breaking change (incrementa MAJOR)

---

## 📋 Registro de Decisões Técnicas

### Por que localStorage ao invés de banco de dados?
**Decisão**: Versão 1.x usa localStorage para simplicidade  
**Motivo**: Aplicação standalone, sem necessidade de backend  
**Futuro**: Versão 2.0 terá opção de backend opcional

### Por que jsPDF ao invés de screenshot?
**Decisão**: Usar jsPDF com texto nativo  
**Motivo**:
- Texto selecionável e copiável
- Pesquisável no PDF
- Links clicáveis
- Menor tamanho de arquivo
- Melhor qualidade

### Por que Radix UI ao invés de Material-UI?
**Decisão**: Usar Radix UI + shadcn/ui  
**Motivo**:
- Não estilizado (flexibilidade total)
- Acessibilidade AAA
- Menor bundle size
- Composição flexível
- Mantido ativamente

### Por que Tailwind v4?
**Decisão**: Usar Tailwind CSS 4  
**Motivo**:
- CSS custom properties nativo
- Performance melhorada
- Sintaxe mais limpa
- Melhor DX com IntelliSense
- Futuro-proof

---

## 🎉 Agradecimentos

**Equipe de Desenvolvimento**: Contribuições e feedback valioso  
**Usuários Beta**: Testes e sugestões de melhorias  
**Comunidade Open Source**: Bibliotecas e ferramentas incríveis

---

## 📞 Contribuindo

Para reportar bugs ou sugerir funcionalidades:

1. Verifique se já não existe uma issue/sugestão similar
2. Descreva detalhadamente o problema ou sugestão
3. Inclua prints ou exemplos quando possível
4. Entre em contato com a equipe de desenvolvimento

---

## 📄 Licença

Este projeto é propriedade exclusiva da **Collos**.  
Todos os direitos reservados.

---

**Mantido por**: Equipe de Desenvolvimento Collos  
**Última atualização deste arquivo**: 14 de Fevereiro de 2026  
**Versão do projeto**: 1.3.0
