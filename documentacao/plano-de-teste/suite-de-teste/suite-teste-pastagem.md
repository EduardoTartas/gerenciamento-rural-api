# Plano de Teste para Endpoints de Pastagem

Cadastro, listagem, edição e exclusão (soft-delete) de pastos vinculados a uma propriedade do usuário autenticado. Fonte técnica: `documentacao/testes/pastagens/pastagens.md`. Suíte automatizada: `test/endpoints/pastagens/`.

## POST /v1/pastagens

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/pastagens | [PAST-POST-01] cria com `propriedadeId` e `nome` (campos opcionais ausentes) | propriedade ativa de A; body só com `propriedadeId` e `nome` | HTTP 201; envelope; `data.status` = `"Vazio"` (default); `data.ativo` = `true` |
| POST /v1/pastagens | [PAST-POST-02] cria com `extensaoHa`, `tipoPastagem` e `status` explícitos | body com esses campos | HTTP 201; `data.extensaoHa`, `data.tipoPastagem`, `data.status` refletem o enviado |
| POST /v1/pastagens | [PAST-POST-03] aceita `id` gerado pelo cliente (offline-first) | body com `id` UUID do cliente | HTTP 201; `data.id` igual ao UUID enviado |
| POST /v1/pastagens | [PAST-POST-04] corpo vazio | body `{}` | HTTP 400; `errors[0].path` = `body`; `message` = "Forneça os dados da pastagem." |
| POST /v1/pastagens | [PAST-POST-05] sem `propriedadeId` (obrigatório) | body sem `propriedadeId` | HTTP 400; issue `propriedadeId` |
| POST /v1/pastagens | [PAST-POST-06] sem `nome` (obrigatório) | body sem `nome` | HTTP 400; issue `nome` |
| POST /v1/pastagens | [PAST-POST-07] campo extra no corpo (`.strict()`) | body com campo não previsto | HTTP 400; issue `unrecognized_keys` |
| POST /v1/pastagens | [PAST-POST-08] `status` fora do enum (`Ocupado`/`Vazio`/`Descanso`) | body com `status` inválido | HTTP 400; issue `status` |
| POST /v1/pastagens | [PAST-POST-09] `extensaoHa` negativo ou zero | body com `extensaoHa` <= 0 | HTTP 400; issue `extensaoHa` |
| POST /v1/pastagens | [PAST-POST-10] `propriedadeId` não é UUID válido | body com `propriedadeId` inválido | HTTP 400; issue `propriedadeId` |
| POST /v1/pastagens | [PAST-POST-11] `propriedadeId` inexistente | `propriedadeId` = UUID válido sem registro | HTTP 404; `tipo` = `resourceNotFound`; `message` = "Propriedade não encontrada ou não pertence ao usuário autenticado." |
| POST /v1/pastagens | [PAST-POST-12] multi-tenancy: B tenta criar pasto em propriedade de A | B autenticado, `propriedadeId` de A | HTTP 404; mesma resposta do cenário anterior — `PastoService.ensurePropriedadeExists` filtra por `usuarioId` |
| POST /v1/pastagens | [PAST-POST-13] `propriedadeId` aponta para propriedade inativa | propriedade de A com `ativo: false` | HTTP 400; `tipo` = `validationError`; `errors[0].path` = `propriedadeId`; `message` = "Propriedade está inativa." |
| POST /v1/pastagens | [PAST-POST-14] nome duplicado: já existe pasto ativo com o mesmo nome na mesma propriedade | A tem pasto "Piquete 1" ativo nessa propriedade; body com mesmo nome | HTTP 409; `tipo` = `conflict`; `errors[0].path` = `nome` |
| POST /v1/pastagens | [PAST-POST-15] mesmo nome de pasto inativo (arquivado) na mesma propriedade — reciclagem permitida | A tem "Piquete 1" com `ativo: false`; body com mesmo nome | HTTP 201; cria normalmente — `PastoRepository.findByNome` só considera `ativo: true` |
| POST /v1/pastagens | [PAST-POST-16] mesmo nome em propriedades diferentes do mesmo usuário | body com mesmo `nome` em `propriedadeId` distintos de A | HTTP 201 para ambos; unicidade é por `propriedadeId`, não global |
| POST /v1/pastagens | [PAST-POST-17] sem token | sem header `Authorization` | HTTP 401; `tipo` = `unauthorized` |

