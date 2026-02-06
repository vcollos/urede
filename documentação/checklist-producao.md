# Checklist de Producao

## Ambiente e banco
- Schema `urede` existe e contem todas as tabelas listadas no escopo.
- `DB_SCHEMA=urede` e `DATABASE_DB_URL` configurados no backend.
- RLS ativo e validado para institucional e pedidos.
- `reg_ans` normalizado e sem duplicacao de colunas derivadas em `urede_cidades`.

## Backend
- API aponta para Postgres/Supabase.
- Queries qualificadas com `urede.<tabela>`.
- JWT inclui `cooperativa_id` e `papel_usuario`.
- Soft delete de pedidos habilitado (`excluido`).
- Endpoints institucionais e prestadores ativos.

## Frontend
- Cooperativas exibem dados padronizados (singular, reg_ans, razao_social).
- Aba Institucional visivel; edicao apenas para admins no escopo.
- Prestadores: busca publica funcionando.
- Pedidos: fluxo completo (criar, atualizar, transferir, alertas, auditoria).

## Operacao
- Logs de auditoria e alertas sendo gravados.
- Escalonamento rodando sem erros.
- Relatorios e dashboard sem falhas.

## Pos-deploy
- Executar `db/migrations/sanity-check.sql`.
- Validar um fluxo completo de pedido ponta a ponta.
