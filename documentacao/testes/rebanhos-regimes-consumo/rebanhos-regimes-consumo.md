# /rebanhos/regimes-consumo

Controller `RegimeConsumoInsumoController` · Service `RegimeConsumoInsumoService` · Repository
`RegimeConsumoInsumoRepository` · Schemas `RegimeConsumoInsumoCreateSchema`,
`RegimeConsumoInsumoUpdateSchema`, `RegimeConsumoInsumoQuerySchema`, `RegimeConsumoInsumoIdSchema` ·
Regras: `rotas_pastolivre.md` § 13.10–13.14

Pré-condições comuns: usuário A e usuário B autenticados via BetterAuth, cada um com uma propriedade,
um rebanho e um insumo próprios. Um regime de consumo é o consumo diário recorrente (`quantidadeDia`)
de um insumo por um rebanho — **nunca escreve no ledger**, só alimenta `saldoProjetado` e
`previsaoTermino` na leitura do insumo (ver `documentacao/testes/insumos.md`).

## POST /rebanhos/regimes-consumo

Arquivo: `test/endpoints/rebanhos-regimes-consumo/post-rebanhos-regimes-consumo.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| REG-POST-01 | cria regime válido (sem `dataFim`) | rebanho e insumo de A, insumo com `destino` `Rebanho` ou `Ambos`, mesma propriedade do rebanho | 201 | envelope; `data.id`; `data.ativo` = true; `data.dataFim` = null; `data.insumo.{id,nome,unidadeMedida}`; `data.rebanho.{id,nomeRebanho}` |
| REG-POST-02 | aceita `id` gerado pelo cliente (offline-first) | — | 201 | `data.id` igual ao UUID enviado |
| REG-POST-03 | aceita `dataFim` informada (`dataInicio <= dataFim`) | — | 201 | `data.dataFim` = valor enviado |
| REG-POST-04 | corpo vazio | — | 400 | mensagem "Forneça os dados do regime de consumo." |
| REG-POST-05 | campo extra no corpo (`.strict()`) | — | 400 | validationError |
| REG-POST-06 | `rebanhoId` ausente | — | 400 | validationError; path `rebanhoId` |
| REG-POST-07 | `insumoId` ausente | — | 400 | validationError; path `insumoId` |
| REG-POST-08 | `quantidadeDia` ausente | — | 400 | validationError; path `quantidadeDia` |
| REG-POST-09 | `dataInicio` ausente | — | 400 | validationError; path `dataInicio` |
| REG-POST-10 | `quantidadeDia` <= 0 | — | 400 | mensagem "A quantidade diária deve ser maior que zero." |
| REG-POST-11 | `dataInicio` depois de `dataFim` | — | 400 | mensagem "A data de início não pode ser depois da data de fim."; path `dataFim` |
| REG-POST-12 | `rebanhoId` não é UUID | — | 400 | validationError |
| REG-POST-13 | `id` (cliente) não é UUID | — | 400 | validationError |
| REG-POST-14 | sem token | — | 401 | `tipo` = unauthorized |
| REG-POST-15 | `rebanhoId` inexistente | UUID válido, sem registro | 404 | mensagem "Rebanho não encontrado ou não pertence ao usuário autenticado." |
| REG-POST-16 | `rebanhoId` de A, logado como B | B autenticado | 404 | mesma mensagem de REG-POST-15; multi-tenancy — B não cria regime sob rebanho de A |
| REG-POST-17 | `insumoId` inexistente | — | 404 | mensagem "Insumo não encontrado ou não pertence ao usuário autenticado." |
| REG-POST-18 | `insumoId` de A, logado como B (rebanho de B) | — | 404 | mesma mensagem de REG-POST-17; multi-tenancy |
| REG-POST-19 | insumo de propriedade diferente da do rebanho | insumo e rebanho de A em propriedades distintas | 400 | `tipo` = validationError; mensagem "Insumo e rebanho são de propriedades diferentes."; path `insumoId` |
| REG-POST-20 | insumo com `destino` = `Pasto` (incompatível com rebanho) | — | 400 | mensagem "Insumo não pode ser consumido pelo rebanho."; path `insumoId` |
| REG-POST-21 | par (`rebanhoId`, `insumoId`) já tem um regime em aberto | regime aberto existente do par | 201 | cria o novo regime; banco: o regime anterior foi encerrado na mesma transação (`dataFim` = `dataInicio` do novo, `ativo=false`) |

## GET /rebanhos/regimes-consumo

Arquivo: `test/endpoints/rebanhos-regimes-consumo/get-rebanhos-regimes-consumo.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| REG-GET-01 | lista paginada dos regimes do usuário | 2+ regimes de A | 200 | envelope; `data.totalDocs`/`page`/`limit`/`totalPages`; ordenado por `dataInicio` desc |
| REG-GET-02 | filtro `rebanhoId` | 2 rebanhos de A | 200 | só regimes do rebanho filtrado |
| REG-GET-03 | filtro `insumoId` | — | 200 | só regimes do insumo filtrado |
| REG-GET-04 | filtro `emAberto=true` | 1 regime aberto, 1 encerrado | 200 | só os com `dataFim` nula |
| REG-GET-05 | filtro `ativo=false` | 1 regime encerrado | 200 | só os inativos |
| REG-GET-06 | filtro `atualizadoDesde` | regime encerrado após a marca | 200 | inclui o inativo (leitura por diferença) |
| REG-GET-07 | sem query | — | 200 | `page` = 1, `limit` = 10 (default) |
| REG-GET-08 | `limit` > 100 | — | 400 | validationError (Zod `max(100)`) |
| REG-GET-09 | `page` <= 0 | — | 400 | validationError (Zod `positive()`) |
| REG-GET-10 | campo extra na query (`.strict()`) | — | 400 | validationError |
| REG-GET-11 | sem token | — | 401 | `tipo` = unauthorized |
| REG-GET-12 | multi-tenancy: B lista regimes | regimes cadastrados por A | 200 | `data.docs` não contém nenhum regime de rebanho de A |
| REG-GET-13 | sem `propriedadeId` disponível como filtro | A com 2 propriedades, regimes em ambas | 200 | regimes de rebanhos de propriedades diferentes do mesmo usuário aparecem juntos na mesma listagem — ver Divergências |

