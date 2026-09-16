# Plano de Teste para Endpoints de Insumo

Rota de insumos de propriedade, com saldo calculado a partir do ledger de movimentações e dos
regimes de consumo. Fonte técnica: `documentacao/testes/insumos/insumos.md`. Suíte automatizada:
`test/endpoints/insumos/`.

## POST /v1/insumos

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/insumos | [INS-POST-01] cria com dados válidos | propriedadeId e tipoInsumoId de A | HTTP 201, envelope `{message,data,errors}`; `data.id`; `data.propriedadeId`; `data.saldo.saldoReal` = 0; `data.saldo.saldoProjetado` = 0; `data.saldo.esgotado` = true (sem estoque) |
| POST /v1/insumos | [INS-POST-02] aceita `id` gerado pelo cliente (offline-first) | body com `id` UUID definido pelo cliente | HTTP 201, `data.id` igual ao UUID enviado |
| POST /v1/insumos | [INS-POST-03] aceita `estoqueMinimo` | body com `estoqueMinimo` | HTTP 201, `data.estoqueMinimo` = valor enviado |
| POST /v1/insumos | [INS-POST-04] `estoqueMinimo` negativo | body com `estoqueMinimo` negativo | HTTP 400, `tipo` validationError; `errors[].path` = `estoqueMinimo` |
| POST /v1/insumos | [INS-POST-05] corpo vazio | body `{}` | HTTP 400, `message` = "Forneça os dados do insumo." |
| POST /v1/insumos | [INS-POST-06] campo extra no corpo (`.strict()`) | body com campo desconhecido | HTTP 400, `tipo` validationError |
| POST /v1/insumos | [INS-POST-07] `propriedadeId` ausente | body sem `propriedadeId` | HTTP 400, `tipo` validationError; `errors[].path` = `propriedadeId` |
| POST /v1/insumos | [INS-POST-08] `tipoInsumoId` ausente | body sem `tipoInsumoId` | HTTP 400, `tipo` validationError; `errors[].path` = `tipoInsumoId` |
| POST /v1/insumos | [INS-POST-09] `nome` ausente ou com menos de 2 caracteres | body sem `nome` ou `nome` curto | HTTP 400, `tipo` validationError; `errors[].path` = `nome` |
| POST /v1/insumos | [INS-POST-10] `nome` com mais de 120 caracteres | body com `nome` longo | HTTP 400, `tipo` validationError; `errors[].path` = `nome` |
| POST /v1/insumos | [INS-POST-11] `destino` fora de `Pasto`/`Rebanho`/`Ambos` | body com `destino` inválido | HTTP 400, `tipo` validationError; `errors[].path` = `destino` |
| POST /v1/insumos | [INS-POST-12] `unidadeMedida` fora do enum | body com `unidadeMedida` inválido | HTTP 400, `tipo` validationError; `errors[].path` = `unidadeMedida` |
| POST /v1/insumos | [INS-POST-13] sem token | sem header Authorization | HTTP 401, `tipo` = unauthorized; `recuperavel` = true |
| POST /v1/insumos | [INS-POST-14] `propriedadeId` de A, logado como B | B autenticado; body com propriedadeId de A | HTTP 404, `message` = "Propriedade não encontrada ou não pertence ao usuário autenticado."; multi-tenancy — B não cria insumo sob propriedade de A |
| POST /v1/insumos | [INS-POST-15] `propriedadeId` inexistente | UUID válido sem registro | HTTP 404, mesma mensagem de INS-POST-14 |
| POST /v1/insumos | [INS-POST-16] `tipoInsumoId` inexistente ou inativo (`ativo:false`) | body com tipoInsumoId inválido | HTTP 404, `message` = "Tipo de insumo não encontrado."; `errors[].path` = `tipoInsumoId` |
| POST /v1/insumos | [INS-POST-17] `nome` duplicado (case-insensitive) entre insumos ativos da mesma propriedade | insumo "Ração" já ativo em A | HTTP 409, `tipo` = conflict; `message` = "Já existe um insumo com este nome nesta propriedade."; `errors[].path` = `nome` |
| POST /v1/insumos | [INS-POST-18] `nome` igual ao de um insumo inativo (`ativo:false`) da mesma propriedade | insumo "Ração" inativo em A | HTTP 201, cria normalmente — `findByNome` só considera `ativo:true` |
| POST /v1/insumos | [INS-POST-19] `nome` igual entre propriedades diferentes do mesmo usuário | duas propriedades de A | HTTP 201, cria normalmente — unicidade é por propriedade, não global |

