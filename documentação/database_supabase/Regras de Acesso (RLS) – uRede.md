## Princípios Gerais

- Leitura é ampla, respeitando visibilidade institucional
- Escrita é restrita por hierarquia
- Operadores não alteram dados institucionais
- Admins alteram apenas dentro do seu escopo

---

## Dados Institucionais

### SELECT
- Todas as cooperativas veem todas as informações

### INSERT / UPDATE / DELETE
- Apenas administradores
- Respeitando hierarquia:
  - Admin Singular → sua singular
  - Admin Federação → federação + singulares abaixo
  - Admin Confederação → tudo

---

## Usuários (auth_users)

- Admin cria/edita usuários no seu escopo
- Operador nunca cria usuários

---

## Pedidos (urede_pedidos)

### Visibilidade
Um pedido é visível para:
- Cooperativa solicitante
- Cooperativa responsável
- Federações das envolvidas
- Confederação

### Escrita
- INSERT: cooperativa solicitante
- UPDATE: cooperativa responsável atual
- DELETE: não permitido (soft delete)

---

## Regra-chave
> Pedido pertence a um subconjunto institucional, não ao sistema inteiro.