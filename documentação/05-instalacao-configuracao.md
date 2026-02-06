# 5. Guia de Instalação e Configuração

## 5.1 Objetivo
Permitir que equipes técnicas levantem ambientes (dev, homologação e produção) do uRede com previsibilidade, cobrindo dependências, bancos de dados, variáveis de ambiente, automação de jobs e validações iniciais.

## 5.2 Pré-requisitos
| Componente | Versão mínima | Uso |
| --- | --- | --- |
| Node.js | 18.x LTS | Build da SPA (Vite) e scripts auxiliares. |
| npm | 9.x | Gerência de dependências. |
| Deno | 2.x | Execução do backend Hono. |
| SQLite CLI | 3.39+ | Criação/importação local do banco `data/urede.db`. |
| bash + coreutils | — | Execução dos scripts `scripts/*.sh`. |
| Git | — | Versionamento e obtenção do código. |
| (Opcional) Postgres | 14+ | Banco gerenciado para produção. |

Validar versões:
```bash
node --version
npm --version
deno --version
sqlite3 --version
```

## 5.3 Clonagem e dependências
```bash
git clone <repo> urede && cd urede
npm install
```

## 5.4 Banco de dados Postgres (produção/homologação)
1. Provisionar instância gerenciada (por exemplo, RDS, Cloud SQL, Supabase) com suporte TLS e backups automáticos.
2. Aplicar o schema baseado em `db/sqlite_schema.sql` (ajustado para sintaxe Postgres). Todas as tabelas usam prefixo `urede_` e residem no schema `urede`.
3. Criar usuário de aplicação com permissões `SELECT/INSERT/UPDATE/DELETE` e acesso a `CREATE INDEX` para futuras migrações.
4. Popular dados iniciais de cooperativas/cidades/operadores usando scripts ETL ou importação em massa (psql/copy).
5. Configurar variáveis `DB_DRIVER=postgres`, `DB_SCHEMA=urede` e `DATABASE_DB_URL=postgresql://...` (com `sslmode=require` no Supabase).

## 5.5 Banco de dados SQLite (somente desenvolvimento offline)
1. Criar schema:
   ```bash
   bash scripts/create-sqlite-db.sh
   ```
2. Importar bases oficiais (`bases_csv/*.csv`):
   ```bash
   bash scripts/import-csv-sqlite.sh
   ```
   O script apaga dados anteriores e reimporta cooperativas, cidades e operadores (modo idempotente). Logs exibem contagens para conferência.
3. Confirmar arquivo criado: `data/urede.db`.

## 5.6 Variáveis de ambiente
Criar `.env` na raiz (compartilhado por frontend e backend). Exemplo completo:

```
# Frontend
VITE_API_BASE_URL=http://127.0.0.1:8300

# Backend
JWT_SECRET=troque-para-valor-seguro
DB_DRIVER=postgres
DATABASE_DB_URL=postgresql://user:pass@host:5432/postgres?sslmode=require
TABLE_PREFIX=urede_
DB_SCHEMA=urede
DATABASE_DB_POOL_SIZE=5
ALLOWED_ORIGINS=http://localhost:3400,http://127.0.0.1:3400
PORT=8300
PORT_FALLBACKS=8301,8302
APP_URL=http://localhost:3400
APP_BASE_URL=http://localhost:3400
EMAIL_CONFIRMATION_TIMEOUT_HOURS=24
APPROVAL_ESCALATION_TIMEOUT_HOURS=48
DEFAULT_CONFEDERACAO_ID=001
INSECURE_MODE=false
BREVO_API_KEY=...
BREVO_SENDER_EMAIL=notificacoes@dominio.com
BREVO_SENDER_NAME=uRede
BREVO_TEMPLATE_ID=0
BREVO_CONFIRMATION_TEMPLATE_ID=0
BREVO_APPROVAL_TEMPLATE_ID=0
PUBLIC_PEDIDOS=false
```

> Para ambientes locais baseados em SQLite, altere `DB_DRIVER=sqlite` e `SQLITE_PATH=./data/urede.db`. A variável `DATABASE_DB_URL` pode ser omitida nesse modo.