## GET /v1/insumos

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/insumos | [INS-GET-01] lista paginada, cada item com `saldo` agregado do resumo do ledger | 2+ insumos de A, com movimentações | HTTP 200, envelope; `data.docs[].saldo`; `data.docs[]` não tem `movimentacoes`, `regimesConsumo` nem `_resumoLedger` crus; `data.totalDocs`/`page`/`limit`/`totalPages`; ordenado por `nome` asc |
| GET /v1/insumos | [INS-GET-02] filtro `propriedadeId` | 2 propriedades de A | HTTP 200, só insumos da propriedade filtrada |
| GET /v1/insumos | [INS-GET-03] filtro `tipoInsumoId` | query `tipoInsumoId` | HTTP 200, só insumos do tipo filtrado |
| GET /v1/insumos | [INS-GET-04] filtro `destino` | query `destino` | HTTP 200, só insumos com o destino filtrado |
| GET /v1/insumos | [INS-GET-05] filtro `nome` (contém, case-insensitive) | insumo "Ração Bovina"; query `nome=ração` | HTTP 200, encontra buscando `"ração"` |
| GET /v1/insumos | [INS-GET-06] filtro `ativo=false` | 1 insumo inativado | HTTP 200, só os inativos |
| GET /v1/insumos | [INS-GET-07] filtro `atualizadoDesde` | 1 insumo inativado após a marca | HTTP 200, inclui o inativo (leitura por diferença) |
| GET /v1/insumos | [INS-GET-08] `estoqueBaixo` = true | `estoqueMinimo` definido e `saldoProjetado <= estoqueMinimo` | HTTP 200, `data.docs[].saldo.estoqueBaixo` = true |
| GET /v1/insumos | [INS-GET-09] `estoqueBaixo` = false quando `estoqueMinimo` é `null` | insumo sem `estoqueMinimo` | HTTP 200, `data.docs[].saldo.estoqueBaixo` = false |
| GET /v1/insumos | [INS-GET-10] sem query | sem parâmetros | HTTP 200, `page` = 1, `limit` = 10 (default) |
| GET /v1/insumos | [INS-GET-11] `limit` > 100 | query `limit=101` | HTTP 400, validationError (Zod `max(100)`) |
| GET /v1/insumos | [INS-GET-12] campo extra na query (`.strict()`) | query com campo desconhecido | HTTP 400, validationError |
| GET /v1/insumos | [INS-GET-13] sem token | sem header Authorization | HTTP 401, `tipo` = unauthorized |
| GET /v1/insumos | [INS-GET-14] multi-tenancy: B lista insumos | insumos cadastrados por A; logado como B | HTTP 200, `data.docs` não contém nenhum insumo de A |
| GET /v1/insumos | [INS-GET-15] lista vazia | nenhum insumo cadastrado | HTTP 200, `message` = "Nenhum insumo cadastrado."; `data.docs` = [] |

## GET /v1/insumos/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/insumos/:id | [INS-GET-ID-01] detalha com saldo calculado do ledger cru | insumo de A com movimentações e regime ativo | HTTP 200, `message` = "Insumo encontrado com sucesso."; `data.saldo.{saldoReal,consumoProjetado,saldoProjetado,consumoDiaTotal,diasRestantes,previsaoTermino,esgotado,estoqueBaixo}` todos presentes |
| GET /v1/insumos/:id | [INS-GET-ID-02] saldo esgotado (`saldoProjetado <= 0`) | ledger baixo, regime consumindo | HTTP 200, `data.saldo.esgotado` = true; `data.saldo.previsaoTermino` = null |
| GET /v1/insumos/:id | [INS-GET-ID-03] insumo sem regimes de consumo | insumo sem regimesConsumo | HTTP 200, `data.saldo.saldoProjetado` = `saldoReal`; `consumoDiaTotal` = 0; `diasRestantes` = null |
| GET /v1/insumos/:id | [INS-GET-ID-04] regime de consumo encerrado (`ativo:false`, `dataFim` passado) ainda soma no `consumoProjetado`, mas não no `consumoDiaTotal` | regime encerrado + regime aberto no mesmo insumo | HTTP 200, `consumoProjetado` reflete os dias do regime encerrado; `consumoDiaTotal` conta só o regime aberto |
| GET /v1/insumos/:id | [INS-GET-ID-05] `id` não é UUID | `/insumos/abc` | HTTP 400, validationError |
| GET /v1/insumos/:id | [INS-GET-ID-06] sem token | sem header Authorization | HTTP 401, `tipo` = unauthorized |
| GET /v1/insumos/:id | [INS-GET-ID-07] `id` inexistente | UUID válido, sem registro | HTTP 404, `message` = "Recurso não encontrado em Insumo." |
| GET /v1/insumos/:id | [INS-GET-ID-08] multi-tenancy: B lê `id` de um insumo de A | logado como B | HTTP 404, mesma mensagem de INS-GET-ID-07 |

