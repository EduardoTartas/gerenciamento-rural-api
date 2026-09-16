# Plano de Teste para Endpoints de Catálogo

Rota genérica `/catalogos/:entidade` para os catálogos globais (`racas`, `sistemas-producao`,
`regimes-alimentares`, `tipos-manejo-rebanho`, `tipos-manejo-pasto`, `tipos-insumo`) — leitura
liberada a qualquer autenticado, escrita restrita a admin. Fonte técnica:
`documentacao/testes/catalogos/catalogos.md`. Suíte automatizada: `test/endpoints/catalogos/`.

## GET /v1/catalogos/:entidade

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/catalogos/:entidade | [CAT-GET-01] lista itens ativos de `racas` | ao menos 1 raça ativa cadastrada | HTTP 200, envelope; `data.docs` array; cada item com `id`, `nome`, `ativo`, `createdAt`, `updatedAt`; `message` = "N item(ns) encontrado(s)." |
| GET /v1/catalogos/:entidade | [CAT-GET-02] lista vazia quando não há itens | entidade sem itens (ou filtro que não bate) | HTTP 200, `data.totalDocs === 0`; `message` = "Nenhum item encontrado neste catálogo." |
| GET /v1/catalogos/:entidade | [CAT-GET-03] filtra por `nome` (contém, case-insensitive) | item "Nelore" cadastrado | HTTP 200, `data.docs` só contém itens cujo nome contém o filtro, ignorando maiúsc./minúsc. |
| GET /v1/catalogos/:entidade | [CAT-GET-04] filtra por `ativo=false` | 1 item ativo e 1 inativo | HTTP 200, `data.docs` só traz os inativos |
| GET /v1/catalogos/:entidade | [CAT-GET-05] pagina com `page`/`limit` | ≥ 11 itens cadastrados | HTTP 200, `data.limit`, `data.page`, `data.totalPages` coerentes; `docs.length <= limit` |
| GET /v1/catalogos/:entidade | [CAT-GET-06] `limit` acima de 100 é rejeitado pelo schema | query `limit=101` | HTTP 400, `errors` cita `limit`; `CatalogoQuerySchema.max(100)` recusa antes do service capar |
| GET /v1/catalogos/:entidade | [CAT-GET-07] `ativo` com valor fora de `true`/`false` | `?ativo=talvez` | HTTP 400, `tipo` `validationError`; mensagem padrão do Zod (não a mensagem customizada — ver Bugs conhecidos) **(bug conhecido — ver Divergências)** |
| GET /v1/catalogos/:entidade | [CAT-GET-08] campo de query não reconhecido (`.strict()`) | `?foo=bar` | HTTP 400, `tipo` `validationError`; `errors[0].message` cita `foo` (issue `unrecognized_keys` do Zod v4 vem com `path: []`, não `path: ['foo']`) |
| GET /v1/catalogos/:entidade | [CAT-GET-09] `:entidade` inexistente | `/catalogos/nao-existe` | HTTP 404, `tipo` `resourceNotFound`; mensagem lista as entidades disponíveis |
| GET /v1/catalogos/:entidade | [CAT-GET-10] 401 sem token | sem header `Authorization` | HTTP 401, `tipo` `unauthorized`; `recuperavel === true` |
| GET /v1/catalogos/:entidade | [CAT-GET-11] leitura não exige admin | usuário comum A autenticado (não admin) | HTTP 200, lista normalmente, sem 403 |
| GET /v1/catalogos/:entidade | [CAT-TENANCY-01] item criado por admin é visível para A e para B | admin cria item | HTTP 200, `GET /catalogos/:entidade` autenticado como A e como B retorna o mesmo item — catálogos não têm dono (`CatalogoRepository` não filtra por `usuarioId`/`propriedadeId`), cenário de confirmação, não de isolamento |

