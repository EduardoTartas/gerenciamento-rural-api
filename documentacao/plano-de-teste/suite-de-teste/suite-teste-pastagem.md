# /pastagens

Controller `PastoController` · Service `PastoService` · Repository `PastoRepository` ·
Schemas `PastoCreateSchema`, `PastoUpdateSchema`, `PastoQuerySchema`, `PastoIdSchema` ·
Regras: `documentacao/rotas/rotas_pastolivre.md` § 3

Pré-condições comuns: usuário A e usuário B autenticados via BetterAuth, cada um com ao menos
uma propriedade própria. Nenhuma rota de `/pastagens` usa `AdminMiddleware` — sem categoria
403 admin aqui.

## POST /pastagens

Arquivo: `test/endpoints/pastagens/post-pastagens.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| PAST-POST-01 | cria com `propriedadeId` e `nome` (campos opcionais ausentes) | propriedade ativa de A | 201 | envelope; `data.status` = `"Vazio"` (default); `data.ativo` = `true` |
| PAST-POST-02 | cria com `extensaoHa`, `tipoPastagem` e `status` explícitos | — | 201 | `data.extensaoHa`, `data.tipoPastagem`, `data.status` refletem o enviado |
| PAST-POST-03 | aceita `id` gerado pelo cliente (offline-first) | — | 201 | `data.id` igual ao UUID enviado |
| PAST-POST-04 | corpo vazio (`{}`) | — | 400 | `errors[0].path` = `body`; `message` = "Forneça os dados da pastagem." |
| PAST-POST-05 | sem `propriedadeId` (obrigatório) | — | 400 | issue `propriedadeId` |
| PAST-POST-06 | sem `nome` (obrigatório) | — | 400 | issue `nome` |
| PAST-POST-07 | campo extra no corpo (`.strict()`) | — | 400 | issue `unrecognized_keys` |
| PAST-POST-08 | `status` fora do enum (`Ocupado`/`Vazio`/`Descanso`) | — | 400 | issue `status` |
| PAST-POST-09 | `extensaoHa` negativo ou zero | — | 400 | issue `extensaoHa` |
| PAST-POST-10 | `propriedadeId` não é UUID válido | — | 400 | issue `propriedadeId` |
| PAST-POST-11 | `propriedadeId` inexistente | — | 404 | `tipo` = `resourceNotFound`; `message` = "Propriedade não encontrada ou não pertence ao usuário autenticado." |
| PAST-POST-12 | multi-tenancy: B tenta criar pasto em propriedade de A | propriedade de A | 404 | mesma resposta do cenário anterior — `PastoService.ensurePropriedadeExists` filtra por `usuarioId` |
| PAST-POST-13 | `propriedadeId` aponta para propriedade inativa | propriedade de A com `ativo: false` | 400 | `tipo` = `validationError`; `errors[0].path` = `propriedadeId`; `message` = "Propriedade está inativa." |
| PAST-POST-14 | nome duplicado: já existe pasto **ativo** com o mesmo nome na mesma propriedade | A tem pasto "Piquete 1" ativo nessa propriedade | 409 | `tipo` = `conflict`; `errors[0].path` = `nome` |
| PAST-POST-15 | mesmo nome de pasto **inativo** (arquivado) na mesma propriedade — reciclagem permitida | A tem "Piquete 1" com `ativo: false` | 201 | cria normalmente — `PastoRepository.findByNome` só considera `ativo: true` |
| PAST-POST-16 | mesmo nome em propriedades diferentes do mesmo usuário | — | 201 para ambos | unicidade é por `propriedadeId`, não global |
| PAST-POST-17 | sem token | — | 401 | `tipo` = `unauthorized` |

## GET /pastagens

Arquivo: `test/endpoints/pastagens/get-pastagens.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| PAST-GET-01 | usuário sem nenhum pasto cadastrado | — | 200 | `message` = "Nenhuma pastagem cadastrada."; `data.docs` = `[]` |
| PAST-GET-02 | lista pastos do usuário autenticado | A tem 2 pastos ativos | 200 | `data.docs.length` = 2; ordenado por `nome` asc; cada item inclui `propriedade.{id,nome}` |
| PAST-GET-03 | filtro `nome` (substring, case-insensitive) | — | 200 | filtra pelo texto |
| PAST-GET-04 | filtro `propriedadeId` | A tem pastos em 2 propriedades | 200 | só devolve pastos da propriedade filtrada |
| PAST-GET-05 | filtro `status` | — | 200 | só devolve pastos com aquele status |
| PAST-GET-06 | filtro `tipoPastagem` (substring, case-insensitive) | — | 200 | filtra pelo texto |
| PAST-GET-07 | filtros sem nenhum resultado | — | 200 | `message` = "Nenhuma pastagem encontrada com os filtros informados." |
| PAST-GET-08 | paginação `page=2` | A tem 15 pastos | 200 | `data.page` = 2; `data.docs.length` = 5 |
| PAST-GET-09 | `limit` acima de 100 é recusado pela query | — | 400 | issue `limit` — `PastoQuerySchema.limit` já tem `.max(100)` |
| PAST-GET-10 | `?ativo=false` filtra só os pastos inativos | A tem pastos ativos e inativos | 200 | `data.docs` só contém `ativo: false` — ao contrário de `/propriedades`, aqui o filtro funciona (`PastoService.list` repassa `ativo`) |
| PAST-GET-11 | multi-tenancy: B não vê pastos de A | — | 200 | `data.docs` de B não contém pastos de A |
| PAST-GET-12 | leitura por diferença: `atualizadoDesde` traz também os inativos | pasto de A excluído após a marca de tempo | 200 | `data.docs` inclui o pasto com `ativo: false` e `updatedAt` |
| PAST-GET-13 | query inválida (ex.: `status=Invalido`) | — | 400 | issue `status` |
| PAST-GET-14 | sem token | — | 401 | `tipo` = `unauthorized` |

