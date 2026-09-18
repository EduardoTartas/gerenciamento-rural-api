# /catalogos/:entidade

Controller `CatalogoController` · Service `CatalogoService` · Repository `CatalogoRepository` ·
Schemas `CatalogoCreateSchema`, `CatalogoUpdateSchema`, `CatalogoQuerySchema`, `CatalogoIdSchema` ·
Regras: `rotas_pastolivre.md` § 8

Entidades aceitas em `:entidade` (chave da URL, ver `CATALOGO_ENTITIES` em
`src/repository/CatalogoRepository.js`): `racas`, `sistemas-producao`, `regimes-alimentares`,
`tipos-manejo-rebanho`, `tipos-manejo-pasto`, `tipos-insumo`.

Catálogos são **globais** — não têm `propriedadeId`/`usuarioId`. Leitura liberada a qualquer
autenticado; escrita (`POST`/`PATCH`/`DELETE`) exige `admin: true` via `AdminMiddleware`. Não há
escopo de tenant: a categoria "multi-tenancy" não se aplica a esta rota (ver seção
"Ausência de multi-tenancy" abaixo).

Pré-condições comuns: usuário A e usuário B autenticados via BetterAuth; usuário admin autenticado
(marcado `admin: true` via Prisma, já que o campo tem `input: false` no BetterAuth). Cada teste que
depender de um item de catálogo pré-existente deve criá-lo via admin antes do cenário, ou usar um
item de seed (`npm run prisma:seed`).

## GET /catalogos/:entidade

Arquivo: `test/endpoints/catalogos/get-catalogos-entidade.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| CAT-GET-01 | lista itens ativos de `racas` | ao menos 1 raça ativa cadastrada | 200 | envelope; `data.docs` array; cada item com `id`, `nome`, `ativo`, `createdAt`, `updatedAt`; mensagem `"N item(ns) encontrado(s)."` |
| CAT-GET-02 | lista vazia quando não há itens | entidade sem itens (ou filtro que não bate) | 200 | `data.totalDocs === 0`; mensagem `"Nenhum item encontrado neste catálogo."` |
| CAT-GET-03 | filtra por `nome` (contém, case-insensitive) | item "Nelore" cadastrado | 200 | `data.docs` só contém itens cujo nome contém o filtro, ignorando maiúsc./minúsc. |
| CAT-GET-04 | filtra por `ativo=false` | 1 item ativo e 1 inativo | 200 | `data.docs` só traz os inativos |
| CAT-GET-05 | pagina com `page`/`limit` | ≥ 11 itens cadastrados | 200 | `data.limit`, `data.page`, `data.totalPages` coerentes; `docs.length <= limit` |
| CAT-GET-06 | `limit` acima de 100 é rejeitado pelo schema | — | 400 | `errors` cita `limit`; `CatalogoQuerySchema.max(100)` recusa antes do service capar |
| CAT-GET-07 | `ativo` com valor fora de `true`/`false` | `?ativo=talvez` | 400 | `tipo` `validationError`; mensagem "O filtro 'ativo' deve ser 'true' ou 'false'" |
| CAT-GET-08 | campo de query não reconhecido (`.strict()`) | `?foo=bar` | 400 | `tipo` `validationError`; `errors[0].message` cita `foo` (issue `unrecognized_keys` do Zod v4 vem com `path: []`, não `path: ['foo']`) |
| CAT-GET-09 | `:entidade` inexistente | `/catalogos/nao-existe` | 404 | `tipo` `resourceNotFound`; mensagem lista as entidades disponíveis |
| CAT-GET-10 | 401 sem token | sem header `Authorization` | 401 | `tipo` `unauthorized`; `recuperavel === true` |
| CAT-GET-11 | leitura não exige admin | usuário comum A autenticado (não admin) | 200 | lista normalmente, sem 403 |

## GET /catalogos/:entidade/:id

Arquivo: `test/endpoints/catalogos/get-catalogos-entidade-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| CAT-GET-ID-01 | busca item existente por ID | item ativo cadastrado | 200 | envelope; `data.id`, `data.nome`; mensagem `"<nome> encontrado(a) com sucesso."` |
| CAT-GET-ID-02 | item inativo também é encontrado por ID | item com `ativo: false` | 200 | `data.ativo === false` — `findById` não filtra por `ativo` (só a listagem filtra) |
| CAT-GET-ID-03 | ID em formato inválido (não UUID) | `/catalogos/racas/abc` | 400 | `CatalogoIdSchema` recusa via Zod; `tipo` `validationError` |
| CAT-GET-ID-04 | UUID válido mas inexistente | UUID aleatório | 404 | `tipo` `resourceNotFound`; mensagem cita o label da entidade (ex.: "Raça") |
| CAT-GET-ID-05 | `:entidade` inexistente com `:id` válido | `/catalogos/nao-existe/<uuid>` | 404 | recusado na resolução da entidade, antes de consultar o item |
| CAT-GET-ID-06 | 401 sem token | sem header `Authorization` | 401 | `tipo` `unauthorized` |
| CAT-GET-ID-07 | leitura por ID não exige admin | usuário comum A | 200 | acessa normalmente |

