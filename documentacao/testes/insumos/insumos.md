# /insumos

Controller `InsumoController` · Service `InsumoService` · Repository `InsumoRepository` · Schemas
`InsumoCreateSchema`, `InsumoUpdateSchema`, `InsumoQuerySchema`, `InsumoIdSchema` · Regras:
`rotas_pastolivre.md` § 13, 13.1–13.5

Pré-condições comuns: usuário A e usuário B autenticados via BetterAuth, cada um com pelo menos uma
`propriedade` própria. A tem um `tipoInsumo` ativo disponível (catálogo global, sem escopo por usuário).

Saldo: a leitura de um insumo (`GET /insumos/:id` e cada item de `GET /insumos`) devolve o pacote
`saldo` calculado na hora a partir do ledger (`movimentacoesInsumo`) e dos `regimesConsumo`:
`saldoReal = Σ(Entrada) − Σ(Saida) + Σ(Ajuste com sinal)`, `consumoProjetado` (consumo dos regimes
ainda não lançado, contado desde a última `AjusteContagem` ou desde o início de cada regime),
`saldoProjetado = saldoReal − consumoProjetado`, `consumoDiaTotal` (soma de `quantidadeDia` dos
regimes vigentes hoje), `diasRestantes`, `previsaoTermino`, `esgotado` (`saldoProjetado <= 0`) e
`estoqueBaixo` (há `estoqueMinimo` e `saldoProjetado <= estoqueMinimo`). `GET /insumos/:id` calcula a
partir do ledger cru (`InsumoRepository` `INSUMO_SELECT`); `GET /insumos` agrega no banco via
`groupBy` (`anexarResumoLedger`, `InsumoRepository.js:81-113`) — o pacote resultante deve ser
matematicamente idêntico (`InsumoService.comSaldo`, `InsumoService.js:14-44`).

## POST /insumos

