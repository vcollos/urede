# Documentação Técnica uRede

Esta pasta reúne a documentação oficial do produto de credenciamento e suprimento de rede da Uniodonto. Os materiais seguem o padrão de documentação da Microsoft: objetivos claros, estrutura numerada e referências cruzadas entre tópicos. **Ambientes de produção e homologação operam sobre banco de dados Postgres gerenciado** (SQLite permanece apenas como opção de laboratório e recebe menções específicas quando aplicável).

## Índice dos artefatos

| Arquivo | Conteúdo principal |
| --- | --- |
| [01-arquitetura.md](01-arquitetura.md) | Visão geral da arquitetura lógica, tecnologias, camadas de código e considerações de deployment. |
| [02-apis.md](02-apis.md) | Catálogo das APIs HTTP (Hono/Deno), contratos de payload, cabeçalhos e exemplos de requisição. |
| [03-fluxos-negocio.md](03-fluxos-negocio.md) | Fluxos de dados e processos de negócio (cadastro, ciclo do pedido, importação em lote e escalonamento). |
| [04-seguranca-conformidade.md](04-seguranca-conformidade.md) | Controles técnicos, requisitos de segurança, aderência a LGPD e recomendações de compliance. |
| [05-instalacao-configuracao.md](05-instalacao-configuracao.md) | Guia operacional para preparar ambientes, importar dados, executar backend/frontend e agendar jobs. |
| [06-manual-usuario.md](06-manual-usuario.md) | Manual funcional para operadores, federados e confederação realizarem atividades diárias. |
| [07-manual-administrador.md](07-manual-administrador.md) | Procedimentos de administração, governança de dados e operação de emergências. |
| [08-roadmap.md](08-roadmap.md) | Próximas etapas priorizadas (curto, médio e longo prazo) para evoluir o produto. |

> **Como navegar:** cada documento traz um sumário próprio e links de retorno para este índice. Use-os para montar apresentações comerciais, materiais de treinamento ou artefatos de due diligence em negociações.
