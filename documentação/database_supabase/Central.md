## Tabela Central
### urede_cooperativas
Entidade institucional principal.

Campos-chave:
- id_singular (PK)
- papel_rede (Singular | Federacao | Confederacao)
- federacao_id
- reg_ans

---

## Cidades
### urede_cidades
Representa a cobertura territorial.

- id_singular → singular responsável
- reg_ans → operadora atuante

Não armazena dados derivados (nome da operadora, CNPJ etc.).

---

## Prestadores

### prestadores_ans
Espelho fiel da base ANS (dados oficiais).

### prestadores
Cadastro enriquecido (Google Meu Negócio).

### prestador_vinculos_singulares
Relaciona prestadores às singulares:
- cooperado
- credenciado

---

## Plantão
- cooperativa_plantao
- plantao_telefones
- plantao_horarios

Modelo flexível para:
- próprios prestadores
- telefone do plantonista
- clínica própria

---

## Dados Institucionais
Todas vinculadas a `cooperativa_id`:
- contatos
- endereços
- diretores
- conselhos
- auditores
- ouvidores
- LGPD

---

## Pedidos
### urede_pedidos
Única tabela transacional do sistema.