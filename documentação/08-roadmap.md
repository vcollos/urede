# 8. Roadmap e Próximas Etapas

## 8.1 Critérios de priorização
- **Confiabilidade operacional:** garantir que escalonamentos, alertas e cadastros funcionem mesmo sob carga.
- **Compliance comercial:** preparar o produto para auditorias de clientes corporativos e due diligence.
- **Escalabilidade:** permitir multi-inquilino, métricas e integrações com sistemas legados da rede.

## 8.2 Curto prazo (0–3 meses)
| Item | Descrição | Métrica de sucesso |
| --- | --- | --- |
| Migração para Postgres gerenciado | Concluir `DB_DRIVER=postgres` em produção, com backup automático e HA. | 100% das consultas usando Postgres; tempo médio de resposta < 150 ms. |
| Política de senha e bloqueio | Implementar requisitos de complexidade e bloqueio temporário após tentativas malsucedidas. | Redução de incidentes de brute-force; auditoria aprovada. |
| Observabilidade básica | Exportar logs estruturados e métricas de erros para ferramenta central (Grafana/Datadog). | Painéis ativos + alertas configurados para `/health` e `/admin/escalar-pedidos`. |
| Testes automatizados | Criar suíte mínima (API + componentes críticos) e integrar ao CI. | Build falha quando APIs principais quebram. |
| Documentação comercial | Converter estes arquivos em site público (ex.: Docsify) e disponibilizar com controle de acesso. | Documento aprovado pelo time de vendas. |

## 8.3 Médio prazo (3–6 meses)
| Item | Descrição | Métrica de sucesso |
| --- | --- | --- |
| Integração com SSO (Azure AD/Google Workspace) | Oferecer autenticação corporativa opcional para grandes clientes. | ≥1 cliente rodando exclusivamente via SSO. |
| Motor de workflow configurável | Permitir regras específicas por cooperativa (ex.: passos extras antes do escalonamento). | Interface de configuração disponível para o time de implantação. |
| Painel analítico | Criar dashboards (Recharts) com filtros por período, especialidade, SLA e motivos de pedido. | Times de negócio utilizam para relatórios mensais (medir acessos). |
| Export/Import avançado | APIs REST para integração com ERPs e CRMs (JSON/CSV), incluindo webhook para alertas. | Integração piloto homologada com 1 parceiro externo. |
| Hardening de segurança | CSP, proteção contra CSRF e varredura OWASP automatizada. | Auditoria externa sem achados críticos. |

## 8.4 Longo prazo (6–12 meses)
| Item | Descrição | Métrica de sucesso |
| --- | --- | --- |
| Multi-tenant completo | Separar dados por cliente (schema ou prefixo) e permitir instâncias white-label. | ≥3 clientes distintos operando no mesmo cluster. |
| Módulo financeiro/contratual | Extender pedidos para incluir anexos, cláusulas e integrações com faturamento. | Tempo de processamento de contratos reduzido em 30%. |
| Automação avançada de SLA | Aprimorar algoritmo de escalonamento com machine learning ou regras heurísticas (calendário, feriados, capacidade). | Redução de 20% no número de pedidos vencidos. |
| Observabilidade 360º | Implementar tracing distribuído, métricas de uso por cooperativa e alertas inteligentes (AIOps). | SLO formalizado (ex.: 99,5%) e monitorado publicamente. |
| Programa de compliance contínuo | Certificação ISO 27001 / SOC 2, revisões trimestrais e testes de recuperação. | Conquista da certificação e renovação anual. |

## 8.5 Próximos passos operacionais
1. Aprovar orçamento para migração de banco e observabilidade.
2. Selecionar parceiro de SSO e revisar requisitos de LGPD.
3. Priorizar backlog no Jira/Linear alinhado a este roadmap e montar squad dedicado.
4. Revisitar este documento trimestralmente e atualizar conforme entregas.
