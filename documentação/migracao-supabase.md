# Migracao para Supabase (schema urede)

## Objetivo
- Migrar o sistema uRede para o Postgres do Supabase usando o schema `urede`.
- Manter os fluxos centrais (Pedidos, Alertas, Auditoria, Escalonamento) sem ruptura.
- Adotar colunas padronizadas com compatibilidade retroativa via `COALESCE`.

## Principais mudancas tecnicas
- Todas as queries agora qualificam `urede.<tabela>` no Postgres.
- `reg_ans` eh o identificador canonico de operadora.
- JWT passa a incluir:
  - `cooperativa_id`
  - `papel_usuario` (admin | operador)
- O nivel institucional (Singular/Federacao/Confederacao) eh derivado de `urede.urede_cooperativas.papel_rede`.
- Exclusao de pedidos eh soft delete via `excluido`.

## Mapeamento de colunas (cooperativas)
Preferir os campos padronizados:
- `singular`
- `razao_social`
- `cnpj_padrao`
- `data_fundacao_padrao`
- `reg_ans`
- `tipo_novo`
- `papel_rede`
- `federacao_id`
- `operadora_id`
- `ativo`

Fallbacks (compatibilidade):
- `singular := COALESCE(singular, uniodonto)`
- `razao_social := COALESCE(razao_social, raz_social)`
- `cnpj := COALESCE(cnpj_padrao, cnpj)`
- `reg_ans := COALESCE(reg_ans, codigo_ans)`

## Endpoints novos/atualizados
- Institucional (CRUD com RLS):
  - `GET /institucional/:table`
  - `POST /institucional/:table`
  - `PUT /institucional/:table/:id`
  - `DELETE /institucional/:table/:id`
- Prestadores (consulta publica):
  - `GET /prestadores`
  - `GET /prestadores/ans`

## Frontend
- Aba **Institucional** em Cooperativas (CRUD com escopo admin).
- Tela **Prestadores** com busca publica (ANS + cadastro enriquecido).

## Observacoes operacionais
- RLS deve ser aplicada no Supabase para garantir visibilidade/escopo.
- Aplicacao nao deve filtrar dados sensiveis no client.
- O schema `urede` deve permanecer como default de acesso nas queries.