Arquivo: `test/endpoints/insumos/post-insumos.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| INS-POST-01 | cria com dados válidos | propriedadeId e tipoInsumoId de A | 201 | envelope `{message,data,errors}`; `data.id`; `data.propriedadeId`; `data.saldo.saldoReal` = 0; `data.saldo.saldoProjetado` = 0; `data.saldo.esgotado` = true (sem estoque) |
| INS-POST-02 | aceita `id` gerado pelo cliente (offline-first) | — | 201 | `data.id` igual ao UUID enviado |
| INS-POST-03 | aceita `estoqueMinimo` | — | 201 | `data.estoqueMinimo` = valor enviado |
| INS-POST-04 | `estoqueMinimo` negativo | — | 400 | validationError; path `estoqueMinimo` |
| INS-POST-05 | corpo vazio | — | 400 | mensagem "Forneça os dados do insumo." |
| INS-POST-06 | campo extra no corpo (`.strict()`) | — | 400 | validationError |
| INS-POST-07 | `propriedadeId` ausente | — | 400 | validationError; path `propriedadeId` |
| INS-POST-08 | `tipoInsumoId` ausente | — | 400 | validationError; path `tipoInsumoId` |
| INS-POST-09 | `nome` ausente ou com menos de 2 caracteres | — | 400 | validationError; path `nome` |
| INS-POST-10 | `nome` com mais de 120 caracteres | — | 400 | validationError; path `nome` |
| INS-POST-11 | `destino` fora de `Pasto`/`Rebanho`/`Ambos` | — | 400 | validationError; path `destino` |
| INS-POST-12 | `unidadeMedida` fora do enum | — | 400 | validationError; path `unidadeMedida` |
| INS-POST-13 | sem token | — | 401 | `tipo` = unauthorized; `recuperavel` = true |
| INS-POST-14 | `propriedadeId` de A, logado como B | B autenticado | 404 | mensagem "Propriedade não encontrada ou não pertence ao usuário autenticado."; multi-tenancy — B não cria insumo sob propriedade de A |
| INS-POST-15 | `propriedadeId` inexistente | UUID válido, sem registro | 404 | mesma mensagem de INS-POST-14 |
| INS-POST-16 | `tipoInsumoId` inexistente ou inativo (`ativo:false`) | — | 404 | mensagem "Tipo de insumo não encontrado."; path `tipoInsumoId` |
| INS-POST-17 | `nome` duplicado (case-insensitive) entre insumos **ativos** da mesma propriedade | insumo "Ração" já ativo em A | 409 | `tipo` = conflict; mensagem "Já existe um insumo com este nome nesta propriedade."; path `nome` |
| INS-POST-18 | `nome` igual ao de um insumo **inativo** (`ativo:false`) da mesma propriedade | insumo "Ração" inativo em A | 201 | cria normalmente — `findByNome` só considera `ativo:true` |
| INS-POST-19 | `nome` igual entre propriedades diferentes do mesmo usuário | duas propriedades de A | 201 | cria normalmente — unicidade é por propriedade, não global |

## GET /insumos

Arquivo: `test/endpoints/insumos/get-insumos.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| INS-GET-01 | lista paginada, cada item com `saldo` agregado do resumo do ledger | 2+ insumos de A, com movimentações | 200 | envelope; `data.docs[].saldo`; `data.docs[]` não tem `movimentacoes`, `regimesConsumo` nem `_resumoLedger` crus; `data.totalDocs`/`page`/`limit`/`totalPages`; ordenado por `nome` asc |
| INS-GET-02 | filtro `propriedadeId` | 2 propriedades de A | 200 | só insumos da propriedade filtrada |
| INS-GET-03 | filtro `tipoInsumoId` | — | 200 | só insumos do tipo filtrado |
| INS-GET-04 | filtro `destino` | — | 200 | só insumos com o destino filtrado |
| INS-GET-05 | filtro `nome` (contém, case-insensitive) | insumo "Ração Bovina" | 200 | encontra buscando `"ração"` |
| INS-GET-06 | filtro `ativo=false` | 1 insumo inativado | 200 | só os inativos |
| INS-GET-07 | filtro `atualizadoDesde` | 1 insumo inativado após a marca | 200 | inclui o inativo (leitura por diferença) |
| INS-GET-08 | `estoqueBaixo` = true | `estoqueMinimo` definido e `saldoProjetado <= estoqueMinimo` | 200 | `data.docs[].saldo.estoqueBaixo` = true |
| INS-GET-09 | `estoqueBaixo` = false quando `estoqueMinimo` é `null` | — | 200 | `data.docs[].saldo.estoqueBaixo` = false |
| INS-GET-10 | sem query | — | 200 | `page` = 1, `limit` = 10 (default) |
| INS-GET-11 | `limit` > 100 | — | 400 | validationError (Zod `max(100)`) |
| INS-GET-12 | campo extra na query (`.strict()`) | — | 400 | validationError |
| INS-GET-13 | sem token | — | 401 | `tipo` = unauthorized |
| INS-GET-14 | multi-tenancy: B lista insumos | insumos cadastrados por A | 200 | `data.docs` não contém nenhum insumo de A |
| INS-GET-15 | lista vazia | nenhum insumo cadastrado | 200 | mensagem "Nenhum insumo cadastrado."; `data.docs` = [] |

## GET /insumos/:id

