# Plano de Teste para Endpoints de Propriedade

Cadastro, listagem, edição e exclusão (soft-delete) de propriedades rurais do usuário autenticado. Fonte técnica: `documentacao/testes/propriedades/propriedades.md`. Suíte automatizada: `test/endpoints/propriedades/`.

## POST /v1/propriedades

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/propriedades | [PROP-POST-01] cria com `nome` apenas (campos opcionais ausentes) | usuário A autenticado; body só com `nome` | HTTP 201; envelope com `data.id` (UUID gerado pelo Prisma); `data.usuario.id` = A; `data.ativo` = `true` |
| POST /v1/propriedades | [PROP-POST-02] cria com `localizacao` e `areaTotalHa` válidos | usuário A autenticado; body com `localizacao` e `areaTotalHa` | HTTP 201; `data.localizacao` presente; `data.areaTotalHa` presente |
| POST /v1/propriedades | [PROP-POST-03] `localizacao` "vilhena,ro" é normalizada | usuário A autenticado; body com `localizacao: "vilhena,ro"` | HTTP 201; `data.localizacao` = `"Vilhena,RO"` (`formatLocalizacao` em `PropriedadeSchema.js:10`) |
| POST /v1/propriedades | [PROP-POST-04] aceita `id` gerado pelo cliente (offline-first) | usuário A autenticado; body com `id` UUID definido pelo cliente | HTTP 201; `data.id` igual ao UUID enviado no corpo |
| POST /v1/propriedades | [PROP-POST-05] corpo vazio | usuário A autenticado; body `{}` | HTTP 400; `tipo` = `validationError`; `errors[0].path` = `body`; `message` = "Forneça os dados da propriedade." |
| POST /v1/propriedades | [PROP-POST-06] sem `nome` (obrigatório) | usuário A autenticado; body sem `nome` | HTTP 400; issue Zod com `path` = `nome` |
| POST /v1/propriedades | [PROP-POST-07] `nome` com 1 caractere (abaixo do mínimo de 2) | usuário A autenticado | HTTP 400; issue `nome`, mensagem "pelo menos 2 caracteres" |
| POST /v1/propriedades | [PROP-POST-08] `nome` com mais de 150 caracteres | usuário A autenticado | HTTP 400; issue `nome`, mensagem "no máximo 150 caracteres" |
| POST /v1/propriedades | [PROP-POST-09] campo extra no corpo (`.strict()`) | usuário A autenticado; body com campo não previsto no schema | HTTP 400; issue Zod `unrecognized_keys` no campo extra |
| POST /v1/propriedades | [PROP-POST-10] `localizacao` fora do formato "Cidade,UF" | usuário A autenticado | HTTP 400; issue `localizacao` com a mensagem do regex |
| POST /v1/propriedades | [PROP-POST-11] `areaTotalHa` negativo ou zero | usuário A autenticado | HTTP 400; issue `areaTotalHa`, mensagem "deve ser um número positivo" |
| POST /v1/propriedades | [PROP-POST-12] `id` enviado não é UUID válido | usuário A autenticado | HTTP 400; issue `id`, mensagem "deve ser um UUID válido" |
| POST /v1/propriedades | [PROP-POST-13] sem header de autenticação | sem header `Authorization` | HTTP 401; `tipo` = `unauthorized` |
| POST /v1/propriedades | [PROP-POST-14] token inválido/expirado | header `Authorization` com token inválido/expirado | HTTP 401; `tipo` = `unauthorized`; `message` = "Sessão inválida ou expirada. Faça login novamente." |
| POST /v1/propriedades | [PROP-POST-15] nome duplicado: já existe propriedade ativa com o mesmo nome para o mesmo usuário (case-insensitive) | usuário A já tem propriedade "Fazenda X" ativa; body com mesmo nome | HTTP 409; `tipo` = `conflict`; `errors[0].path` = `nome`; `message` = "Já existe uma propriedade com este nome para este usuário." |
| POST /v1/propriedades | [PROP-POST-16] mesmo nome de uma propriedade inativa (arquivada) do mesmo usuário | A tem "Fazenda X" com `ativo: false`; body com mesmo nome | HTTP 201; cria normalmente — `PropriedadeRepository.findByNome` só considera `ativo: true` |
| POST /v1/propriedades | [PROP-POST-17] mesmo nome, usuários diferentes (A e B) | A e B autenticados separadamente, mesmo `nome` no body | HTTP 201 para ambos; unicidade de nome é escopada por `usuarioId`, não global |