## 5.7 Execução do backend
```bash
npm run server:dev
```
- Carrega o `.env` automaticamente (via `deno run -A --env-file=.env ...`).
- Log inicial informa o driver utilizado (`sqlite` ou `postgres`) e a porta selecionada.
- Endpoints úteis: `GET /health`, `GET /cooperativas/public`.

### Logs
Redirecionar saída para arquivo conforme necessidade:
```bash
npm run server:dev > server.log 2>&1 &
```

## 5.8 Execução do frontend
```bash
npm run dev
```
- Servidor Vite em `http://localhost:3400`. Ajuste `VITE_API_BASE_URL` caso backend rode em outro host.
- Build de produção: `npm run build` (gera `build/`).
- Pré-build executa `scripts/write-health.mjs`, criando `public/health.json` e `public/version.txt` com metadados.

## 5.9 Teste de fumaça
1. Acessar `http://localhost:3400` e realizar cadastro/login.
2. Criar pedido de teste e verificar se aparece na lista.
3. Chamar `curl http://127.0.0.1:8300/health` e `curl http://127.0.0.1:8300/pedidos` (com token) para validar backend.
4. Executar `curl -X POST http://127.0.0.1:8300/ -H 'x-cron:true' -d '{"task":"escalar"}'` e confirmar logs de escalonamento.

## 5.10 Scheduler e jobs periódicos
- **Local (dev):** já existe `setInterval` a cada 1h dentro do backend.
- **Produção:** configurar job dedicado (Cloud Scheduler, CronJob Kubernetes, GitHub Actions) para `POST /` com header `x-cron: true`. Recomendado executar a cada 15 minutos para reduzir risco de atraso.
- Registrar monitoria: se o job retornar !=200, gerar alerta operacional.

## 5.11 Integração com Brevo (Sendinblue)
1. Criar API Key específica.
2. Configurar remetente (`BREVO_SENDER_EMAIL`/`BREVO_SENDER_NAME`) e templates opcionais:
   - `BREVO_TEMPLATE_ID`: fallback genérico.
   - `BREVO_CONFIRMATION_TEMPLATE_ID`: e-mail de confirmação de conta.
   - `BREVO_APPROVAL_TEMPLATE_ID`: notificação de aprovação/rejeição.
3. Validar domínio (SPF/DKIM) para evitar filtros de SPAM.
4. Caso não configure templates, o backend envia HTML simples padrão.

## 5.12 Troubleshooting
| Sintoma | Causa provável | Ação |
| --- | --- | --- |
| SPA mostra "Carregando..." indefinidamente | Backend inacessível ou token inválido. | Conferir `console` do navegador, `VITE_API_BASE_URL` e `localStorage.auth_token`. |
| Login retorna `pending_confirmation` | Usuário não confirmou e-mail. | Reenviar token via `/auth/register` ou limpar registro em `auth_users`. |
| Erro `Token inválido ou expirado` | `JWT_SECRET` diferente entre emissor e validador (ex.: múltiplas instâncias). | Sincronizar segredos e reiniciar serviços. |
| Importação falha com `Nenhum registro recebido` | Parser rejeitou arquivo vazio. | Confirmar cabeçalho e se o arquivo não está protegido. |
| CORS bloqueia requisição | `ALLOWED_ORIGINS` não inclui o host atual. | Atualizar variável e reiniciar backend. |
| Cron não roda | Endpoint `/` não foi chamado com header `x-cron:true` ou job sem internet. | Revisar scheduler e logs `"Erro no job escalonar"`. |
| Erro `DATABASE_DB_URL não definido` | Variável ausente em ambientes Postgres. | Definir URL completa e reiniciar servidor. |

## 5.13 Checklist final antes de entregar ambiente
- [ ] Variáveis secretas configuradas e armazenadas em cofre.
- [ ] Job de escalonamento validado.
- [ ] E-mails transacionais enviados com sucesso (teste manual).
- [ ] Backup/restore do Postgres documentado (snapshot + pg_dump).
- [ ] Usuários iniciais criados (confederação + admins por cooperativa).
- [ ] Documentação `documentação/*.md` entregue à equipe operacional.
