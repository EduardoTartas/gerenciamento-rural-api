# Plano de Teste para Endpoints de Manejo de Pastagem

Registro de atividades de manejo aplicadas a um pasto, opcionalmente com itens de consumo de insumo. Fonte técnica: `documentacao/testes/pastagens-manejos/pastagens-manejos.md`. Suíte automatizada: `test/endpoints/pastagens-manejos/`.

## POST /v1/pastagens/manejos

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/pastagens/manejos | [MPAS-POST-01] cria manejo sem `itens` | pasto ativo de A, tipo de manejo ativo; body sem `itens` | HTTP 201; envelope; `data.itens` = `[]` |
| POST /v1/pastagens/manejos | [MPAS-POST-02] cria manejo com 1 item de insumo `destino: "Pasto"` | insumo da mesma propriedade do pasto; body com 1 item | HTTP 201; `data.itens[0]` presente; DB: `movimentacaoInsumo` criada com `tipo: "Saida"`, `origem: "ManejoPasto"`, `manejoPastoId` = id do manejo, `pastoId` = pasto informado |
| POST /v1/pastagens/manejos | [MPAS-POST-03] cria manejo com item de insumo `destino: "Ambos"` | body com item cujo insumo tem `destino: "Ambos"` | HTTP 201; mesma verificação do cenário anterior — `destino` aceito quando é `"Pasto"` ou `"Ambos"` |
| POST /v1/pastagens/manejos | [MPAS-POST-04] aceita `id` do manejo gerado pelo cliente (offline-first) | body com `id` UUID do cliente | HTTP 201; `data.id` igual ao enviado |
| POST /v1/pastagens/manejos | [MPAS-POST-05] aceita `id` do item gerado pelo cliente | body com `itens[0].id` UUID do cliente | HTTP 201; a movimentação de saída criada no banco tem o mesmo `id` do item enviado |
| POST /v1/pastagens/manejos | [MPAS-POST-06] corpo vazio | body `{}` | HTTP 400; `errors[0].path` = `body`; `message` = "Forneça os dados do manejo de pasto." |
| POST /v1/pastagens/manejos | [MPAS-POST-07] sem `pastoId` | body sem `pastoId` | HTTP 400; issue `pastoId` |
| POST /v1/pastagens/manejos | [MPAS-POST-08] sem `tipoManejoId` | body sem `tipoManejoId` | HTTP 400; issue `tipoManejoId` |
| POST /v1/pastagens/manejos | [MPAS-POST-09] sem `dataAtividade` | body sem `dataAtividade` | HTTP 400; issue `dataAtividade` |
| POST /v1/pastagens/manejos | [MPAS-POST-10] `dataAtividade` no futuro | body com `dataAtividade` futura | HTTP 400; issue `dataAtividade`, mensagem "não pode ser no futuro" |
| POST /v1/pastagens/manejos | [MPAS-POST-11] campo extra no corpo (`.strict()`) | body com campo não previsto | HTTP 400; issue `unrecognized_keys` |
| POST /v1/pastagens/manejos | [MPAS-POST-12] item de `itens` com campo extra (`.strict()` no item) | `itens[0]` com campo não previsto | HTTP 400; issue `unrecognized_keys` dentro de `itens[0]` |
| POST /v1/pastagens/manejos | [MPAS-POST-13] mais de 50 itens em `itens` | body com 51 itens | HTTP 400; issue "No máximo 50 itens de insumo por manejo." |
| POST /v1/pastagens/manejos | [MPAS-POST-14] item com `quantidade` zero ou negativa | `itens[0].quantidade` <= 0 | HTTP 400; issue `itens[0].quantidade` |
| POST /v1/pastagens/manejos | [MPAS-POST-15] `pastoId` inexistente | `pastoId` = UUID válido sem registro | HTTP 404; `tipo` = `resourceNotFound`; `message` = "Pastagem não encontrada ou não pertence ao usuário autenticado." |
| POST /v1/pastagens/manejos | [MPAS-POST-16] multi-tenancy: B tenta criar manejo em pasto de A | B autenticado, `pastoId` de A | HTTP 404; mesma resposta do cenário anterior — `ensurePastoExists` filtra por `usuarioId` |
| POST /v1/pastagens/manejos | [MPAS-POST-17] `pastoId` aponta para pasto inativo | pasto de A com `ativo: false` | HTTP 400; `tipo` = `validationError`; `errors[0].path` = `pastoId`; `message` = "Pasto está inativo." |
| POST /v1/pastagens/manejos | [MPAS-POST-18] `tipoManejoId` inexistente ou inativo no catálogo | `tipoManejoId` inválido/inativo | HTTP 404; `tipo` = `resourceNotFound`; `errors[0].path` = `tipoManejoId` |
| POST /v1/pastagens/manejos | [MPAS-POST-19] item com `insumoId` que não existe na propriedade do pasto | `itens[0].insumoId` inexistente | HTTP 400; `tipo` = `validationError`; `errors[0].path` = `itens`; `message` inclui "não encontrado nesta propriedade" |
| POST /v1/pastagens/manejos | [MPAS-POST-20] item com `insumoId` de outra propriedade do mesmo usuário | A tem insumo em propriedade diferente da do pasto | HTTP 400; mesma resposta do cenário anterior (`insumo.propriedadeId !== pasto.propriedadeId`) |
| POST /v1/pastagens/manejos | [MPAS-POST-21] item com `insumoId` de insumo `destino: "Rebanho"` | `itens[0].insumoId` incompatível | HTTP 400; `errors[0].path` = `itens`; `message` inclui "não é destinado ao pasto" |
| POST /v1/pastagens/manejos | [MPAS-POST-22] dois itens com o mesmo `insumoId` repetido | `itens` com `insumoId` duplicado | HTTP 201; cria duas movimentações de saída (uma por item da lista) — `insumosPorId` só evita reconsultar o insumo, não deduplica a movimentação (ver Bugs conhecidos) |
| POST /v1/pastagens/manejos | [MPAS-POST-23] saída deixa o saldo do insumo negativo | insumo com pouco saldo disponível | HTTP 201; manejo é criado mesmo assim; `data.avisos` contém mensagem "Estoque insuficiente de ... — saldo ficará negativo." — a regra avisa, não bloqueia |
| POST /v1/pastagens/manejos | [MPAS-POST-24] sem token | sem header `Authorization` | HTTP 401; `tipo` = `unauthorized` |

