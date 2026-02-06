# RLS (Resumo)

## Regras gerais
- Leitura ampla, escrita restrita por hierarquia.
- Operador nao escreve dados institucionais.
- Admin escreve apenas dentro do seu escopo.

## Institucional (cooperativa_*)
- SELECT: todas as cooperativas podem ler.
- INSERT/UPDATE/DELETE: somente admin.
  - Admin Singular -> sua cooperativa.
  - Admin Federacao -> federacao + singulares abaixo.
  - Admin Confederacao -> todas.

## Usuarios (auth_users)
- Admin cria/edita usuarios no seu escopo.
- Operador nao cria usuarios.

## Pedidos (urede_pedidos)
- Visibilidade:
  - cooperativa_solicitante
  - cooperativa_responsavel
  - federacoes das envolvidas
  - confederacao
- INSERT: apenas cooperativa solicitante.
- UPDATE: apenas cooperativa responsavel atual.
- DELETE: nao permitido (soft delete via `excluido`).

## Observacao
O app deve funcionar sob RLS. Qualquer filtro de visibilidade em UI eh apenas conveniencia.