## GET /v1/propriedades

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/propriedades | [PROP-GET-01] usuário sem nenhuma propriedade cadastrada | usuário A autenticado, sem propriedades | HTTP 200; `message` = "Nenhuma propriedade cadastrada."; `data.docs` = `[]`; `data.totalDocs` = 0 |
| GET /v1/propriedades | [PROP-GET-02] lista propriedades do usuário autenticado | A tem 2 propriedades ativas | HTTP 200; `data.docs.length` = 2; ordenado por `nome` asc; `message` = "2 propriedade(s) encontrada(s)." |
| GET /v1/propriedades | [PROP-GET-03] filtro `nome` (substring, case-insensitive) | A tem "Fazenda Boa Vista" e "Sítio Alegre"; query `?nome=boa` | HTTP 200; devolve só "Fazenda Boa Vista" |
| GET /v1/propriedades | [PROP-GET-04] filtro `localizacao` (substring, case-insensitive) | query `?localizacao=...` | HTTP 200; filtra pelo texto de `localizacao` |
| GET /v1/propriedades | [PROP-GET-05] filtros sem nenhum resultado | query de filtro sem correspondência | HTTP 200; `message` = "Nenhuma propriedade encontrada com os filtros informados." |
| GET /v1/propriedades | [PROP-GET-06] paginação `page=2` | A tem 15 propriedades, `limit` padrão 10; query `?page=2` | HTTP 200; `data.docs.length` = 5; `data.page` = 2; `data.totalPages` = 2 |
| GET /v1/propriedades | [PROP-GET-07] `limit` acima de 100 | query `?limit=500` | HTTP 400; issue Zod `limit`, "Too big" — `PropriedadeQuerySchema` rejeita antes do truncamento do service (ver Bugs conhecidos) |
| GET /v1/propriedades | [PROP-GET-08] `?ativo=false` não filtra nada | A tem propriedades ativas e inativas; query `?ativo=false` | HTTP 200; resposta continua trazendo só as ativas **(bug conhecido — ver Divergências)** |
| GET /v1/propriedades | [PROP-GET-09] multi-tenancy: B não vê propriedades de A | A e B com propriedades próprias | HTTP 200; `data.docs` de B não contém nenhuma propriedade de A |
| GET /v1/propriedades | [PROP-GET-10] leitura por diferença: `atualizadoDesde` traz também as inativas | A tem propriedade excluída (soft-delete) após a marca de tempo; query `?atualizadoDesde=...` | HTTP 200; `data.docs` inclui a propriedade com `ativo: false` e `updatedAt` mais recente que `atualizadoDesde` |
| GET /v1/propriedades | [PROP-GET-11] `limit` ou `page` inválidos (ex.: `page=0`, `limit=-1`) | query inválida | HTTP 400; issue Zod no campo correspondente |
| GET /v1/propriedades | [PROP-GET-12] `atualizadoDesde` fora do formato ISO 8601 | query `?atualizadoDesde=data-invalida` | HTTP 400; issue `atualizadoDesde` |
| GET /v1/propriedades | [PROP-GET-13] sem token | sem header `Authorization` | HTTP 401; `tipo` = `unauthorized` |

## GET /v1/propriedades/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/propriedades/:id | [PROP-GET-ID-01] retorna propriedade existente do usuário autenticado | usuário A autenticado, `:id` de propriedade própria | HTTP 200; `message` = "Propriedade encontrada com sucesso."; `data` inclui `usuario.{id,name,email}` |
| GET /v1/propriedades/:id | [PROP-GET-ID-02] propriedade inativa (soft-deleted) do próprio dono ainda pode ser lida por id | propriedade de A com `ativo: false` | HTTP 200; `data.ativo` = `false` (leitura por id não filtra `ativo`) |
| GET /v1/propriedades/:id | [PROP-GET-ID-03] id inexistente (UUID válido, sem registro) | `:id` = UUID válido sem registro | HTTP 404; `tipo` = `resourceNotFound`; `message` = "Recurso não encontrado em Propriedade." |
| GET /v1/propriedades/:id | [PROP-GET-ID-04] multi-tenancy: B tenta ler propriedade de A | B autenticado, `:id` de propriedade de A | HTTP 404; mesma resposta do cenário anterior — `findById` filtra por `usuarioId` |
| GET /v1/propriedades/:id | [PROP-GET-ID-05] `:id` não é UUID válido | `:id` = string não-UUID | HTTP 400; `tipo` = `validationError`; mensagem "ID de propriedade inválido. Deve ser um UUID válido." |
| GET /v1/propriedades/:id | [PROP-GET-ID-06] sem token | sem header `Authorization` | HTTP 401; `tipo` = `unauthorized` |
| GET /v1/propriedades/:id | [PROP-GET-ID-07] token inválido | header `Authorization` com token inválido | HTTP 401; `tipo` = `unauthorized` |