## GET /v1/pastagens

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/pastagens | [PAST-GET-01] usuário sem nenhum pasto cadastrado | usuário A autenticado, sem pastos | HTTP 200; `message` = "Nenhuma pastagem cadastrada."; `data.docs` = `[]` |
| GET /v1/pastagens | [PAST-GET-02] lista pastos do usuário autenticado | A tem 2 pastos ativos | HTTP 200; `data.docs.length` = 2; ordenado por `nome` asc; cada item inclui `propriedade.{id,nome}` |
| GET /v1/pastagens | [PAST-GET-03] filtro `nome` (substring, case-insensitive) | query `?nome=...` | HTTP 200; filtra pelo texto |
| GET /v1/pastagens | [PAST-GET-04] filtro `propriedadeId` | A tem pastos em 2 propriedades; query `?propriedadeId=...` | HTTP 200; só devolve pastos da propriedade filtrada |
| GET /v1/pastagens | [PAST-GET-05] filtro `status` | query `?status=...` | HTTP 200; só devolve pastos com aquele status |
| GET /v1/pastagens | [PAST-GET-06] filtro `tipoPastagem` (substring, case-insensitive) | query `?tipoPastagem=...` | HTTP 200; filtra pelo texto |
| GET /v1/pastagens | [PAST-GET-07] filtros sem nenhum resultado | query sem correspondência | HTTP 200; `message` = "Nenhuma pastagem encontrada com os filtros informados." |
| GET /v1/pastagens | [PAST-GET-08] paginação `page=2` | A tem 15 pastos; query `?page=2` | HTTP 200; `data.page` = 2; `data.docs.length` = 5 |
| GET /v1/pastagens | [PAST-GET-09] `limit` acima de 100 é recusado pela query | query `?limit=500` | HTTP 400; issue `limit` — `PastoQuerySchema` tem `.max(100)`, nunca chega ao truncamento de `PastoService.list` (ver Bugs conhecidos) |
| GET /v1/pastagens | [PAST-GET-10] `?ativo=false` filtra só os pastos inativos | A tem pastos ativos e inativos; query `?ativo=false` | HTTP 200; `data.docs` só contém `ativo: false` — ao contrário de `/propriedades`, aqui o filtro funciona |
| GET /v1/pastagens | [PAST-GET-11] multi-tenancy: B não vê pastos de A | A e B com pastos próprios | HTTP 200; `data.docs` de B não contém pastos de A |
| GET /v1/pastagens | [PAST-GET-12] leitura por diferença: `atualizadoDesde` traz também os inativos | pasto de A excluído após a marca de tempo; query `?atualizadoDesde=...` | HTTP 200; `data.docs` inclui o pasto com `ativo: false` e `updatedAt` |
| GET /v1/pastagens | [PAST-GET-13] query inválida (ex.: `status=Invalido`) | query `?status=Invalido` | HTTP 400; issue `status` |
| GET /v1/pastagens | [PAST-GET-14] sem token | sem header `Authorization` | HTTP 401; `tipo` = `unauthorized` |

## GET /v1/pastagens/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/pastagens/:id | [PAST-GET-ID-01] retorna pasto existente do usuário autenticado | usuário A autenticado, `:id` próprio | HTTP 200; `message` = "Pastagem encontrada com sucesso."; `data.propriedade.{id,nome}` presente |
| GET /v1/pastagens/:id | [PAST-GET-ID-02] pasto inativo (soft-deleted) do próprio dono ainda pode ser lido por id | pasto de A com `ativo: false` | HTTP 200; `data.ativo` = `false` |
| GET /v1/pastagens/:id | [PAST-GET-ID-03] id inexistente | `:id` = UUID válido sem registro | HTTP 404; `tipo` = `resourceNotFound`; `message` = "Recurso não encontrado em Pastagem." |
| GET /v1/pastagens/:id | [PAST-GET-ID-04] multi-tenancy: B tenta ler pasto de A | B autenticado, `:id` de pasto de A | HTTP 404; mesma resposta do cenário anterior |
| GET /v1/pastagens/:id | [PAST-GET-ID-05] `:id` não é UUID válido | `:id` = string não-UUID | HTTP 400; mensagem "ID de pastagem inválido. Deve ser um UUID válido." |
| GET /v1/pastagens/:id | [PAST-GET-ID-06] sem token | sem header `Authorization` | HTTP 401; `tipo` = `unauthorized` |

