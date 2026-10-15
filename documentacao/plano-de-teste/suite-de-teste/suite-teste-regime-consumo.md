# /rebanhos/regimes-consumo

Controller `RegimeConsumoInsumoController` · Service `RegimeConsumoInsumoService` · Repository
`RegimeConsumoInsumoRepository` · Schemas `RegimeConsumoInsumoCreateSchema`,
`RegimeConsumoInsumoUpdateSchema`, `RegimeConsumoInsumoQuerySchema`, `RegimeConsumoInsumoIdSchema` ·
Regras: `rotas_pastolivre.md` § 13.10–13.14

Pré-condições comuns: usuário A e usuário B autenticados via BetterAuth, cada um com uma propriedade,
um rebanho e um insumo próprios. Um regime de consumo é o consumo diário recorrente (`quantidadeDia`)
de um insumo por um rebanho — **nunca escreve no ledger**, só alimenta `saldoProjetado` e
`previsaoTermino` na leitura do insumo (ver `suite-teste-insumo.md`).

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
| REG-GET-13 | sem `propriedadeId`, regimes de propriedades diferentes do mesmo usuário aparecem juntos | A com 2 propriedades, regimes em ambas | 200 | `data.docs` contém os regimes das duas propriedades |
| REG-GET-14 | filtro `propriedadeId` | A com 2 propriedades, regimes em ambas | 200 | `data.docs` só traz os regimes de rebanhos da propriedade filtrada |
| REG-GET-15 | `propriedadeId` de outro usuário | propriedade de B | 200 | `data.docs` vazio — nunca dado de outro tenant |

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

## Lançamento automático do consumo diário (issue #72)

Arquivo: `test/endpoints/rebanhos-regimes-consumo/lancamento-automatico.test.js`

Pré-condição comum: A com propriedade, pasto, rebanho e insumo (`destino` `Ambos`) com entrada de 100 há 30 dias; NPaaS simulado. A verificação é disparada por `POST /v1/notificacoes/verificar`.

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| CONSAUTO-01 | regime aceita `lancamentoAutomatico` no cadastro e na edição; sem o campo é manual | — | 201 / 200 / 400 | POST sem o campo → `lancamentoAutomatico` = false; PATCH `true` → true; valor não booleano → 400 |
| CONSAUTO-02 | lança uma saída de consumo do rebanho a cada 24 h desde o início | regime automático de 5/dia iniciado há 3,5 dias | 200 | `data.lancamentos` = 3; três saídas `ConsumoRebanho` de 5 com `rebanhoId`, `regimeConsumoId` e `data` = início + k × 24 h; insumo com `saldoReal` 85 e `consumoProjetado` 0 |
| CONSAUTO-03 | rodar de novo não duplica nenhum dia | regime automático há 2,5 dias | 200 | segunda verificação: `lancamentos` = 0; continuam 2 saídas |
| CONSAUTO-04 | continua do último consumo lançado daquele rebanho | saída `ConsumoRebanho` do rebanho há 1,5 dia; regime automático há 10 dias | 200 | 1 saída automática, não as dos 10 dias |
| CONSAUTO-05 | nunca lança mais do que o estoque | regime automático de 40/dia há 5,5 dias, estoque 100 | 200 | saídas 40, 40 e 20; `saldoReal` 0 |
| CONSAUTO-06 | regime manual e regime de outro produtor não são lançados | regime manual de A; regime automático de B | 200 | nenhuma saída nos dois |
| CONSAUTO-07 | respeita o fim do regime | regime automático encerrado: início há 6,5 dias, fim há 4 | 200 | 2 saídas |
| CONSAUTO-08 | consumo lançado de um lote não apaga a estimativa do consumo manual de outro | lote 1 automático (5/dia), lote 2 manual (2/dia), ambos há 4,5 dias | 200 | `GET /insumos/:id` e `GET /insumos`: `saldoReal` 80 e `consumoProjetado` 8 (marco por rebanho) |
| CONSAUTO-09 | `/sync` cria regime automático e a saída lançada traz o regime | `regimes_consumo_insumo:CREATE` com `lancamentoAutomatico: true` | 200 | mutação aceita; `GET /insumos/movimentacoes` devolve a saída com `regimeConsumoId` |
| CONSAUTO-10 | dia sem estoque não é lançado, e a compra de hoje não cobre os dias que passaram | regime automático de 40/dia há 5,5 dias, estoque 100; depois entrada de 100 agora | 200 | só 40, 40 e 20; segunda verificação: `lancamentos` = 0; `saldoReal` 100, `consumoProjetado` 0 |
| CONSAUTO-11 | compra registrada depois, com a data em que chegou, cobre os dias desde ela | como o 10, com a entrada de 100 datada de 2 dias atrás | 200 | saídas 40, 40, 20, 40 e 40; `saldoReal` 20 |
| CONSAUTO-12 | não lança o que deixaria o estoque negativo por uma saída registrada depois do dia | perda de 90 há 0,2 dia; regime automático de 20/dia há 3,5 dias | 200 | uma saída de 10; `saldoReal` 0 |
| CONSAUTO-13 | com dois lotes, o estoque vai para os dias em ordem de data | estoque 50; lote 1 20/dia há 3,5 dias, lote 2 20/dia há 3,2 dias | 200 | lote 1: 20 e 10; lote 2: 20; `saldoReal` 0 |

## Divergências

- Não há `AdminMiddleware` nas rotas `/rebanhos/regimes-consumo*` — a categoria "403 admin" não se aplica a este arquivo.