## PATCH /v1/propriedades/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| PATCH /v1/propriedades/:id | [PROP-PATCH-ID-01] atualiza `nome` | usuário A autenticado; body `{ nome }` | HTTP 200; `data.nome` atualizado; persistido no banco |
| PATCH /v1/propriedades/:id | [PROP-PATCH-ID-02] atualiza `localizacao` (normalizada) | body `{ localizacao }` | HTTP 200; `data.localizacao` no formato "Cidade,UF" |
| PATCH /v1/propriedades/:id | [PROP-PATCH-ID-03] atualiza `areaTotalHa` | body `{ areaTotalHa }` | HTTP 200; `data.areaTotalHa` atualizado |
| PATCH /v1/propriedades/:id | [PROP-PATCH-ID-04] corpo vazio | body `{}` | HTTP 400; `errors[0].path` = `body`; `message` = "Forneça pelo menos um campo para atualizar." |
| PATCH /v1/propriedades/:id | [PROP-PATCH-ID-05] campo extra no corpo (`.strict()`) | body com campo não previsto | HTTP 400; issue `unrecognized_keys` |
| PATCH /v1/propriedades/:id | [PROP-PATCH-ID-06] id inexistente | `:id` = UUID válido sem registro | HTTP 404; `tipo` = `resourceNotFound` |
| PATCH /v1/propriedades/:id | [PROP-PATCH-ID-07] multi-tenancy: B tenta editar propriedade de A | B autenticado, `:id` de propriedade de A | HTTP 404; mesma resposta do cenário anterior |
| PATCH /v1/propriedades/:id | [PROP-PATCH-ID-08] `nome` já usado por outra propriedade ativa do mesmo usuário | A tem "Fazenda X" e "Fazenda Y" ativas; body renomeia para "Fazenda Y" | HTTP 409; `tipo` = `conflict`; `errors[0].path` = `nome` |
| PATCH /v1/propriedades/:id | [PROP-PATCH-ID-09] reenviar o próprio `nome` atual (sem mudar) | body com `nome` igual ao já cadastrado | HTTP 200; não gera 409 — `validateUniqueNome` exclui o próprio id (`excludeId`) |
| PATCH /v1/propriedades/:id | [PROP-PATCH-ID-10] `ativo: false` com rebanhos ativos vinculados (via pasto) | propriedade de A tem pasto com rebanho ativo; body `{ ativo: false }` | HTTP 400; `tipo` = `validationError`; `errors[0].path` = `ativo`; `message` = "A propriedade ainda possui rebanhos vinculados a ela." |
| PATCH /v1/propriedades/:id | [PROP-PATCH-ID-11] `ativo: false` sem rebanhos ativos | body `{ ativo: false }` | HTTP 200; `data.ativo` = `false`; persistido |
| PATCH /v1/propriedades/:id | [PROP-PATCH-ID-12] reativa (`ativo: true`) uma propriedade inativa | propriedade de A inativa; body `{ ativo: true }` | HTTP 200; `data.ativo` = `true` |
| PATCH /v1/propriedades/:id | [PROP-PATCH-ID-13] `:id` não é UUID válido | `:id` = string não-UUID | HTTP 400; issue de `PropriedadeIdSchema` |
| PATCH /v1/propriedades/:id | [PROP-PATCH-ID-14] sem token | sem header `Authorization` | HTTP 401; `tipo` = `unauthorized` |

## DELETE /v1/propriedades/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| DELETE /v1/propriedades/:id | [PROP-DELETE-ID-01] exclui (soft-delete) propriedade sem rebanhos ativos | usuário A autenticado, `:id` de propriedade própria sem rebanhos ativos | HTTP 200; DB: `ativo` = `false`; `message` = "Propriedade excluída com sucesso." |
| DELETE /v1/propriedades/:id | [PROP-DELETE-ID-02] recusa exclusão com rebanhos ativos na propriedade | propriedade com rebanho ativo (mesma trava do PATCH, `remove` delega para `update({ativo:false})`) | HTTP 400; `tipo` = `validationError`; `errors[0].path` = `ativo` |
| DELETE /v1/propriedades/:id | [PROP-DELETE-ID-03] id inexistente | `:id` = UUID válido sem registro | HTTP 404; `tipo` = `resourceNotFound` |
| DELETE /v1/propriedades/:id | [PROP-DELETE-ID-04] multi-tenancy: B tenta excluir propriedade de A | B autenticado, `:id` de propriedade de A | HTTP 404; mesma resposta do cenário anterior |
| DELETE /v1/propriedades/:id | [PROP-DELETE-ID-05] `:id` não é UUID válido | `:id` = string não-UUID | HTTP 400; issue de `PropriedadeIdSchema` |
| DELETE /v1/propriedades/:id | [PROP-DELETE-ID-06] excluir propriedade já inativa | propriedade de A com `ativo: false` | HTTP 200; idempotente — continua `ativo: false`, sem erro |
| DELETE /v1/propriedades/:id | [PROP-DELETE-ID-07] sem token | sem header `Authorization` | HTTP 401; `tipo` = `unauthorized` |

## Bugs conhecidos

- `GET /v1/propriedades?limit=500` responde 400 em vez de truncar para 100: `PropriedadeQuerySchema` valida `limit` com `.max(100)`, então o truncamento `Math.min(...,100)` em `PropriedadeService.list` é código morto (nunca alcançado). Coberto por PROP-GET-07.
- `GET /v1/propriedades?ativo=false` não filtra propriedades inativas apesar de o schema aceitar o parâmetro: `PropriedadeController.list` só atribui `req._parsedQuery` quando a query não está vazia, e `PropriedadeService.list` nunca lê `ativo` dos parâmetros — só `nome`, `localizacao` e `atualizadoDesde`. Não há forma de listar propriedades arquivadas por esta rota (só via `atualizadoDesde`, que traz ativas e inativas juntas). Já documentado em `documentacao/rotas/rotas_pastolivre.md:60-63`.
