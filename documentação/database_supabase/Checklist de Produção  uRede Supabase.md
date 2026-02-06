## Banco de Dados
- [ ] Schema `urede` criado
- [ ] Todas as tabelas criadas sem erro
- [ ] Índices em `reg_ans`
- [ ] Constraints de integridade validadas

---

## RLS
- [ ] Funções auxiliares criadas (`current_coop_id`, `can_admin_manage_coop`, etc.)
- [ ] RLS habilitado em todas as tabelas
- [ ] Policies de escrita institucionais aplicadas
- [ ] Policies de leitura explícitas aplicadas
- [ ] RLS de pedidos testado com cenários reais

---

## Autenticação / JWT
- [ ] JWT inclui:
  - cooperativa_id
  - papel_usuario
- [ ] Backend injeta claims corretamente
- [ ] Teste com 6 perfis:
  - admin singular
  - operador singular
  - admin federação
  - operador federação
  - admin confederação
  - operador confederação

---

## Operação
- [ ] Importação ANS validada
- [ ] Cadastro de cidades conferido
- [ ] Prestadores visíveis corretamente
- [ ] Plantão exibido conforme modelo

---

## Segurança
- [ ] RLS impede acesso indevido
- [ ] Nenhum operador escreve dados institucionais
- [ ] Logs de auditoria ativos

---

## Go-live
- [ ] Backup inicial do banco
- [ ] Ambiente de produção separado
- [ ] Monitoramento habilitado