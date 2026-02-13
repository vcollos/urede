# Regras de Implementação do Projeto

## Regra canônica de telefone (obrigatória)

1. Todo número deve ser armazenado no campo `telefone` (string, somente dígitos).
2. O indicador de WhatsApp deve ser armazenado em `wpp` (0/1).
3. Para contatos telefônicos, o tipo canônico é `telefone`.
4. Campos legados (`telefone_fixo`, `telefone_celular`, `whatsapp` texto) são apenas retrocompatibilidade e não devem ser usados em novos fluxos.
5. Em `urede_operadores`, usar `telefone` + `wpp`; o campo `whatsapp` texto é legado para compatibilidade.

## Formatação (frontend)

- Celular BR: `(DD) 9 0000-0000`
- Fixo BR: `(DD) 0000-0000`
- 0800: `0800 0000 0000`

## Importação de dados

- Telefone: aceitar somente números (sem máscara).
- `wpp`: aceitar `0/1`, `true/false`, `sim/não`.
- Se número parecer celular brasileiro (11 dígitos com 3º dígito = 9), pode ser marcado automaticamente como `wpp=1` quando não informado.

## Governança

- Após mudanças de regra de dados, atualizar:
  - `README.md`
  - `doc.md`
  - este arquivo `AGENTS.md`

## Navegação administrativa

- O menu `Usuários` (id `operadores`) e `Gestão de dados` (id `gestao_dados`) é tratado como subitem de `Configurações`.
- Esses dois itens devem ficar disponíveis somente para usuários com papel `admin`.