## GET /v1/catalogos/:entidade/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/catalogos/:entidade/:id | [CAT-GET-ID-01] busca item existente por ID | item ativo cadastrado | HTTP 200, envelope; `data.id`, `data.nome`; `message` = "<nome> encontrado(a) com sucesso." |
| GET /v1/catalogos/:entidade/:id | [CAT-GET-ID-02] item inativo também é encontrado por ID | item com `ativo: false` | HTTP 200, `data.ativo === false` — `findById` não filtra por `ativo` (só a listagem filtra) |
| GET /v1/catalogos/:entidade/:id | [CAT-GET-ID-03] ID em formato inválido (não UUID) | `/catalogos/racas/abc` | HTTP 400, `tipo` `validationError` |
| GET /v1/catalogos/:entidade/:id | [CAT-GET-ID-04] UUID válido mas inexistente | UUID aleatório | HTTP 404, `tipo` `resourceNotFound`; mensagem cita o label da entidade (ex.: "Raça") |
| GET /v1/catalogos/:entidade/:id | [CAT-GET-ID-05] `:entidade` inexistente com `:id` válido | `/catalogos/nao-existe/<uuid>` | HTTP 404, recusado na resolução da entidade, antes de consultar o item |
| GET /v1/catalogos/:entidade/:id | [CAT-GET-ID-06] 401 sem token | sem header `Authorization` | HTTP 401, `tipo` `unauthorized` |
| GET /v1/catalogos/:entidade/:id | [CAT-GET-ID-07] leitura por ID não exige admin | usuário comum A | HTTP 200, acessa normalmente |

## POST /v1/catalogos/:entidade

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/catalogos/:entidade | [CAT-POST-01] admin cria item com `nome` válido | usuário admin | HTTP 201, envelope; `data.id`, `data.nome`, `data.ativo === true`; `message` = "Item de catálogo criado com sucesso." |
| POST /v1/catalogos/:entidade | [CAT-POST-02] corpo vazio | admin; `{}` | HTTP 400, `message` = "Forneça os dados do item de catálogo."; `tipo` `validationError`; `errors[0].path` = `body` |
| POST /v1/catalogos/:entidade | [CAT-POST-03] `nome` ausente | admin; body sem `nome` | HTTP 400, erro de validação Zod aponta `nome` |
| POST /v1/catalogos/:entidade | [CAT-POST-04] `nome` com menos de 2 caracteres | admin; `{ nome: "A" }` | HTTP 400, mensagem "O nome deve ter pelo menos 2 caracteres." |
| POST /v1/catalogos/:entidade | [CAT-POST-05] `nome` com mais de 100 caracteres | admin; nome com 101 chars | HTTP 400, mensagem "O nome deve ter no máximo 100 caracteres." |
| POST /v1/catalogos/:entidade | [CAT-POST-06] campo extra no corpo (`.strict()`) | admin; `{ nome: "X", extra: 1 }` | HTTP 400, `tipo` `validationError`; cita `extra` |
| POST /v1/catalogos/:entidade | [CAT-POST-07] nome duplicado (case-insensitive) | admin; já existe item "Nelore" ativo; envia "nelore" | HTTP 409, `tipo` `conflict`; mensagem "Já existe um(a) <label> com este nome." |
| POST /v1/catalogos/:entidade | [CAT-POST-08] nome igual a item inativo é recusado por índice único incondicional do banco | admin; item "Nelore" com `ativo: false` | HTTP 409, `tipo` `uniqueConstraintViolation`; mensagem "Já existe um registro com os dados informados." **(bug conhecido — ver Divergências)** |
| POST /v1/catalogos/:entidade | [CAT-POST-09] `:entidade` inexistente | admin; `/catalogos/nao-existe` | HTTP 404, `tipo` `resourceNotFound` |
| POST /v1/catalogos/:entidade | [CAT-POST-10] 401 sem token | sem header `Authorization` | HTTP 401, `tipo` `unauthorized` |
| POST /v1/catalogos/:entidade | [CAT-POST-11] 403 usuário comum (não admin) | usuário A autenticado, não admin | HTTP 403, `tipo` `forbidden`; mensagem "Esta ação exige perfil administrativo."; corpo nem chega a ser validado |

