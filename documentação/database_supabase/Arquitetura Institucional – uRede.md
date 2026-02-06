## Visão Geral
O uRede é um sistema cooperativista hierárquico para gestão de rede, pedidos e prestadores, seguindo a estrutura institucional do sistema Uniodonto.

A arquitetura separa claramente:
- **Entidades institucionais (cooperativas)**
- **Pessoas (usuários)**
- **Dados informativos**
- **Dados transacionais (pedidos)**

---

## Estrutura de Cooperativas

### Níveis Institucionais
- **Confederação**
- **Federação**
- **Singular**

Regras:
- Toda Singular pertence a exatamente uma Federação
- Toda Federação pertence a uma Confederação
- Federações e Confederação também podem originar pedidos
- Cooperativas podem fazer pedidos para si mesmas

---

## Usuários

Usuários sempre pertencem a uma cooperativa.

### Papéis de Usuário
- **Administrador**
  - Gestão institucional
  - Gestão de usuários
- **Operador**
  - Operação do sistema (pedidos, atendimento, rede)

O papel do usuário **não define o nível**, apenas o poder dentro da cooperativa.

---

## Separação de Responsabilidades

| Tipo de dado | Natureza |
|-------------|---------|
| Cooperativas, cidades, prestadores | Informativo |
| Plantão, LGPD, diretoria | Informativo |
| Pedidos | Transacional |

Somente pedidos são manipulados no dia a dia.