## GET /rebanhos/regimes-consumo/:id

Arquivo: `test/endpoints/rebanhos-regimes-consumo/get-rebanhos-regimes-consumo-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| REG-GET-ID-01 | encontra por id | regime de A | 200 | mensagem "Regime de consumo encontrado com sucesso."; `data.insumo`/`data.rebanho` embutidos |
| REG-GET-ID-02 | `id` não é UUID | — | 400 | validationError |
| REG-GET-ID-03 | sem token | — | 401 | `tipo` = unauthorized |
| REG-GET-ID-04 | `id` inexistente | — | 404 | mensagem "Recurso não encontrado em Regime de Consumo." |
| REG-GET-ID-05 | multi-tenancy: B lê `id` de regime de A | — | 404 | mesma mensagem de REG-GET-ID-04 |

## PATCH /rebanhos/regimes-consumo/:id

Arquivo: `test/endpoints/rebanhos-regimes-consumo/patch-rebanhos-regimes-consumo-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| REG-PATCH-ID-01 | atualiza `quantidadeDia` | regime ativo de A | 200 | `data.quantidadeDia` atualizado |
| REG-PATCH-ID-02 | define `dataFim` (encerra o regime) | — | 200 | `data.ativo` = false; banco: `ativo=false` |
| REG-PATCH-ID-03 | reabre com `dataFim: null` | regime encerrado de A; outro regime do mesmo par (`rebanhoId`,`insumoId`) está aberto | 200 | `data.ativo` = true, `data.dataFim` = null; banco: o outro regime aberto do par foi encerrado na mesma transação |
| REG-PATCH-ID-04 | corpo vazio | — | 400 | mensagem "Forneça pelo menos um campo para atualizar." |
| REG-PATCH-ID-05 | campo extra no corpo (`.strict()`) | — | 400 | validationError |
| REG-PATCH-ID-06 | `quantidadeDia` <= 0 | — | 400 | mensagem "A quantidade diária deve ser maior que zero." |
| REG-PATCH-ID-07 | `dataFim` inválida (não é data) | — | 400 | validationError |
| REG-PATCH-ID-08 | `id` não é UUID | — | 400 | validationError |
| REG-PATCH-ID-09 | sem token | — | 401 | `tipo` = unauthorized |
| REG-PATCH-ID-10 | `id` inexistente | — | 404 | mensagem "Recurso não encontrado em Regime de Consumo." |
| REG-PATCH-ID-11 | multi-tenancy: B atualiza `id` de regime de A | — | 404 | mesma mensagem de REG-PATCH-ID-10 |

