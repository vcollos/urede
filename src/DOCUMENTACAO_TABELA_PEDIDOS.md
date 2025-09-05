# Documentação - Tabela "Pedidos" do Sistema Uniodonto

## 📋 Campos Necessários para a Tabela "Pedidos"

### 🔍 Identificação Principal
```typescript
id: string                          // Formato: PED_timestamp_random (Ex: PED_1703123456789_abc123)
titulo: string                      // Título descritivo do pedido (Ex: "Credenciamento Ortodontista - Urgente")
```

### 👥 Relacionamentos e Responsabilidades
```typescript
criado_por: string                  // ID do usuário que criou o pedido
cooperativa_solicitante_id: string // ID da cooperativa que fez a solicitação
cooperativa_responsavel_id: string // ID da cooperativa atualmente responsável
cidade_id: string                   // Código da cidade (cd_municipio_7)
responsavel_atual_id?: string       // ID do operador específico responsável (opcional)
```

### 📍 Dados de Localização
```typescript
cidade_nome?: string                // Nome da cidade (preenchido via lookup)
estado?: string                     // UF do estado (preenchido via lookup)
cooperativa_solicitante_nome?: string // Nome da cooperativa (preenchido via lookup)
responsavel_atual_nome?: string     // Nome do responsável (preenchido via lookup)
```

### 🦷 Dados da Solicitação
```typescript
especialidades: string[]            // Array de especialidades odontológicas solicitadas
                                    // Ex: ["Ortodontia", "Endodontia"]
quantidade: number                  // Quantidade de profissionais necessários
observacoes: string                 // Observações detalhadas sobre a necessidade
prioridade: 'baixa' | 'media' | 'alta' | 'urgente' // Nível de prioridade
```

### 🔄 Controle de Fluxo
```typescript
nivel_atual: 'singular' | 'federacao' | 'confederacao' // Nível atual do pedido
status: 'novo' | 'em_andamento' | 'concluido' | 'cancelado' // Status do pedido
```

### ⏰ Controle de Tempo e Prazos
```typescript
data_criacao: string               // ISO string da data de criação
data_ultima_alteracao: string      // ISO string da última modificação
prazo_atual: string                // ISO string do prazo atual (30 dias por nível)
dias_restantes: number             // Calculado dinamicamente (prazo_atual - hoje)
```

## 🎯 Regras de Negócio Implementadas

### ⏳ Sistema de SLA (Service Level Agreement)
- **30 dias** por nível hierárquico
- **Singular** → **Federação** → **Confederação**
- Escalonamento automático em caso de vencimento

### 🔄 Fluxo de Escalonamento
1. **Criação**: Pedido criado no nível "singular"
2. **Prazo**: 30 dias para resolução
3. **Vencimento**: Se não resolvido, escalona automaticamente
4. **Federação**: Novo prazo de 30 dias
5. **Confederação**: Último nível, prazo final de 30 dias

### 🛡️ Controle de Acesso por Nível
- **Operador**: Vê apenas pedidos da sua cooperativa
- **Federação**: Vê pedidos escalados + da sua federação
- **Confederação**: Vê pedidos escalados nacionais
- **Admin**: Vê todos os pedidos

### 📊 Especialidades Disponíveis
```typescript
const especialidades = [
  'Clínica Geral',
  'Ortodontia',
  'Endodontia',
  'Periodontia',
  'Cirurgia Oral',
  'Cirurgia Bucomaxilofacial',
  'Implantodontia',
  'Prótese Dentária',
  'Odontopediatria',
  'Radiologia Oral'
];
```

## 🔧 Implementação Técnica

### 🗄️ Armazenamento
- **KV Store**: `pedido:${id}` para dados principais
- **Lista**: `pedidos:list` para IDs de todos os pedidos
- **Auditoria**: `auditoria:pedido:${pedido_id}` para histórico

### 🤖 Automações
- **Cron Job**: Executa a cada hora
- **Verificação**: Prazos vencidos
- **Escalonamento**: Automático baseado em regras
- **Auditoria**: Log completo de todas as ações

### 🔒 Segurança
- **Autenticação**: JWT via Supabase Auth
- **Autorização**: RBAC baseado em papel e cooperativa
- **Validação**: Campos obrigatórios e tipos

## 📝 Exemplo de Registro Completo

```json
{
  "id": "PED_1703123456789_abc123",
  "titulo": "Credenciamento Ortodontista - São Paulo Centro",
  "criado_por": "user_123",
  "cooperativa_solicitante_id": "SING001",
  "cooperativa_responsavel_id": "SING001",
  "cidade_id": "3550308",
  "especialidades": ["Ortodontia"],
  "quantidade": 2,
  "observacoes": "Necessário credenciamento urgente na região central",
  "nivel_atual": "singular",
  "status": "em_andamento",
  "prioridade": "alta",
  "data_criacao": "2024-12-21T10:30:00.000Z",
  "data_ultima_alteracao": "2024-12-21T10:30:00.000Z",
  "prazo_atual": "2025-01-20T10:30:00.000Z",
  "dias_restantes": 30,
  "cidade_nome": "São Paulo",
  "estado": "SP",
  "cooperativa_solicitante_nome": "Uniodonto São Paulo",
  "responsavel_atual_id": "user_456",
  "responsavel_atual_nome": "Maria Silva"
}
```

## ✅ Status da Implementação

✅ **Totalmente Implementado**:
- Estrutura de dados completa
- Sistema de autenticação JWT + RBAC
- Escalonamento automático
- Controle de prazos e SLA
- Auditoria completa
- Interface frontend React/TypeScript
- Backend Supabase + Hono

✅ **Integração Supabase**:
- Edge Functions configuradas
- KV Store funcionando
- Autenticação integrada
- CORS configurado
- Persistência de dados