## GET /v1/pastagens/manejos

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/pastagens/manejos | [MPAS-GET-01] usuário sem nenhum manejo cadastrado | usuário A autenticado, sem manejos | HTTP 200; `message` = "Nenhum manejo de pasto cadastrado."; `data.docs` = `[]` |
| GET /v1/pastagens/manejos | [MPAS-GET-02] lista manejos do usuário autenticado | A tem 2 manejos | HTTP 200; `data.docs.length` = 2; ordenado por `dataAtividade` desc; cada item inclui `tipoManejo.{id,nome}`, `pasto.{id,nome,propriedade.{id,nome}}`, `itens` = `[]` |
| GET /v1/pastagens/manejos | [MPAS-GET-03] filtro `pastoId` | query `?pastoId=...` | HTTP 200; só devolve manejos daquele pasto |
| GET /v1/pastagens/manejos | [MPAS-GET-04] filtro `propriedadeId` | manejos em pastos de propriedades diferentes; query `?propriedadeId=...` | HTTP 200; só devolve manejos de pastos daquela propriedade |
| GET /v1/pastagens/manejos | [MPAS-GET-05] filtro `tipoManejoId` | query `?tipoManejoId=...` | HTTP 200; só devolve manejos daquele tipo |
| GET /v1/pastagens/manejos | [MPAS-GET-06] filtro `dataInicio`/`dataFim` | query com intervalo | HTTP 200; só devolve manejos com `dataAtividade` no intervalo |
| GET /v1/pastagens/manejos | [MPAS-GET-07] filtros sem nenhum resultado | query sem correspondência | HTTP 200; `message` = "Nenhum manejo de pasto encontrado com os filtros informados." |
| GET /v1/pastagens/manejos | [MPAS-GET-08] paginação `page=2` | A tem 15 manejos; query `?page=2` | HTTP 200; `data.page` = 2 |
| GET /v1/pastagens/manejos | [MPAS-GET-09] `limit` acima de 100 é recusado | query `?limit=500` | HTTP 400; `tipo` = `validationError`; issue `limit` |
| GET /v1/pastagens/manejos | [MPAS-GET-10] `?ativo=false` filtra só os manejos excluídos | A tem manejo excluído (soft-delete); query `?ativo=false` | HTTP 200; `data.docs` tem 1 item; só contém `ativo: false` |
| GET /v1/pastagens/manejos | [MPAS-GET-11] multi-tenancy: B não vê manejos de pastos de A | A e B com manejos próprios | HTTP 200; `data.docs` de B não contém manejos de pastos de A |
| GET /v1/pastagens/manejos | [MPAS-GET-12] leitura por diferença: `atualizadoDesde` traz vigentes e excluídos juntos | manejo de A excluído após a marca de tempo; query `?atualizadoDesde=...` | HTTP 200; `data.docs` inclui o manejo com `ativo: false` e `updatedAt`; filtro padrão de `ativo` não é aplicado |
| GET /v1/pastagens/manejos | [MPAS-GET-13] query inválida (`dataInicio` malformada) | query `?dataInicio=data-invalida` | HTTP 400; issue `dataInicio` |
| GET /v1/pastagens/manejos | [MPAS-GET-14] sem token | sem header `Authorization` | HTTP 401; `tipo` = `unauthorized` |