## PATCH /v1/insumos/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| PATCH /v1/insumos/:id | [INS-PATCH-ID-01] atualiza `nome` | novo nome não usado na propriedade | HTTP 200, `data.nome` atualizado |
| PATCH /v1/insumos/:id | [INS-PATCH-ID-02] atualiza `destino`/`unidadeMedida`/`estoqueMinimo` | body com esses campos | HTTP 200, campos refletidos em `data` |
| PATCH /v1/insumos/:id | [INS-PATCH-ID-03] `ativo:false` inativa (equivale a DELETE) | insumo ativo; body `{ativo:false}` | HTTP 200, `data.ativo` = false; banco: `ativo=false` |
| PATCH /v1/insumos/:id | [INS-PATCH-ID-04] `ativo:true` reativa | insumo inativo, nome livre; body `{ativo:true}` | HTTP 200, `data.ativo` = true |
| PATCH /v1/insumos/:id | [INS-PATCH-ID-05] reativar (`ativo:true`) quando o nome já foi reutilizado por outro insumo ativo | insumo X inativo "Ração"; insumo Y ativo "Ração" | HTTP 409, `tipo` = conflict; `errors[].path` = `nome` |
| PATCH /v1/insumos/:id | [INS-PATCH-ID-06] troca `nome` para um já usado por outro insumo ativo da mesma propriedade | body com nome duplicado | HTTP 409, `tipo` = conflict; `errors[].path` = `nome` |
| PATCH /v1/insumos/:id | [INS-PATCH-ID-07] troca só a capitalização do próprio nome (`"Ração"` → `"ração"`) | body com nome do próprio insumo em outra capitalização | HTTP 200, não dispara conflito consigo mesmo (`nome.toLowerCase()` igual ao atual pula a checagem) |
| PATCH /v1/insumos/:id | [INS-PATCH-ID-08] `tipoInsumoId` atualizado para um inexistente/inativo | body com tipoInsumoId inválido | HTTP 404, `message` = "Tipo de insumo não encontrado."; `errors[].path` = `tipoInsumoId` |
| PATCH /v1/insumos/:id | [INS-PATCH-ID-09] corpo vazio | body `{}` | HTTP 400, `message` = "Forneça pelo menos um campo para atualizar." |
| PATCH /v1/insumos/:id | [INS-PATCH-ID-10] campo extra no corpo (`.strict()`) | body com campo desconhecido | HTTP 400, validationError |
| PATCH /v1/insumos/:id | [INS-PATCH-ID-11] `estoqueMinimo` negativo | body com `estoqueMinimo` negativo | HTTP 400, validationError |
| PATCH /v1/insumos/:id | [INS-PATCH-ID-12] `id` não é UUID | `/insumos/abc` | HTTP 400, validationError |
| PATCH /v1/insumos/:id | [INS-PATCH-ID-13] sem token | sem header Authorization | HTTP 401, `tipo` = unauthorized |
| PATCH /v1/insumos/:id | [INS-PATCH-ID-14] `id` inexistente | UUID válido, sem registro | HTTP 404, `message` = "Recurso não encontrado em Insumo." |
| PATCH /v1/insumos/:id | [INS-PATCH-ID-15] multi-tenancy: B atualiza `id` de um insumo de A | logado como B | HTTP 404, mesma mensagem de INS-PATCH-ID-14 |

## DELETE /v1/insumos/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| DELETE /v1/insumos/:id | [INS-DELETE-ID-01] exclui (soft-delete) | insumo ativo de A, com movimentações | HTTP 200, `message` = "Insumo excluído com sucesso."; banco: `ativo=false`; linhas de `movimentacaoInsumo` associadas permanecem intactas |
| DELETE /v1/insumos/:id | [INS-DELETE-ID-02] `id` não é UUID | `/insumos/abc` | HTTP 400, validationError |
| DELETE /v1/insumos/:id | [INS-DELETE-ID-03] sem token | sem header Authorization | HTTP 401, `tipo` = unauthorized |
| DELETE /v1/insumos/:id | [INS-DELETE-ID-04] `id` inexistente | UUID válido, sem registro | HTTP 404, `message` = "Recurso não encontrado em Insumo." |
| DELETE /v1/insumos/:id | [INS-DELETE-ID-05] multi-tenancy: B exclui `id` de um insumo de A | logado como B | HTTP 404, mesma mensagem de INS-DELETE-ID-04 |

## Bugs conhecidos

- Não há `AdminMiddleware` nas rotas `/insumos*` — a categoria "403 admin" não se aplica a este arquivo (não é bug, é confirmação de escopo).
- Nenhuma divergência relevante entre código e `rotas_pastolivre.md` §13–§13.5 foi encontrada: filtros de `GET /insumos`, regras de unicidade de `nome` e de reativação batem com o documentado.