## POST /catalogos/:entidade

Arquivo: `test/endpoints/catalogos/post-catalogos-entidade.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| CAT-POST-01 | admin cria item com `nome` válido | usuário admin | 201 | envelope; `data.id`, `data.nome`, `data.ativo === true`; mensagem "Item de catálogo criado com sucesso." |
| CAT-POST-02 | corpo vazio | admin; `{}` | 400 | mensagem "Forneça os dados do item de catálogo."; `tipo` `validationError`; `errors[0].path` = `body` |
| CAT-POST-03 | `nome` ausente | admin; body sem `nome` | 400 | erro de validação Zod aponta `nome` |
| CAT-POST-04 | `nome` com menos de 2 caracteres | admin; `{ nome: "A" }` | 400 | mensagem "O nome deve ter pelo menos 2 caracteres." |
| CAT-POST-05 | `nome` com mais de 100 caracteres | admin; nome com 101 chars | 400 | mensagem "O nome deve ter no máximo 100 caracteres." |
| CAT-POST-06 | campo extra no corpo (`.strict()`) | admin; `{ nome: "X", extra: 1 }` | 400 | `tipo` `validationError`; cita `extra` |
| CAT-POST-07 | nome duplicado (case-insensitive) | admin; já existe item "Nelore" ativo; envia "nelore" | 409 | `tipo` `conflict`; mensagem "Já existe um(a) <label> com este nome." |
| CAT-POST-08 | nome igual a item inativo é aceito | admin; item "Nelore" com `ativo: false` | 201 | índice único parcial (`WHERE ativo = true`) permite reciclar o nome de um item arquivado, igual a `propriedades` |
| CAT-POST-09 | `:entidade` inexistente | admin; `/catalogos/nao-existe` | 404 | `tipo` `resourceNotFound` |
| CAT-POST-10 | 401 sem token | sem header `Authorization` | 401 | `tipo` `unauthorized` |
| CAT-POST-11 | 403 usuário comum (não admin) | usuário A autenticado, não admin | 403 | `tipo` `forbidden`; mensagem "Esta ação exige perfil administrativo."; corpo nem chega a ser validado |

## PATCH /catalogos/:entidade/:id

Arquivo: `test/endpoints/catalogos/patch-catalogos-entidade-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| CAT-PATCH-01 | admin atualiza `nome` | admin; item existente | 200 | `data.nome` atualizado; mensagem "Item de catálogo atualizado com sucesso." |
| CAT-PATCH-02 | admin reativa item (`ativo: true`) | admin; item com `ativo: false` | 200 | `data.ativo === true` |
| CAT-PATCH-03 | admin arquiva via `ativo: false` | admin; item ativo | 200 | `data.ativo === false` |
| CAT-PATCH-04 | corpo vazio | admin; `{}` | 400 | mensagem "Forneça pelo menos um campo para atualizar." |
| CAT-PATCH-05 | campo extra (`.strict()`) | admin; `{ nome: "X", extra: 1 }` | 400 | `tipo` `validationError` |
| CAT-PATCH-06 | `nome` duplicado ao renomear | admin; existe outro item ativo com o novo nome | 409 | `tipo` `conflict` |
| CAT-PATCH-07 | renomear para o próprio nome atual | admin; item existente | 200 | `validateUniqueNome` exclui o próprio `id` (`excludeId`) — não recusa |
| CAT-PATCH-08 | ID em formato inválido | admin; `/catalogos/racas/abc` | 400 | `tipo` `validationError` |
| CAT-PATCH-09 | UUID válido mas inexistente | admin; UUID aleatório | 404 | `tipo` `resourceNotFound` |
| CAT-PATCH-10 | `:entidade` inexistente | admin | 404 | `tipo` `resourceNotFound` |
| CAT-PATCH-11 | 401 sem token | sem header `Authorization` | 401 | `tipo` `unauthorized` |
| CAT-PATCH-12 | 403 usuário comum (não admin) | usuário A, não admin | 403 | `tipo` `forbidden` |