## GET /v1/pastagens/manejos/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/pastagens/manejos/:id | [MPAS-GET-ID-01] retorna manejo existente do usuário autenticado | usuário A autenticado, `:id` próprio | HTTP 200; `message` = "Manejo de pasto encontrado com sucesso."; `data.itens` = `[]` |
| GET /v1/pastagens/manejos/:id | [MPAS-GET-ID-02] manejo inativo (soft-deleted) ainda pode ser lido por id | manejo de A com `ativo: false` | HTTP 200; `data.ativo` = `false` |
| GET /v1/pastagens/manejos/:id | [MPAS-GET-ID-03] id inexistente | `:id` = UUID válido sem registro | HTTP 404; `tipo` = `resourceNotFound`; `message` = "Recurso não encontrado em Manejo de Pasto." |
| GET /v1/pastagens/manejos/:id | [MPAS-GET-ID-04] multi-tenancy: B tenta ler manejo de A | B autenticado, `:id` de manejo de A | HTTP 404; mesma resposta do cenário anterior |
| GET /v1/pastagens/manejos/:id | [MPAS-GET-ID-05] `:id` não é UUID válido | `:id` = string não-UUID | HTTP 400; mensagem "ID de manejo de pasto inválido. Deve ser um UUID válido." |
| GET /v1/pastagens/manejos/:id | [MPAS-GET-ID-06] sem token | sem header `Authorization` | HTTP 401; `tipo` = `unauthorized` |

## PATCH /v1/pastagens/manejos/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| PATCH /v1/pastagens/manejos/:id | [MPAS-PATCH-ID-01] atualiza `tipoManejoId` para outro tipo válido | body `{ tipoManejoId }` | HTTP 200; `data.tipoManejoId` atualizado |
| PATCH /v1/pastagens/manejos/:id | [MPAS-PATCH-ID-02] atualiza `dataAtividade` | body `{ dataAtividade }` no passado | HTTP 200; `data.dataAtividade` atualizado |
| PATCH /v1/pastagens/manejos/:id | [MPAS-PATCH-ID-03] atualiza `observacoes` | body `{ observacoes }` | HTTP 200; `data.observacoes` atualizado |
| PATCH /v1/pastagens/manejos/:id | [MPAS-PATCH-ID-04] corpo vazio | body `{}` | HTTP 400; `message` = "Forneça pelo menos um campo para atualizar." |
| PATCH /v1/pastagens/manejos/:id | [MPAS-PATCH-ID-05] campo extra no corpo (`.strict()`) | body com campo não previsto | HTTP 400; issue `unrecognized_keys` |
| PATCH /v1/pastagens/manejos/:id | [MPAS-PATCH-ID-06] envia `itens` no corpo | body `{ itens: [...] }` | HTTP 400; issue `unrecognized_keys` em `itens` — `ManejoPastoUpdateSchema` não aceita alterar itens via PATCH |
| PATCH /v1/pastagens/manejos/:id | [MPAS-PATCH-ID-07] `dataAtividade` no futuro | body com `dataAtividade` futura | HTTP 400; issue `dataAtividade` |
| PATCH /v1/pastagens/manejos/:id | [MPAS-PATCH-ID-08] id inexistente | `:id` = UUID válido sem registro | HTTP 404; `tipo` = `resourceNotFound` |
| PATCH /v1/pastagens/manejos/:id | [MPAS-PATCH-ID-09] multi-tenancy: B tenta editar manejo de A | B autenticado, `:id` de manejo de A | HTTP 404; mesma resposta do cenário anterior; manejo de A permanece inalterado no banco |
| PATCH /v1/pastagens/manejos/:id | [MPAS-PATCH-ID-10] `tipoManejoId` inexistente ou inativo | body com `tipoManejoId` inválido | HTTP 404; `tipo` = `resourceNotFound`; `errors[0].path` = `tipoManejoId` |
| PATCH /v1/pastagens/manejos/:id | [MPAS-PATCH-ID-11] `:id` não é UUID válido | `:id` = string não-UUID | HTTP 400; issue de `ManejoPastoIdSchema` |
| PATCH /v1/pastagens/manejos/:id | [MPAS-PATCH-ID-12] sem token | sem header `Authorization` | HTTP 401; `tipo` = `unauthorized` |

