# 7. Manual do Administrador / Operações

## 7.1 Escopo
Guia destinado a administradores das cooperativas, gestores das federações e equipe central da confederação responsáveis por governança de acesso, parametrizações e continuidade operacional do uRede.

## 7.2 Gestão de contas e aprovações
1. Acesse **Configurações → Aprovações pendentes** (ou utilize o acesso direto `/auth/pending` via API).
2. Analise cada registro:
   - Dados apresentados: nome, e-mail, cooperativa solicitante, papel solicitado (admin/operador), data do pedido.
   - Clique em **Aprovar** ou **Recusar**; informe observações claras.
3. Ao aprovar:
   - O papel final fica igual ao solicitado (`requested_papel`, apenas `admin` ou `operador`).
   - O usuário é sincronizado com a tabela `urede_operadores` (se ainda não existir) e recebe e-mail automático.
4. Ao recusar:
   - `approval_status` muda para `rejected` e o usuário é notificado com as observações inseridas.
5. Recomenda-se revisar solicitações diariamente para evitar bloqueios operacionais.

## 7.3 Configurações globais
Local: **Menu Configurações → Preferências do sistema** (`ConfiguracoesView.tsx`).
- **Prazos (Singular → Federação / Federação → Confederação):** ajuste os valores (dias) conforme SLA firmado. Ao salvar, futuros pedidos usarão os novos limites.
- **Require approval:** obriga novos cadastros a passarem por aprovação (recomendado em produção).
- **Auto notify managers:** determina se alertas são enviados automaticamente para admins responsáveis.
- **Enable self registration:** se desativado, somente admins podem criar usuários via API.
- **Motivos padrão do pedido:** mantenha lista curada para relatórios analíticos. Use badges para adicionar/remover motivos.

## 7.4 Configurações por cooperativa
1. Abra **Cooperativas** e selecione a entidade desejada.
2. Em **Preferências locais**, defina `Auto recusar pedidos`:
   - *Desligado:* a cooperativa recebe pedidos normalmente.
   - *Ligado:* todo pedido encaminhado para essa cooperativa é imediatamente transferido ao próximo nível (útil quando uma singular está sem capacidade).
3. Ao ativar, o backend executa `autoEscalatePedidosForCooperativa`, transferindo inclusive itens já em andamento.
4. **Cobertura de cidades:** use o editor de cobertura para adicionar/remover `cidade_ids`. Cada alteracao gera log em `urede_cobertura_logs`.
5. **Dados institucionais:** na aba *Institucional*, mantenha contatos, enderecos, diretoria, conselhos, LGPD e plantao. Escrita segue escopo hierarquico (admin confederacao/federacao/singular).
5. **Histórico:** consulte o painel de logs para auditorias (quem alterou, quando, origem/destino).

## 7.5 Operadores e permissões
- Cadastre operadores via modulo **Operadores** ou chamando `POST /operadores`.
- Campos obrigatórios: nome, e-mail, cooperativa, papel.
- Para desativar acesso sem remover histórico, atualize o campo `ativo` do operador ou defina `approval_status='rejected'` no `auth_users`.

## 7.6 Supervisão do pipeline de pedidos
1. **Dashboard administrativo:** use filtros `status` e `nivel` para identificar gargalos.
2. **Escalonamento manual:** caso o cron falhe, execute `POST /admin/escalar-pedidos` (disponível para administradores) ou via terminal:
   ```bash
   curl -X POST https://api.seudominio/admin/escalar-pedidos \
     -H 'Authorization: Bearer <token>'
   ```
3. **Importações:** acompanhe resultados no wizard e valide `PedidoImportResponse` para garantir que todas as linhas foram importadas.
4. **Alertas:** revise a gaveta de notificações e incentive usuários a mantê-la limpa (marcando como lido) para evitar duplicidades.

## 7.7 Operação contínua
| Atividade | Frequência | Responsável | Detalhes |
| --- | --- | --- | --- |
| Verificar jobs de escalonamento | Diário | SRE / Admin confederação | Consultar logs (`server.log`) e endpoint `/health`. Automatizar alerta se resposta não for 200. |
| Revisar pedidos vencendo | Diário | Federação/confederação | Filtrar pedidos `dias_restantes <= 7` e cobrar responsáveis. |
| Revisar cobertura | Mensal ou sob demanda | Federação | Utilizar histórico para confirmar se cidades estão corretas após alterações regulatórias. |
| Backup do banco | Diário (produção) | DBA | SQLite: snapshot do arquivo; Postgres: `pg_dump`. Garantir armazenamento seguro e testes de restore. |
| Revisar contas inativas | Mensal | Admin cooperativas | Inativar usuários que não acessam há >90 dias para reduzir superfícies de ataque. |

## 7.8 Emergências e contingência
1. **Cron não executou:** acione manualmente `POST /` com `x-cron:true`. Caso persistam falhas, verifique conectividade ou reinicie o processo Deno.
2. **Falha geral do backend:**
   - Reiniciar processo `npm run server:dev` ou serviço containerizado.
   - Validar se a porta não está em uso; ajuste `PORT`/`PORT_FALLBACKS`.
3. **Comprometimento de credenciais:**
   - Regenerar `JWT_SECRET` e reiniciar backend (forçará logout global).
   - Atualizar senhas diretamente em `auth_users` (preferir fluxo de mudança de senha via `/auth/change-password`).
4. **Corrupção do banco:**
   - Restaurar backup do `data/urede.db` mais recente.
   - Rodar `sqlite3 data/urede.db "PRAGMA integrity_check;"` para validar.
5. **Problemas com e-mail:**
   - Checar limites de envio Brevo e se as chaves estão válidas.
   - Consultar logs de `sendBrevoTransactionalEmail` (warnings surgem no console).

## 7.9 Checklist de handover para novas cooperativas
- [ ] Cooperativa cadastrada em `urede_cooperativas` com `TIPO` e `FEDERACAO` corretos.
- [ ] Administrador local criado e aprovado.
- [ ] Operadores treinados, com acesso ao guia `/documentacao/usuarios`.
- [ ] Cidades atribuídas via módulo de cobertura.
- [ ] Configurações de auto recusa alinhadas ao contrato.
- [ ] Plano de comunicação para incidentes acordado (pontos focais e SLAs).