## DELETE /rebanhos/regimes-consumo/:id

Arquivo: `test/endpoints/rebanhos-regimes-consumo/delete-rebanhos-regimes-consumo-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| REG-DELETE-ID-01 | encerra o regime (soft-delete lógico) | regime aberto de A, `dataInicio` no passado | 200 | mensagem "Regime de consumo encerrado com sucesso."; banco: `ativo=false`, `dataFim` = momento da exclusão |
| REG-DELETE-ID-02 | regime com `dataInicio` no futuro excluído hoje | `dataInicio` futura | 200 | banco: `dataFim` = `dataInicio` (nunca antes do início do regime) |
| REG-DELETE-ID-03 | `id` não é UUID | — | 400 | validationError |
| REG-DELETE-ID-04 | sem token | — | 401 | `tipo` = unauthorized |
| REG-DELETE-ID-05 | `id` inexistente | — | 404 | mensagem "Recurso não encontrado em Regime de Consumo." |
| REG-DELETE-ID-06 | multi-tenancy: B exclui `id` de regime de A | — | 404 | mesma mensagem de REG-DELETE-ID-05 |

## Divergências

- **`GET /rebanhos/regimes-consumo` sem filtro por `propriedadeId`** (`src/utils/validators/schemas/zod/querys/RegimeConsumoInsumoQuerySchema.js:6-16` e `src/repository/RegimeConsumoInsumoRepository.js:25-41`): diferente de `GET /insumos` e `GET /insumos/movimentacoes`, que aceitam `propriedadeId` como filtro direto, este endpoint só permite restringir por `rebanhoId` ou `insumoId` — um usuário com várias propriedades precisa conhecer o rebanho de antemão para segmentar por propriedade. `rotas_pastolivre.md:491-492` já documenta apenas `rebanhoId, insumoId, emAberto, ativo, atualizadoDesde, page, limit` como filtros — a spec e o código já concordam nesse ponto, mas ambos divergem do padrão dos outros dois endpoints da mesma feature. Rastreado na issue GitLab #40 ("GET /rebanhos/regimes-consumo sem filtro por propriedade"); nenhuma alteração de código foi feita aqui — o cenário REG-GET-13 documenta o comportamento atual (sem o filtro).
- Não há `AdminMiddleware` nas rotas `/rebanhos/regimes-consumo*` — a categoria "403 admin" não se aplica a este arquivo.
- Observação (código morto): `RegimeConsumoInsumoService.list` (`src/service/RegimeConsumoInsumoService.js:29`) trunca o `limit` com `Math.min(parseInt(limit, 10) || 10, 100)`, mas o `.max(100)` do `RegimeConsumoInsumoQuerySchema` já recusa `limit > 100` com 400 antes do service — a truncagem nunca roda. Mesmo padrão nas demais rotas.