## DELETE /v1/pastagens/manejos/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| DELETE /v1/pastagens/manejos/:id | [MPAS-DELETE-ID-01] exclui manejo sem itens | usuário A autenticado, manejo sem itens | HTTP 200; DB: `ativo` = `false` — a linha continua existindo (soft-delete, não remoção física) **(bug conhecido — ver Divergências)** |
| DELETE /v1/pastagens/manejos/:id | [MPAS-DELETE-ID-02] exclui manejo com itens de insumo vinculados | manejo com 1+ movimentações de saída | HTTP 200; DB: `movimentacaoInsumo` das movimentações originadas desse manejo também fica `ativo: false` (`movimentacaoInsumoRepository.desativarPorManejo`) — o saldo do insumo deixa de ser debitado por elas |
| DELETE /v1/pastagens/manejos/:id | [MPAS-DELETE-ID-03] id inexistente | `:id` = UUID válido sem registro | HTTP 404; `tipo` = `resourceNotFound` |
| DELETE /v1/pastagens/manejos/:id | [MPAS-DELETE-ID-04] multi-tenancy: B tenta excluir manejo de A | B autenticado, `:id` de manejo de A | HTTP 404; mesma resposta do cenário anterior |
| DELETE /v1/pastagens/manejos/:id | [MPAS-DELETE-ID-05] `:id` não é UUID válido | `:id` = string não-UUID | HTTP 400; issue de `ManejoPastoIdSchema` |
| DELETE /v1/pastagens/manejos/:id | [MPAS-DELETE-ID-06] sem token | sem header `Authorization` | HTTP 401; `tipo` = `unauthorized` |

## Bugs conhecidos

- `Math.min(parseInt(limit, 10) || 10, 100)` em `ManejoPastoService.list` (`src/service/ManejoPastoService.js:54`) é código morto: `ManejoPastoQuerySchema.limit` já tem `.max(100)`, então `?limit=500` nunca chega ao service — cai em 400 antes. `limit` > 100 recusado com 400 é o contrato atual (MPAS-GET-09).
- MPAS-POST-15/16 (`pastoId` inexistente): a mensagem real de `ManejoPastoService.ensurePastoExists` (`src/service/ManejoPastoService.js:194-206`) é "Pastagem não encontrada ou não pertence ao usuário autenticado.", não o texto genérico de `messages.error.resourceNotFound('Pastagem')`.
- MPAS-POST-02/03/DELETE-ID-02: o ledger de insumo usado nesta rota é a tabela `movimentacaoInsumo` (`prisma/schema.prisma:345`), não `historicoMovimentacao` (exclusiva de `rebanhos/movimentacoes`).
- `CLAUDE.md` ("Soft-delete") afirma que "Manejos são excluídos de verdade (não têm dependentes)". O código faz o oposto: `ManejoPastoRepository.remove` (`src/repository/ManejoPastoRepository.js:128-133`) marca `ativo: false` — nunca chama `delete`. Confirmado por `test/manejoSoftDelete.test.js:22-35`. `CLAUDE.md` está desatualizado; a suíte de endpoint valida o comportamento real (soft-delete). Afeta MPAS-DELETE-ID-01.
- Itens duplicados (mesmo `insumoId` repetido no array `itens` do POST) não são deduplicados: cada ocorrência gera sua própria movimentação de saída. `insumosPorId` (`src/service/ManejoPastoService.js:82-105`) só evita reconsultar o mesmo insumo no banco, não valida nem funde itens repetidos.
- Aviso de saldo negativo (`data.avisos`, `src/service/ManejoPastoService.js:137-139`) nunca bloqueia a criação do manejo — é informativo.
