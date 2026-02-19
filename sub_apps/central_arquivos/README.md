# UDocs

Sub app standalone para a biblioteca digital institucional da Confederacao.

## Rodar localmente

```bash
npm i
npm run dev
```

Servidor local padrao: `http://localhost:3503`

## Objetivo deste sub app

- Listar documentos sincronizados do Google Drive via API do UHub.
- Permitir visualizacao (preview) e download em modo somente leitura.
- Preparar o modulo para integracao no shell principal em `/udocs/dashboard` (legado `/hub/apps/central-arquivos`).

## Contrato de API esperado

- `GET /auth/me`
- `GET /udocs/assets?q=&categoria=&ano=&page=&page_size=`
- `POST /udocs/assets/sync` (somente admin)
- `GET /udocs/assets/:id/preview`
- `GET /udocs/assets/:id/download`

Retrocompatibilidade:
- Endpoints legados `/marketing*` e `/arquivos*` continuam funcionando.

Se os endpoints ainda nao estiverem disponiveis, o app entra automaticamente em modo fallback local (mock).
