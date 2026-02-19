# Sub Apps do UHub

Este diretório concentra aplicativos externos (mesma stack) usados como base de integração da **Central de Apps**.
Quando necessário, também podem rodar em modo standalone para manutenção.

## Sequência oficial de portas (desenvolvimento local)

- Faixa reservada para `sub_apps`: **3501-3599**
- Regra: cada novo app recebe a **próxima porta livre** da sequência.
- Não reutilizar porta já atribuída em outro app ativo.

## Registro de portas

| App | Pasta | Porta local | URL padrão |
|---|---|---:|---|
| Gerador de Propostas | `sub_apps/proposta` | 3501 | `http://localhost:3501` (standalone opcional) |
| Gerador de Assinaturas de Email | `sub_apps/email_signature` | 3502 | `http://localhost:3502` (standalone opcional) |
| UDocs | `sub_apps/central_arquivos` | 3503 | `http://localhost:3503` (standalone opcional; canônico em `/udocs/dashboard`, com legado `/hub/apps/central-arquivos`) |

## Checklist para adicionar um novo sub app

1. Definir a próxima porta livre na faixa `3501-3599`.
2. Ajustar `server.port` no `vite.config.ts` do app.
3. Registrar a URL no `.env` da raiz: `VITE_SUBAPP_<NOME>_URL=...`.
4. Publicar o card na Central de Apps (`src/components/CentralAppsPage.tsx`).
5. Atualizar este arquivo com o novo mapeamento de portas.
