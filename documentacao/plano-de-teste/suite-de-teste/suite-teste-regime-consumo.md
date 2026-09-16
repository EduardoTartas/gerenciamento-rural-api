# Plano de Teste para Endpoints de Regime de Consumo

Consumo diário recorrente de um insumo por um rebanho (nunca escreve no ledger — só alimenta `saldoProjetado`/`previsaoTermino` na leitura do insumo). Fonte técnica: `documentacao/testes/rebanhos-regimes-consumo/rebanhos-regimes-consumo.md`. Suíte automatizada: `test/endpoints/rebanhos-regimes-consumo/`.

## POST /v1/rebanhos/regimes-consumo

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-01] cria regime válido (sem `dataFim`) | rebanho e insumo de A, insumo com `destino` `Rebanho` ou `Ambos`, mesma propriedade do rebanho | HTTP 201; envelope; `data.id`; `data.ativo` = true; `data.dataFim` = null; `data.insumo.{id,nome,unidadeMedida}`; `data.rebanho.{id,nomeRebanho}` |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-02] aceita `id` gerado pelo cliente (offline-first) | body com `id` UUID do cliente | HTTP 201; `data.id` igual ao UUID enviado |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-03] aceita `dataFim` informada (`dataInicio <= dataFim`) | body com `dataFim` válida | HTTP 201; `data.dataFim` = valor enviado |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-04] corpo vazio | body `{}` | HTTP 400; mensagem "Forneça os dados do regime de consumo." |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-05] campo extra no corpo (`.strict()`) | body com campo não previsto | HTTP 400; `validationError` |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-06] `rebanhoId` ausente | body sem `rebanhoId` | HTTP 400; `validationError`; path `rebanhoId` |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-07] `insumoId` ausente | body sem `insumoId` | HTTP 400; `validationError`; path `insumoId` |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-08] `quantidadeDia` ausente | body sem `quantidadeDia` | HTTP 400; `validationError`; path `quantidadeDia` |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-09] `dataInicio` ausente | body sem `dataInicio` | HTTP 400; `validationError`; path `dataInicio` |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-10] `quantidadeDia` <= 0 | body com `quantidadeDia` <= 0 | HTTP 400; mensagem "A quantidade diária deve ser maior que zero." |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-11] `dataInicio` depois de `dataFim` | body com `dataInicio` > `dataFim` | HTTP 400; mensagem "A data de início não pode ser depois da data de fim."; path `dataFim` |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-12] `rebanhoId` não é UUID | body com `rebanhoId` inválido | HTTP 400; `validationError` |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-13] `id` (cliente) não é UUID | body com `id` inválido | HTTP 400; `validationError` |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-14] sem token | sem header `Authorization` | HTTP 401; `tipo` = unauthorized |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-15] `rebanhoId` inexistente | `rebanhoId` = UUID válido sem registro | HTTP 404; mensagem "Rebanho não encontrado ou não pertence ao usuário autenticado." |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-16] `rebanhoId` de A, logado como B | B autenticado, `rebanhoId` de A | HTTP 404; mesma mensagem de REG-POST-15; multi-tenancy — B não cria regime sob rebanho de A |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-17] `insumoId` inexistente | `insumoId` = UUID válido sem registro | HTTP 404; mensagem "Insumo não encontrado ou não pertence ao usuário autenticado." |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-18] `insumoId` de A, logado como B (rebanho de B) | B autenticado, `insumoId` de A | HTTP 404; mesma mensagem de REG-POST-17; multi-tenancy |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-19] insumo de propriedade diferente da do rebanho | insumo e rebanho de A em propriedades distintas | HTTP 400; `tipo` = validationError; mensagem "Insumo e rebanho são de propriedades diferentes."; path `insumoId` |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-20] insumo com `destino` = `Pasto` (incompatível com rebanho) | `insumoId` com destino incompatível | HTTP 400; mensagem "Insumo não pode ser consumido pelo rebanho."; path `insumoId` |
| POST /v1/rebanhos/regimes-consumo | [REG-POST-21] par (`rebanhoId`, `insumoId`) já tem um regime em aberto | regime aberto existente do par | HTTP 201; cria o novo regime; banco: o regime anterior foi encerrado na mesma transação (`dataFim` = `dataInicio` do novo, `ativo=false`) |

