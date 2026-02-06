# 6. Manual do Usuário Final

## 6.1 Perfil contemplado
Destinado a operadores das cooperativas singulares, equipes das federações e times da confederação que utilizam o portal para registrar, acompanhar e responder pedidos de credenciamento/suprimento.

## 6.2 Acesso inicial
1. Abra `https://<seu-dominio>` e clique em **"Não tem uma conta?"** para abrir o formulário de cadastro.
2. Preencha seus dados (nome completo, nome de exibição, contatos) e selecione a cooperativa correspondente. Para perfis federados/confederação, escolha a entidade mãe.
3. Crie uma senha segura (mínimo 8 caracteres recomendado).
4. Verifique sua caixa de e-mail: clique no link de confirmação (válido por 24h).
5. Aguarde a aprovação do administrador da cooperativa (se aplicável). O status é exibido ao tentar fazer login:
   - `pending_confirmation`: confirme o e-mail.
   - `pending_approval`: aguarde o responsável da cooperativa.
   - `pending_manual`: o suporte da confederação irá analisar manualmente.
   - `rejected`: entre em contato com o suporte para entender os motivos.
6. Após aprovado, basta acessar a tela de login com e-mail/senha.

## 6.3 Navegação principal (Layout)
- **Menu lateral:**
  - *Dashboard* – visão geral dos indicadores e pedidos em destaque.
  - *Pedidos* – lista completa com filtros e busca.
  - *Importação* – assistente para importar planilhas.
  - *Cooperativas / Operadores / Cidades / Prestadores / Configurações* – visível conforme permissões.
- **Ações rápidas:** botão **+ Pedido** abre o modal de criação. O ícone de nuvem importa planilhas.
- **Alertas:** sino exibe notificações recentes. Clicar em uma notificação abre o pedido relacionado. Use **"Marcar todos"** para limpar.
- **Perfil:** clique no avatar (canto superior direito) para alterar dados pessoais ou sair do sistema.

## 6.4 Dashboard
- Quatro cartões fornecem números agregados (Total, Vencendo em 7 dias, Em Andamento, Concluídos). Clique em qualquer cartão para aplicar o filtro correspondente na lista de pedidos.
- A seção “Pedidos recentes” destaca itens com prazos críticos. Ícones indicam severidade (vermelho = até 3 dias, amarelo = até 7 dias).

## 6.5 Gestão de pedidos
### Criar
1. Clique em **"Novo pedido"**.
2. Preencha `Título`, `Cidade`, `Especialidades`, `Quantidade`, `Observações` e, opcionalmente, `Prioridade` e `Motivo`.
3. Salve; o pedido entra como `status=novo`, nível `singular` e prazo calculado automaticamente.

### Visualizar e atualizar
1. Na aba **Pedidos**, selecione um item para abrir o painel de detalhes.
2. Campos principais:
   - Cabeçalho com status, nível atual e prazo restante.
   - Aba **"Detalhes"** mostra dados operacionais e permite alterar `Status`, assumir responsabilidade ou cancelar (respeitando permissões).
   - Aba **"Comentários"** usa markdown (aceita listas, títulos, etc.). Cada atualização é registrada com data/hora.
   - Aba **"Auditoria"** lista eventos com autor e descrição.
3. Para mudar o status:
   - Escolha o novo valor em **Status**.
   - Insira um comentário descrevendo a ação.
   - Clique em **Atualizar**. O sistema emite alertas a todas as partes interessadas.

### Importar em lote
1. Acesse a aba **Importação** ou clique no botão de upload.
2. Etapa *Upload*: selecione arquivo `.xlsx` ou `.csv` baseado no template oficial (`/public/templates/pedidos_lote.csv`).
3. Etapa *Mapeamento*: confirme quais colunas do arquivo correspondem aos campos exigidos.
4. Etapa *Revisão*: corrija linhas com problemas (IBGE inválido, campos vazios, etc.).
5. Etapa *Resultado*: acompanhe o resumo e exporte os erros se necessário.

### Transferir manualmente / recusar
- Use o menu de ações do pedido para transferir ao próximo nível, informando um motivo. Isto gera auditoria e notifica a cooperativa destino.

## 6.6 Alertas e notificações
- O sino na barra superior indica quantidade de alertas não lidos.
- Notificações web (quando permitidas no navegador) aparecem com título e resumo; ao clicar, você é redirecionado para o pedido.
- Para marcar como lido, abra a gaveta de alertas e selecione o item (o backend também registra auditoria de leitura).

## 6.7 Documentação integrada
- O link `/documentacao/usuarios` abre o centro de ajuda embutido (`DocumentacaoUsuariosApp`).
- Use o menu lateral para navegar por tópicos como “Operação diária”, “Auditoria e conformidade”.

## 6.8 Atalhos operacionais
| Ação | Como fazer |
| --- | --- |
| Atualizar status rapidamente | Use o seletor no topo do painel do pedido e confirme com um comentário. |
| Encontrar pedidos críticos | No dashboard, clique em “Vencendo em 7 dias” ou aplique filtros rápidos na lista. |
| Exportar histórico | Copie/cole a aba Auditoria ou solicite ao administrador uma exportação oficial (rota `/pedidos/:id/auditoria`). |
| Atualizar dados pessoais | Avatar → **Perfil** → editar Nome, Display Name, telefone e whatsapp. |

## 6.9 Boas práticas
- Descreva claramente os motivos de recusa ou transferência para acelerar análises posteriores.
- Utilize o campo `Prioridade` para facilitar o trabalho das federações/confederação.
- Tenha atenção aos prazos exibidos em dias restantes; pedidos vencidos são automaticamente escalonados.
- Habilite notificações do navegador e mantenha o e-mail atualizado para receber alertas sem atraso.

## 6.10 Consulta a prestadores e dados institucionais
- **Prestadores:** a aba *Prestadores* permite pesquisar bases publicas (ANS e cadastro enriquecido) por nome, cidade e `reg_ans`.
- **Institucional:** dentro de *Cooperativas*, a aba *Institucional* exibe contatos, enderecos, diretoria, conselhos, LGPD e plantao. Operadores visualizam dados; edicao depende de permissao administrativa.