## PATCH /v1/catalogos/:entidade/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| PATCH /v1/catalogos/:entidade/:id | [CAT-PATCH-01] admin atualiza `nome` | admin; item existente | HTTP 200, `data.nome` atualizado; mensagem "Item de catálogo atualizado com sucesso." |
| PATCH /v1/catalogos/:entidade/:id | [CAT-PATCH-02] admin reativa item (`ativo: true`) | admin; item com `ativo: false` | HTTP 200, `data.ativo === true` |
| PATCH /v1/catalogos/:entidade/:id | [CAT-PATCH-03] admin arquiva via `ativo: false` | admin; item ativo | HTTP 200, `data.ativo === false` |
| PATCH /v1/catalogos/:entidade/:id | [CAT-PATCH-04] corpo vazio | admin; `{}` | HTTP 400, mensagem "Forneça pelo menos um campo para atualizar." |
| PATCH /v1/catalogos/:entidade/:id | [CAT-PATCH-05] campo extra (`.strict()`) | admin; `{ nome: "X", extra: 1 }` | HTTP 400, `tipo` `validationError` |
| PATCH /v1/catalogos/:entidade/:id | [CAT-PATCH-06] `nome` duplicado ao renomear | admin; existe outro item ativo com o novo nome | HTTP 409, `tipo` `conflict` |
| PATCH /v1/catalogos/:entidade/:id | [CAT-PATCH-07] renomear para o próprio nome atual | admin; item existente | HTTP 200, `validateUniqueNome` exclui o próprio `id` (`excludeId`) — não recusa |
| PATCH /v1/catalogos/:entidade/:id | [CAT-PATCH-08] ID em formato inválido | admin; `/catalogos/racas/abc` | HTTP 400, `tipo` `validationError` |
| PATCH /v1/catalogos/:entidade/:id | [CAT-PATCH-09] UUID válido mas inexistente | admin; UUID aleatório | HTTP 404, `tipo` `resourceNotFound` |
| PATCH /v1/catalogos/:entidade/:id | [CAT-PATCH-10] `:entidade` inexistente | admin | HTTP 404, `tipo` `resourceNotFound` |
| PATCH /v1/catalogos/:entidade/:id | [CAT-PATCH-11] 401 sem token | sem header `Authorization` | HTTP 401, `tipo` `unauthorized` |
| PATCH /v1/catalogos/:entidade/:id | [CAT-PATCH-12] 403 usuário comum (não admin) | usuário A, não admin | HTTP 403, `tipo` `forbidden` |

## DELETE /v1/catalogos/:entidade/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| DELETE /v1/catalogos/:entidade/:id | [CAT-DELETE-01] admin arquiva item sem dependentes | admin; item de catálogo sem uso | HTTP 200, `data.ativo === false`; no banco, linha continua existindo com `ativo: false` (soft-delete); mensagem "Item de catálogo removido com sucesso." |
| DELETE /v1/catalogos/:entidade/:id | [CAT-DELETE-02] trava de dependência | admin; item vinculado (ex.: raça usada por um rebanho) | HTTP 409, `tipo` `conflict`; mensagem cita quantidade de registros dependentes; no banco, item continua `ativo: true` |
| DELETE /v1/catalogos/:entidade/:id | [CAT-DELETE-03] ID em formato inválido | admin; `/catalogos/racas/abc` | HTTP 400, `tipo` `validationError` |
| DELETE /v1/catalogos/:entidade/:id | [CAT-DELETE-04] UUID válido mas inexistente | admin; UUID aleatório | HTTP 404, `tipo` `resourceNotFound` |
| DELETE /v1/catalogos/:entidade/:id | [CAT-DELETE-05] `:entidade` inexistente | admin | HTTP 404, `tipo` `resourceNotFound` |
| DELETE /v1/catalogos/:entidade/:id | [CAT-DELETE-06] 401 sem token | sem header `Authorization` | HTTP 401, `tipo` `unauthorized` |
| DELETE /v1/catalogos/:entidade/:id | [CAT-DELETE-07] 403 usuário comum (não admin) | usuário A, não admin | HTTP 403, `tipo` `forbidden` |

## Bugs conhecidos

- `CatalogoRepository.findById` não filtra por `ativo` — `GET /catalogos/:entidade/:id` devolve itens arquivados normalmente, enquanto a listagem os esconde por padrão; comportamento não explicitamente documentado mas coerente com o resto da API (não tratado como bug).
- `CatalogoQuerySchema.ativo` usa `errorMap` (sintaxe de customização de mensagem do Zod v3); no Zod v4 usado no projeto a opção correta é `error` — `errorMap` é silenciosamente ignorado e a mensagem que chega ao cliente é o texto padrão do Zod, nunca a mensagem customizada "O filtro 'ativo' deve ser 'true' ou 'false'". CAT-GET-07 documenta o comportamento real via `it.fails`.
- Nos schemas `.strict()` (query/create/update de catálogo), a issue `unrecognized_keys` do Zod v4 chega com `path: []` — o nome do campo extra aparece só em `errors[0].message`, nunca em `errors[0].path`. CAT-GET-08, CAT-POST-06 e CAT-PATCH-05 foram ajustados para checar a mensagem em vez do `path`.
- Todos os models de catálogo declaram `nome String @unique`, índice único incondicional no banco (diferente do índice parcial `WHERE ativo = true` de `propriedades`). `validateUniqueNome`/`findByNome` só barram duplicidade entre itens ativos, mas a criação com nome de item arquivado nunca chega a rodar essa regra: o Postgres recusa primeiro via `P2002`, e o cliente recebe 409 `uniqueConstraintViolation` em vez de 201. CAT-POST-08 documenta o comportamento real via `it.fails`.