## GET /pastagens/:id

Arquivo: `test/endpoints/pastagens/get-pastagens-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| PAST-GET-ID-01 | retorna pasto existente do usuário autenticado | — | 200 | `message` = "Pastagem encontrada com sucesso."; `data.propriedade.{id,nome}` presente |
| PAST-GET-ID-02 | pasto inativo (soft-deleted) do próprio dono ainda pode ser lido por id | — | 200 | `data.ativo` = `false` |
| PAST-GET-ID-03 | id inexistente | — | 404 | `tipo` = `resourceNotFound`; `message` = "Recurso não encontrado em Pastagem." |
| PAST-GET-ID-04 | multi-tenancy: B tenta ler pasto de A | — | 404 | mesma resposta do cenário anterior |
| PAST-GET-ID-05 | `:id` não é UUID válido | — | 400 | mensagem "ID de pastagem inválido. Deve ser um UUID válido." |
| PAST-GET-ID-06 | sem token | — | 401 | `tipo` = `unauthorized` |

## PATCH /pastagens/:id

Arquivo: `test/endpoints/pastagens/patch-pastagens-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| PAST-PATCH-ID-01 | atualiza `nome` | — | 200 | `data.nome` atualizado |
| PAST-PATCH-ID-02 | atualiza `extensaoHa` e `tipoPastagem` | — | 200 | valores refletidos em `data` |
| PAST-PATCH-ID-03 | recusa `status` `"Ocupado"` sem rebanho ativo vinculado | — | 400 | `tipo` = `validationError`; `errors[0].path` = `status` |
| PAST-PATCH-ID-03b | aceita `status` `"Ocupado"` com rebanho ativo vinculado | pasto com rebanho ativo | 200 | `data.status` = `"Ocupado"` |
| PAST-PATCH-ID-04 | corpo vazio (`{}`) | — | 400 | `errors[0].path` = `body`; `message` = "Forneça pelo menos um campo para atualizar." |
| PAST-PATCH-ID-05 | campo extra no corpo (`.strict()`) | — | 400 | issue `unrecognized_keys` |
| PAST-PATCH-ID-06 | `status` fora do enum | — | 400 | issue `status` |
| PAST-PATCH-ID-07 | id inexistente | — | 404 | `tipo` = `resourceNotFound` |
| PAST-PATCH-ID-08 | multi-tenancy: B tenta editar pasto de A | — | 404 | mesma resposta do cenário anterior; pasto de A permanece com nome original no banco |
| PAST-PATCH-ID-09 | `nome` já usado por outro pasto ativo na mesma propriedade | — | 409 | `tipo` = `conflict`; `errors[0].path` = `nome` |
| PAST-PATCH-ID-10 | `status: "Vazio"` com rebanho ativo alocado no pasto | pasto tem rebanho ativo (`pastoAtualId`) | 400 | `tipo` = `validationError`; `errors[0].path` = `status`; `errors[0].message` inclui "há rebanhos no pasto" (top-level `message` = "Pasto está ocupado por um ou mais rebanhos.") |
| PAST-PATCH-ID-11 | `status: "Descanso"` com rebanho ativo alocado | idem | 400 | mesma trava do cenário anterior |
| PAST-PATCH-ID-12 | `ativo: false` com rebanho ativo no pasto | idem | 400 | `tipo` = `validationError`; `errors[0].path` = `ativo`; `message` = "Pasto ainda contém rebanhos vinculados." |
| PAST-PATCH-ID-13 | `ativo: false` sem rebanhos | — | 200 | `data.ativo` = `false` |
| PAST-PATCH-ID-14 | atualiza `dataUltimaSaida` manualmente | — | 200 | `data.dataUltimaSaida` refletido — o campo é editável diretamente via PATCH, não só derivado por movimentação/inativação de rebanho |
| PAST-PATCH-ID-15 | `:id` não é UUID válido | — | 400 | issue de `PastoIdSchema` |
| PAST-PATCH-ID-16 | sem token | — | 401 | `tipo` = `unauthorized` |

## DELETE /pastagens/:id

Arquivo: `test/endpoints/pastagens/delete-pastagens-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| PAST-DELETE-ID-01 | exclui (soft-delete) pasto sem rebanhos | — | 200 | DB: `ativo` = `false` |
| PAST-DELETE-ID-02 | recusa exclusão com rebanho ativo no pasto | — | 400 | `tipo` = `validationError`; `errors[0].path` = `ativo` |
| PAST-DELETE-ID-03 | id inexistente | — | 404 | `tipo` = `resourceNotFound` |
| PAST-DELETE-ID-04 | multi-tenancy: B tenta excluir pasto de A | — | 404 | mesma resposta do cenário anterior |
| PAST-DELETE-ID-05 | `:id` não é UUID válido | — | 400 | issue de `PastoIdSchema` |
| PAST-DELETE-ID-06 | sem token | — | 401 | `tipo` = `unauthorized` |

