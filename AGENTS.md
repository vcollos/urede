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

## Regra canônica de pessoas (obrigatória)

1. O cadastro de pessoas deve ser centralizado em `urede_pessoas`.
2. O vínculo por cooperativa/tela deve ser feito em `urede_pessoa_vinculos` usando `id_singular`.
3. Tabelas legadas (`urede_cooperativa_diretores`, `..._conselhos`, `..._colaboradores`, `..._ouvidores`, `..._lgpd`, `..._auditores`, `..._regulatorio`) permanecem para retrocompatibilidade e migração.
4. Novos fluxos de CRUD devem priorizar `urede_pessoas` + `urede_pessoa_vinculos`.
5. `Contatos` (`urede_cooperativa_contatos`) não fazem parte dessa unificação.

## Navegação modular (UHub / URede)

- Funcionalidades globais devem ficar no contexto **UHub** (homepage, cooperativas, cidades, central de apps).
- Funcionalidades de operação de pedidos devem ficar no contexto **módulo URede** (dashboard, relatórios, pedidos, pedidos em lote, novo pedido).
- Rotas legadas podem ser mantidas apenas para compatibilidade; novos fluxos devem priorizar rotas com prefixo de módulo (`/hub/*`, `/urede/*`).
- Rotas canônicas do Hub para apps integrados: `/hub/apps` e `/hub/apps/<slug>` (ex.: `/hub/apps/propostas`, `/hub/apps/assinatura-email`).
- Configurações são contextuais por módulo:
  - Hub: `/hub/configuracoes` (cadastros globais de dados cadastrais)
  - URede: `/urede/configuracoes` (fluxo de aprovação e categorias de pedidos)
- Apenas **Administrador da Confederação** pode alterar configurações de módulo.

## Central de Apps e sub_apps (obrigatório)

1. Novos apps em `sub_apps/*` devem priorizar integração dentro do shell do UHub, mantendo layout e Tailwind do UHub.
2. A rota preferencial para consumo é sempre `/hub/apps/<slug>`.
3. Execução standalone de sub app é opcional e usada apenas para manutenção isolada quando necessário.
4. Quando houver standalone local, usar a faixa de portas `3501-3599`.
5. Ao integrar novo app, atualizar `README.md`, `doc.md` e este `AGENTS.md` com rota canônica e porta reservada (se houver standalone).
6. Mapeamento atual:
   - `sub_apps/proposta` => rota canônica `/hub/apps/propostas` (standalone `3501`).
   - `sub_apps/email_signature` => rota canônica `/hub/apps/assinatura-email` (standalone `3502`).

## Vínculo de usuários e singulares

- Usuários podem ser associados a **uma ou mais singulares**.
- A singular principal permanece em `id_singular` (`urede_operadores`) e `cooperativa_id` (`auth_users`).
- Associações adicionais devem ser persistidas em `auth_user_cooperativas` com `is_primary` (0/1).
- Novos fluxos de cadastro/edição devem sempre enviar `cooperativas_ids` + `cooperativa_principal_id` quando houver gestão de usuários.

## Endereços (cadastro único)

- O CRUD principal de endereços deve ocorrer em `cooperativa_enderecos`.
- O campo `exibir_visao_geral` (0/1) define se o endereço aparece na aba **Visão Geral**.
- Endereços do tipo `plantao_urgencia_emergencia` devem sincronizar com `cooperativa_plantao_clinicas` (via `plantao_clinica_id`/`endereco_id`) para evitar cadastros duplicados.

## Catálogos cadastrais globais (Hub)

- As listas globais ficam em `settings.value` (`key = system_preferences`) no objeto `hub_cadastros`.
- Chaves atuais: `tipos_endereco`, `tipos_conselho`, `tipos_contato`, `subtipos_contato`, `redes_sociais`, `departamentos`.
- Esses catálogos devem ser consumidos nas telas de cadastro auxiliar (cooperativas) com fallback para valores padrão.
