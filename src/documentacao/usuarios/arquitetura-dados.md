# Arquitetura de Dados

Esta visão fornece um panorama de como as informações são armazenadas e interagem dentro do portal uRede. O objetivo é apoiar equipes de gestão e auditoria na interpretação dos dados exportados ou integrados com outros sistemas corporativos.

## Entidades Principais

- **Pedidos**  
  - Identificador único (`id`) e status de andamento.  
  - Referência ao cooperado, cooperativa e cidade atendida.  
  - Histórico de etapas, responsáveis e timestamps automáticos.  
  - Relação com anexos, comentários e alertas.
- **Cooperativas**  
  - Dados cadastrais, contatos e tipo (Confederação, Federação, Singular).  
  - Controle de permissões e fluxos específicos de aprovação.  
  - Configurações de SLA e notificações.
- **Operadores**  
  - Perfil de acesso, status de aprovação, associação à cooperativa.  
  - Registro de ações executadas (cadastro, edição, aprovação).
- **Alertas**  
  - Gerados automaticamente por regras configuradas (prazos, pendências, escalonamentos).  
  - Armazenam tipo, mensagem, vínculo com pedido e leitura pelo usuário.

## Fluxo de Dados

1. O operador registra um pedido e envia documentos complementares.
2. O pedido percorre etapas de validação, atualizando status e registrando comentários.
3. Gestores e diretoria recebem alertas conforme regras e prazos.
4. Relatórios consolidados podem ser exportados em CSV para integração com BI ou ERP.

## Integrações

- **Importação em lote**: arquivos CSV validados pelo portal; erros são devolvidos em planilha detalhada.  
- **Downloads programáticos**: relatórios e anexos podem ser integrados a ferramentas internas respeitando perfis de acesso.  
- **APIs internas** (quando habilitadas): permitem sincronizar cadastros e status de pedidos com sistemas da cooperativa.

## Retenção e Segurança

- Dados críticos ficam armazenados em infraestrutura homologada pela Uniodonto, com backup automático e criptografia em repouso.  
- Logs sensíveis seguem políticas de retenção definidas pela diretoria de TI.  
- Permissões são revisadas periodicamente; operadores inativos são suspensos automaticamente após período de inatividade.

> Para análises técnicas detalhadas (estrutura completa de tabelas, APIs e modelos de dados), consulte a documentação voltada a desenvolvedores — disponível futuramente em `src/documentacao/tecnica`.