## GET /v1/rebanhos/regimes-consumo

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/rebanhos/regimes-consumo | [REG-GET-01] lista paginada dos regimes do usuário | 2+ regimes de A | HTTP 200; envelope; `data.totalDocs`/`page`/`limit`/`totalPages`; ordenado por `dataInicio` desc |
| GET /v1/rebanhos/regimes-consumo | [REG-GET-02] filtro `rebanhoId` | 2 rebanhos de A; query `?rebanhoId=...` | HTTP 200; só regimes do rebanho filtrado |
| GET /v1/rebanhos/regimes-consumo | [REG-GET-03] filtro `insumoId` | query `?insumoId=...` | HTTP 200; só regimes do insumo filtrado |
| GET /v1/rebanhos/regimes-consumo | [REG-GET-04] filtro `emAberto=true` | 1 regime aberto, 1 encerrado; query `?emAberto=true` | HTTP 200; só os com `dataFim` nula |
| GET /v1/rebanhos/regimes-consumo | [REG-GET-05] filtro `ativo=false` | 1 regime encerrado; query `?ativo=false` | HTTP 200; só os inativos |
| GET /v1/rebanhos/regimes-consumo | [REG-GET-06] filtro `atualizadoDesde` | regime encerrado após a marca; query `?atualizadoDesde=...` | HTTP 200; inclui o inativo (leitura por diferença) |
| GET /v1/rebanhos/regimes-consumo | [REG-GET-07] sem query | sem parâmetros de query | HTTP 200; `page` = 1, `limit` = 10 (default) |
| GET /v1/rebanhos/regimes-consumo | [REG-GET-08] `limit` > 100 | query `?limit=101` | HTTP 400; `validationError` (Zod `max(100)`) |
| GET /v1/rebanhos/regimes-consumo | [REG-GET-09] `page` <= 0 | query `?page=0` | HTTP 400; `validationError` (Zod `positive()`) |
| GET /v1/rebanhos/regimes-consumo | [REG-GET-10] campo extra na query (`.strict()`) | query com campo não previsto | HTTP 400; `validationError` |
| GET /v1/rebanhos/regimes-consumo | [REG-GET-11] sem token | sem header `Authorization` | HTTP 401; `tipo` = unauthorized |
| GET /v1/rebanhos/regimes-consumo | [REG-GET-12] multi-tenancy: B lista regimes | regimes cadastrados por A, B autenticado | HTTP 200; `data.docs` não contém nenhum regime de rebanho de A |
| GET /v1/rebanhos/regimes-consumo | [REG-GET-13] sem `propriedadeId` disponível como filtro | A com 2 propriedades, regimes em ambas | HTTP 200; regimes de rebanhos de propriedades diferentes do mesmo usuário aparecem juntos na mesma listagem (ver Bugs conhecidos) |

## GET /v1/rebanhos/regimes-consumo/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/rebanhos/regimes-consumo/:id | [REG-GET-ID-01] encontra por id | regime de A, `:id` próprio | HTTP 200; mensagem "Regime de consumo encontrado com sucesso."; `data.insumo`/`data.rebanho` embutidos |
| GET /v1/rebanhos/regimes-consumo/:id | [REG-GET-ID-02] `id` não é UUID | `:id` = string não-UUID | HTTP 400; `validationError` |
| GET /v1/rebanhos/regimes-consumo/:id | [REG-GET-ID-03] sem token | sem header `Authorization` | HTTP 401; `tipo` = unauthorized |
| GET /v1/rebanhos/regimes-consumo/:id | [REG-GET-ID-04] `id` inexistente | `:id` = UUID válido sem registro | HTTP 404; mensagem "Recurso não encontrado em Regime de Consumo." |
| GET /v1/rebanhos/regimes-consumo/:id | [REG-GET-ID-05] multi-tenancy: B lê `id` de regime de A | B autenticado, `:id` de regime de A | HTTP 404; mesma mensagem de REG-GET-ID-04 |