## PATCH /v1/pastagens/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| PATCH /v1/pastagens/:id | [PAST-PATCH-ID-01] atualiza `nome` | body `{ nome }` | HTTP 200; `data.nome` atualizado |
| PATCH /v1/pastagens/:id | [PAST-PATCH-ID-02] atualiza `extensaoHa` e `tipoPastagem` | body com esses campos | HTTP 200; valores refletidos em `data` |
| PATCH /v1/pastagens/:id | [PAST-PATCH-ID-03] força `status` para `"Ocupado"` sem rebanhos (nenhuma trava aplicável) | body `{ status: "Ocupado" }` sem rebanho vinculado | HTTP 200; `data.status` = `"Ocupado"` — atualização manual é permitida (não é derivada automaticamente nesta rota; ver Bugs conhecidos) |
| PATCH /v1/pastagens/:id | [PAST-PATCH-ID-04] corpo vazio | body `{}` | HTTP 400; `errors[0].path` = `body`; `message` = "Forneça pelo menos um campo para atualizar." |
| PATCH /v1/pastagens/:id | [PAST-PATCH-ID-05] campo extra no corpo (`.strict()`) | body com campo não previsto | HTTP 400; issue `unrecognized_keys` |
| PATCH /v1/pastagens/:id | [PAST-PATCH-ID-06] `status` fora do enum | body com `status` inválido | HTTP 400; issue `status` |
| PATCH /v1/pastagens/:id | [PAST-PATCH-ID-07] id inexistente | `:id` = UUID válido sem registro | HTTP 404; `tipo` = `resourceNotFound` |
| PATCH /v1/pastagens/:id | [PAST-PATCH-ID-08] multi-tenancy: B tenta editar pasto de A | B autenticado, `:id` de pasto de A | HTTP 404; mesma resposta do cenário anterior; pasto de A permanece com nome original no banco |
| PATCH /v1/pastagens/:id | [PAST-PATCH-ID-09] `nome` já usado por outro pasto ativo na mesma propriedade | body renomeia para nome já usado | HTTP 409; `tipo` = `conflict`; `errors[0].path` = `nome` |
| PATCH /v1/pastagens/:id | [PAST-PATCH-ID-10] `status: "Vazio"` com rebanho ativo alocado no pasto | pasto tem rebanho ativo (`pastoAtualId`); body `{ status: "Vazio" }` | HTTP 400; `tipo` = `validationError`; `errors[0].path` = `status`; `errors[0].message` inclui "há rebanhos no pasto" (top-level `message` = "Pasto está ocupado por um ou mais rebanhos.") |
| PATCH /v1/pastagens/:id | [PAST-PATCH-ID-11] `status: "Descanso"` com rebanho ativo alocado | idem, body `{ status: "Descanso" }` | HTTP 400; mesma trava do cenário anterior |
| PATCH /v1/pastagens/:id | [PAST-PATCH-ID-12] `ativo: false` com rebanho ativo no pasto | idem, body `{ ativo: false }` | HTTP 400; `tipo` = `validationError`; `errors[0].path` = `ativo`; `message` = "Pasto ainda contém rebanhos vinculados." |
| PATCH /v1/pastagens/:id | [PAST-PATCH-ID-13] `ativo: false` sem rebanhos | body `{ ativo: false }`, pasto sem rebanhos | HTTP 200; `data.ativo` = `false` |
| PATCH /v1/pastagens/:id | [PAST-PATCH-ID-14] atualiza `dataUltimaSaida` manualmente | body `{ dataUltimaSaida }` | HTTP 200; `data.dataUltimaSaida` refletido — o campo é editável diretamente via PATCH, não só derivado por movimentação/inativação de rebanho |
| PATCH /v1/pastagens/:id | [PAST-PATCH-ID-15] `:id` não é UUID válido | `:id` = string não-UUID | HTTP 400; issue de `PastoIdSchema` |
| PATCH /v1/pastagens/:id | [PAST-PATCH-ID-16] sem token | sem header `Authorization` | HTTP 401; `tipo` = `unauthorized` |

## DELETE /v1/pastagens/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| DELETE /v1/pastagens/:id | [PAST-DELETE-ID-01] exclui (soft-delete) pasto sem rebanhos | usuário A autenticado, pasto sem rebanhos | HTTP 200; DB: `ativo` = `false` |
| DELETE /v1/pastagens/:id | [PAST-DELETE-ID-02] recusa exclusão com rebanho ativo no pasto | pasto com rebanho ativo | HTTP 400; `tipo` = `validationError`; `errors[0].path` = `ativo` |
| DELETE /v1/pastagens/:id | [PAST-DELETE-ID-03] id inexistente | `:id` = UUID válido sem registro | HTTP 404; `tipo` = `resourceNotFound` |
| DELETE /v1/pastagens/:id | [PAST-DELETE-ID-04] multi-tenancy: B tenta excluir pasto de A | B autenticado, `:id` de pasto de A | HTTP 404; mesma resposta do cenário anterior |
| DELETE /v1/pastagens/:id | [PAST-DELETE-ID-05] `:id` não é UUID válido | `:id` = string não-UUID | HTTP 400; issue de `PastoIdSchema` |
| DELETE /v1/pastagens/:id | [PAST-DELETE-ID-06] sem token | sem header `Authorization` | HTTP 401; `tipo` = `unauthorized` |

## Bugs conhecidos

- `PastoService.ensurePropriedadeExists` lança `customMessage: 'Propriedade não encontrada ou não pertence ao usuário autenticado.'`, diferente da mensagem genérica `messages.error.resourceNotFound('Propriedade')` usada por `ensurePastoExists` para o próprio recurso (`src/service/PastoService.js:185-197`). PAST-POST-11 reflete a mensagem real.
- `GET /v1/pastagens?limit=500` é recusado com 400 antes de chegar ao service: `PastoQuerySchema.js:30` declara `limit` com `.max(100)`, então o truncamento em `PastoService.list` (`Math.min(parseInt(limit, 10) || 10, 100)`) é código morto para valores acima de 100 vindos via HTTP. PAST-GET-09 reflete o comportamento real (400).
- `documentacao/rotas/rotas_pastolivre.md:110-114` descreve a transição de `status` como automática, mas essa lógica vive em `MovimentacaoService`/`RebanhoService`, não em `PastoService`. `PATCH /v1/pastagens/:id` aceita `status` como campo livre e só bloqueia a mudança para `"Vazio"`/`"Descanso"` quando há rebanhos ativos — nada impede o cliente de forçar `"Ocupado"` sem gado real ou deixar o status desalinhado com a movimentação real (`src/service/PastoService.js:76-133`).
