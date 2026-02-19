# 🚀 Guia de Instalação Rápida

## Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- ✅ **Node.js** versão 18.0.0 ou superior
- ✅ **npm** versão 9.0.0 ou superior (ou yarn 1.22.0+)

### Verificar versões instaladas

```bash
node --version
# Deve retornar: v18.x.x ou superior

npm --version
# Deve retornar: 9.x.x ou superior
```

Se não tiver o Node.js instalado, baixe em: https://nodejs.org/

## 📥 Instalação

### Passo 1: Navegue até a pasta do projeto

```bash
cd caminho/para/gerador-propostas-collos
```

### Passo 2: Instale as dependências

```bash
npm install
```

Ou se preferir usar yarn:

```bash
yarn install
```

Este comando irá instalar todas as dependências listadas abaixo:

**Core**:
- react@18.3.1
- react-dom@18.3.1
- typescript@5.x
- vite@5.x

**UI Components**:
- @radix-ui/react-* (múltiplos pacotes)
- lucide-react (ícones)
- sonner@2.0.3 (notificações)

**Utilities**:
- clsx
- tailwind-merge
- class-variance-authority

**Export**:
- jspdf

**Tempo estimado**: 2-5 minutos (dependendo da sua conexão)

### Passo 3: Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Ou com yarn:

```bash
yarn dev
```

### Passo 4: Acesse a aplicação

Abra seu navegador e acesse:

```
http://localhost:5173
```

Ou a porta indicada no terminal (ex: http://localhost:5174 se a porta 5173 estiver ocupada)

## ✅ Verificação da Instalação

Se tudo estiver correto, você verá:

1. ✅ Terminal mostrando:
```
VITE v5.x.x  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

2. ✅ Navegador abrindo a aplicação com:
   - Header com logo Collos
   - Formulário de criação de proposta
   - Botão "Propostas Salvas"

## 🎯 Primeiro Uso

### Criar sua primeira proposta:

1. **Preencha as informações gerais**:
   - Título: "Proposta de Teste"
   - Cliente: "Empresa Exemplo"
   - Objetivo: "Testar o sistema"

2. **Adicione uma modalidade**:
   - Clique em "Adicionar Modalidade"
   - Nome: "Plano Básico"
   - Valor: "R$ 500,00"
   - Tipo: "Mensal"
   - Adicione alguns itens inclusos

3. **Visualize a proposta**:
   - Clique em "Visualizar Proposta"
   - Veja o resultado formatado

4. **Experimente as exportações**:
   - Exportar HTML
   - Exportar PDF
   - Salvar na Biblioteca

## 🔧 Comandos Disponíveis

```bash
# Desenvolvimento (com hot reload)
npm run dev

# Build para produção
npm run build

# Preview da build de produção
npm run preview

# Verificar tipos TypeScript
npm run typecheck
```

## 📦 Build para Produção

Quando estiver pronto para deploy:

```bash
npm run build
```

Os arquivos otimizados estarão em:
```
/dist/
  ├── index.html
  ├── assets/
  │   ├── index-[hash].js
  │   ├── index-[hash].css
  │   └── ...
```

Para testar a build localmente:

```bash
npm run preview
```

## 🐛 Troubleshooting

### Erro: "Port 5173 already in use"

**Solução**: A porta está ocupada. O Vite automaticamente tentará a próxima porta (5174, 5175, etc.)

### Erro: "npm ERR! code ENOENT"

**Solução**: Certifique-se de estar na pasta correta do projeto onde está o `package.json`

### Erro: "Module not found"

**Solução**: Limpe node_modules e reinstale:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Erro: "Cannot find module 'vite'"

**Solução**: Dependências não foram instaladas corretamente:
```bash
npm install --force
```

### Página em branco no navegador

**Solução**: 
1. Abra o console do navegador (F12)
2. Verifique erros no console
3. Limpe o cache do navegador (Ctrl+Shift+R)
4. Reinicie o servidor dev

### Estilos não carregando

**Solução**:
1. Verifique se o arquivo `/styles/globals.css` existe
2. Reinicie o servidor dev
3. Limpe o cache do navegador

## 🌐 Deploy

### Opções de Hospedagem Recomendadas:

1. **Vercel** (Recomendado)
```bash
npm install -g vercel
vercel
```

2. **Netlify**
```bash
npm install -g netlify-cli
netlify deploy
```

3. **GitHub Pages**
```bash
npm run build
# Deploy pasta /dist
```

4. **Servidor Próprio**
```bash
npm run build
# Copie pasta /dist para seu servidor web
```

## 📱 Acesso em Dispositivos Móveis (Rede Local)

Para testar em celular/tablet na mesma rede:

```bash
npm run dev -- --host
```

Acesse usando o IP mostrado no terminal:
```
➜  Network: http://192.168.1.X:5173/
```

## 🔐 Variáveis de Ambiente (Futuro)

Quando houver integração com backend, crie `.env`:

```env
VITE_API_URL=https://api.collos.com
VITE_ENV=production
```

E acesse com:
```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

## 📊 Estrutura de Pastas Após Instalação

```
gerador-propostas-collos/
├── node_modules/           # Dependências (gerado após npm install)
├── public/                 # Assets estáticos
├── src/                    # Código fonte
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   └── styles/
├── .gitignore
├── package.json
├── package-lock.json      # Lockfile (gerado após npm install)
├── tsconfig.json
├── vite.config.ts
├── README.md
├── TECHNICAL_SPECS.md
└── QUICK_START.md (este arquivo)
```

## 🎓 Próximos Passos

Após a instalação, recomendamos:

1. 📖 Ler o [README.md](./README.md) completo
2. 🔍 Explorar as [Especificações Técnicas](./TECHNICAL_SPECS.md)
3. 🎨 Personalizar as cores em `/styles/globals.css`
4. 🚀 Criar sua primeira proposta real
5. 💾 Testar o sistema de salvar/carregar
6. 📤 Experimentar as exportações (HTML e PDF)

## 📞 Suporte

**Dúvidas ou problemas?**

1. Verifique a seção [Troubleshooting](#-troubleshooting) acima
2. Consulte o [README.md](./README.md) para documentação completa
3. Entre em contato com a equipe de desenvolvimento

## ✨ Recursos Adicionais

- [Documentação do React](https://react.dev/)
- [Documentação do Vite](https://vitejs.dev/)
- [Documentação do Tailwind CSS](https://tailwindcss.com/)
- [Documentação do TypeScript](https://www.typescriptlang.org/)

---

**Desenvolvido com ❤️ para Collos**

*Última atualização: Fevereiro de 2026*