## DELETE /catalogos/:entidade/:id

Arquivo: `test/endpoints/catalogos/delete-catalogos-entidade-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| CAT-DELETE-01 | admin arquiva item sem dependentes | admin; item de catálogo sem uso | 200 | resposta com `data.ativo === false`; no banco, linha continua existindo com `ativo: false` (soft-delete); mensagem "Item de catálogo removido com sucesso." |
| CAT-DELETE-02 | trava de dependência (409) | admin; item vinculado (ex.: raça usada por um rebanho) | 409 | `tipo` `conflict`; mensagem cita quantidade de registros dependentes; no banco, item continua `ativo: true` |
| CAT-DELETE-03 | ID em formato inválido | admin; `/catalogos/racas/abc` | 400 | `tipo` `validationError` |
| CAT-DELETE-04 | UUID válido mas inexistente | admin; UUID aleatório | 404 | `tipo` `resourceNotFound` |
| CAT-DELETE-05 | `:entidade` inexistente | admin | 404 | `tipo` `resourceNotFound` |
| CAT-DELETE-06 | 401 sem token | sem header `Authorization` | 401 | `tipo` `unauthorized` |
| CAT-DELETE-07 | 403 usuário comum (não admin) | usuário A, não admin | 403 | `tipo` `forbidden` |

## Ausência de multi-tenancy

Arquivo: `test/endpoints/catalogos/get-catalogos-entidade.test.js` (cenário de confirmação sobre o
próprio `GET /catalogos/:entidade`, sem seção própria de método+caminho).

Catálogos não têm dono (`CatalogoRepository` não filtra por `usuarioId`/`propriedadeId` em nenhum
método). Cenário de confirmação, não de isolamento:

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| CAT-TENANCY-01 | item criado por admin é visível para A e para B | admin cria item | 200 | `GET /catalogos/:entidade` autenticado como A e como B retorna o mesmo item |

## Divergências

- `CatalogoRepository.findById` (`src/repository/CatalogoRepository.js:56-58`) não filtra por `ativo` —
  `GET /catalogos/:entidade/:id` devolve itens arquivados normalmente, enquanto `GET /catalogos/:entidade`
  (listagem) os esconde por padrão. Comportamento não documentado explicitamente em
  `rotas_pastolivre.md` § 8.2, mas coerente com o padrão do restante da API (detalhe por ID ignora
  soft-delete). Registrado aqui para o teste não presumir 404 num item inativo.
- Nos schemas `.strict()` (`CatalogoQuerySchema`, `CatalogoCreateSchema`, `CatalogoUpdateSchema`), a
  issue `unrecognized_keys` do Zod v4 chega com `path: []` — o nome do campo extra (`foo`, `extra`)
  aparece só em `errors[0].message` ("Unrecognized key: \"foo\""), nunca em `errors[0].path`. Os
  cenários de campo extra (`CAT-GET-08`, `CAT-POST-06`, `CAT-PATCH-05`) foram ajustados para checar a
  mensagem em vez do `path`.