Arquivo: `test/endpoints/insumos/get-insumos-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| INS-GET-ID-01 | detalha com saldo calculado do ledger cru | insumo de A com movimentações e regime ativo | 200 | mensagem "Insumo encontrado com sucesso."; `data.saldo.{saldoReal,consumoProjetado,saldoProjetado,consumoDiaTotal,diasRestantes,previsaoTermino,esgotado,estoqueBaixo}` todos presentes |
| INS-GET-ID-02 | saldo esgotado (`saldoProjetado <= 0`) | ledger baixo, regime consumindo | 200 | `data.saldo.esgotado` = true; `data.saldo.previsaoTermino` = null |
| INS-GET-ID-03 | insumo sem regimes de consumo | — | 200 | `data.saldo.saldoProjetado` = `saldoReal`; `consumoDiaTotal` = 0; `diasRestantes` = null |
| INS-GET-ID-04 | regime de consumo encerrado (`ativo:false`, `dataFim` passado) ainda soma no `consumoProjetado`, mas não no `consumoDiaTotal` | regime encerrado + regime aberto no mesmo insumo | 200 | `consumoProjetado` reflete os dias do regime encerrado; `consumoDiaTotal` conta só o regime aberto |
| INS-GET-ID-05 | `id` não é UUID | — | 400 | validationError |
| INS-GET-ID-06 | sem token | — | 401 | `tipo` = unauthorized |
| INS-GET-ID-07 | `id` inexistente | UUID válido, sem registro | 404 | mensagem "Recurso não encontrado em Insumo." |
| INS-GET-ID-08 | multi-tenancy: B lê `id` de um insumo de A | — | 404 | mesma mensagem de INS-GET-ID-07 |

## PATCH /insumos/:id

Arquivo: `test/endpoints/insumos/patch-insumos-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| INS-PATCH-ID-01 | atualiza `nome` | novo nome não usado na propriedade | 200 | `data.nome` atualizado |
| INS-PATCH-ID-02 | atualiza `destino`/`unidadeMedida`/`estoqueMinimo` | — | 200 | campos refletidos em `data` |
| INS-PATCH-ID-03 | `ativo:false` inativa (equivale a DELETE) | insumo ativo | 200 | `data.ativo` = false; banco: `ativo=false` |
| INS-PATCH-ID-04 | `ativo:true` reativa | insumo inativo, nome livre | 200 | `data.ativo` = true |
| INS-PATCH-ID-05 | reativar (`ativo:true`) quando o nome já foi reutilizado por outro insumo ativo | insumo X inativo "Ração"; insumo Y ativo "Ração" | 409 | `tipo` = conflict; path `nome` |
| INS-PATCH-ID-06 | troca `nome` para um já usado por outro insumo ativo da mesma propriedade | — | 409 | `tipo` = conflict; path `nome` |
| INS-PATCH-ID-07 | troca só a capitalização do próprio nome (`"Ração"` → `"ração"`) | — | 200 | não dispara conflito consigo mesmo (`nome.toLowerCase()` igual ao atual pula a checagem) |
| INS-PATCH-ID-08 | `tipoInsumoId` atualizado para um inexistente/inativo | — | 404 | mensagem "Tipo de insumo não encontrado."; path `tipoInsumoId` |
| INS-PATCH-ID-09 | corpo vazio | — | 400 | mensagem "Forneça pelo menos um campo para atualizar." |
| INS-PATCH-ID-10 | campo extra no corpo (`.strict()`) | — | 400 | validationError |
| INS-PATCH-ID-11 | `estoqueMinimo` negativo | — | 400 | validationError |
| INS-PATCH-ID-12 | `id` não é UUID | — | 400 | validationError |
| INS-PATCH-ID-13 | sem token | — | 401 | `tipo` = unauthorized |
| INS-PATCH-ID-14 | `id` inexistente | — | 404 | mensagem "Recurso não encontrado em Insumo." |
| INS-PATCH-ID-15 | multi-tenancy: B atualiza `id` de um insumo de A | — | 404 | mesma mensagem de INS-PATCH-ID-14 |

## DELETE /insumos/:id

Arquivo: `test/endpoints/insumos/delete-insumos-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| INS-DELETE-ID-01 | exclui (soft-delete) | insumo ativo de A, com movimentações | 200 | mensagem "Insumo excluído com sucesso."; banco: `ativo=false`; linhas de `movimentacaoInsumo` associadas permanecem intactas |
| INS-DELETE-ID-02 | `id` não é UUID | — | 400 | validationError |
| INS-DELETE-ID-03 | sem token | — | 401 | `tipo` = unauthorized |
| INS-DELETE-ID-04 | `id` inexistente | — | 404 | mensagem "Recurso não encontrado em Insumo." |
| INS-DELETE-ID-05 | multi-tenancy: B exclui `id` de um insumo de A | — | 404 | mesma mensagem de INS-DELETE-ID-04 |

## Divergências

- Não há `AdminMiddleware` nas rotas `/insumos*` (`src/routes/insumoRoutes.js:14-25`) — a categoria "403 admin" não se aplica a este arquivo.
- Nenhuma divergência relevante entre código e `rotas_pastolivre.md` §13–§13.5 foi encontrada: filtros de `GET /insumos` (linha 434), regras de unicidade de `nome` (linha 426) e de reativação (`InsumoService.js:90-94`) batem com o documentado.