## PATCH /v1/rebanhos/regimes-consumo/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| PATCH /v1/rebanhos/regimes-consumo/:id | [REG-PATCH-ID-01] atualiza `quantidadeDia` | regime ativo de A; body `{ quantidadeDia }` | HTTP 200; `data.quantidadeDia` atualizado |
| PATCH /v1/rebanhos/regimes-consumo/:id | [REG-PATCH-ID-02] define `dataFim` (encerra o regime) | body `{ dataFim }` | HTTP 200; `data.ativo` = false; banco: `ativo=false` |
| PATCH /v1/rebanhos/regimes-consumo/:id | [REG-PATCH-ID-03] reabre com `dataFim: null` | regime encerrado de A; outro regime do mesmo par (`rebanhoId`,`insumoId`) está aberto; body `{ dataFim: null }` | HTTP 200; `data.ativo` = true, `data.dataFim` = null; banco: o outro regime aberto do par foi encerrado na mesma transação |
| PATCH /v1/rebanhos/regimes-consumo/:id | [REG-PATCH-ID-04] corpo vazio | body `{}` | HTTP 400; mensagem "Forneça pelo menos um campo para atualizar." |
| PATCH /v1/rebanhos/regimes-consumo/:id | [REG-PATCH-ID-05] campo extra no corpo (`.strict()`) | body com campo não previsto | HTTP 400; `validationError` |
| PATCH /v1/rebanhos/regimes-consumo/:id | [REG-PATCH-ID-06] `quantidadeDia` <= 0 | body com `quantidadeDia` <= 0 | HTTP 400; mensagem "A quantidade diária deve ser maior que zero." |
| PATCH /v1/rebanhos/regimes-consumo/:id | [REG-PATCH-ID-07] `dataFim` inválida (não é data) | body com `dataFim` malformada | HTTP 400; `validationError` |
| PATCH /v1/rebanhos/regimes-consumo/:id | [REG-PATCH-ID-08] `id` não é UUID | `:id` = string não-UUID | HTTP 400; `validationError` |
| PATCH /v1/rebanhos/regimes-consumo/:id | [REG-PATCH-ID-09] sem token | sem header `Authorization` | HTTP 401; `tipo` = unauthorized |
| PATCH /v1/rebanhos/regimes-consumo/:id | [REG-PATCH-ID-10] `id` inexistente | `:id` = UUID válido sem registro | HTTP 404; mensagem "Recurso não encontrado em Regime de Consumo." |
| PATCH /v1/rebanhos/regimes-consumo/:id | [REG-PATCH-ID-11] multi-tenancy: B atualiza `id` de regime de A | B autenticado, `:id` de regime de A | HTTP 404; mesma mensagem de REG-PATCH-ID-10 |

## DELETE /v1/rebanhos/regimes-consumo/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| DELETE /v1/rebanhos/regimes-consumo/:id | [REG-DELETE-ID-01] encerra o regime (soft-delete lógico) | regime aberto de A, `dataInicio` no passado | HTTP 200; mensagem "Regime de consumo encerrado com sucesso."; banco: `ativo=false`, `dataFim` = momento da exclusão |
| DELETE /v1/rebanhos/regimes-consumo/:id | [REG-DELETE-ID-02] regime com `dataInicio` no futuro excluído hoje | `dataInicio` futura | HTTP 200; banco: `dataFim` = `dataInicio` (nunca antes do início do regime) |
| DELETE /v1/rebanhos/regimes-consumo/:id | [REG-DELETE-ID-03] `id` não é UUID | `:id` = string não-UUID | HTTP 400; `validationError` |
| DELETE /v1/rebanhos/regimes-consumo/:id | [REG-DELETE-ID-04] sem token | sem header `Authorization` | HTTP 401; `tipo` = unauthorized |
| DELETE /v1/rebanhos/regimes-consumo/:id | [REG-DELETE-ID-05] `id` inexistente | `:id` = UUID válido sem registro | HTTP 404; mensagem "Recurso não encontrado em Regime de Consumo." |
| DELETE /v1/rebanhos/regimes-consumo/:id | [REG-DELETE-ID-06] multi-tenancy: B exclui `id` de regime de A | B autenticado, `:id` de regime de A | HTTP 404; mesma mensagem de REG-DELETE-ID-05 |

## Bugs conhecidos

- **`GET /v1/rebanhos/regimes-consumo` sem filtro por `propriedadeId`** (`RegimeConsumoInsumoQuerySchema.js:6-16` e `src/repository/RegimeConsumoInsumoRepository.js:25-41`): diferente de `GET /insumos` e `GET /insumos/movimentacoes`, que aceitam `propriedadeId` como filtro direto, este endpoint só permite restringir por `rebanhoId` ou `insumoId` — um usuário com várias propriedades precisa conhecer o rebanho de antemão para segmentar por propriedade. `rotas_pastolivre.md:491-492` já documenta apenas `rebanhoId, insumoId, emAberto, ativo, atualizadoDesde, page, limit` como filtros — spec e código concordam entre si, mas ambos divergem do padrão dos outros dois endpoints da mesma feature. Rastreado na issue GitLab #40 ("GET /rebanhos/regimes-consumo sem filtro por propriedade"); nenhuma alteração de código foi feita — REG-GET-13 documenta o comportamento atual (sem o filtro).
- Não há `AdminMiddleware` nas rotas `/rebanhos/regimes-consumo*` — a categoria "403 admin" não se aplica a esta rota.
- Código morto: `RegimeConsumoInsumoService.list` (`src/service/RegimeConsumoInsumoService.js:29`) trunca `limit` com `Math.min(parseInt(limit, 10) || 10, 100)`, mas o `.max(100)` do `RegimeConsumoInsumoQuerySchema` já recusa `limit > 100` com 400 antes do service — a truncagem nunca roda. Mesmo padrão nas demais rotas.
