# Plano de Teste para Endpoints de Manejo de Rebanho

Registro de atividades de manejo aplicadas a um rebanho, opcionalmente com itens de consumo de insumo e pesagem. Fonte técnica: `documentacao/testes/rebanhos-manejos/rebanhos-manejos.md`. Suíte automatizada: `test/endpoints/rebanhos-manejos/`.

## POST /v1/rebanhos/manejos

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/rebanhos/manejos | [MREB-POST-01] cria manejo sem itens | rebanho e tipo de manejo válidos; body sem `itens` | HTTP 201; envelope; `data.id`; `data.itens: []` |
| POST /v1/rebanhos/manejos | [MREB-POST-02] aceita `id` gerado pelo cliente (offline-first) | body com `id` UUID do cliente | HTTP 201; `data.id` igual ao enviado |
| POST /v1/rebanhos/manejos | [MREB-POST-03] corpo vazio | body `{}` | HTTP 400; `errors[0].path: body` |
| POST /v1/rebanhos/manejos | [MREB-POST-04] campo extra no corpo (`.strict()`) | body com campo não previsto | HTTP 400; `tipo: validationError` |
| POST /v1/rebanhos/manejos | [MREB-POST-05] falta `rebanhoId` | body sem `rebanhoId` | HTTP 400; validação Zod |
| POST /v1/rebanhos/manejos | [MREB-POST-06] falta `tipoManejoId` | body sem `tipoManejoId` | HTTP 400; validação Zod |
| POST /v1/rebanhos/manejos | [MREB-POST-07] falta `dataAtividade` | body sem `dataAtividade` | HTTP 400; validação Zod |
| POST /v1/rebanhos/manejos | [MREB-POST-08] `dataAtividade` no futuro | body com `dataAtividade` futura | HTTP 400; mensagem "não pode ser no futuro" |
| POST /v1/rebanhos/manejos | [MREB-POST-09] `pesoRegistrado` zero ou negativo | body com `pesoRegistrado` <= 0 | HTTP 400; validação Zod |
| POST /v1/rebanhos/manejos | [MREB-POST-10] item com campo extra (`.strict()` do item) | `itens[0]` com campo não previsto | HTTP 400; validação Zod |
| POST /v1/rebanhos/manejos | [MREB-POST-11] mais de 50 itens | body com 51 itens | HTTP 400; mensagem "No máximo 50 itens" |
| POST /v1/rebanhos/manejos | [MREB-POST-12] sem token | sem header `Authorization` | HTTP 401; `tipo: unauthorized` |
| POST /v1/rebanhos/manejos | [MREB-POST-13] admin (não dono) cria manejo em rebanho de A | token admin, `rebanhoId` de A | HTTP 404; `tipo: resourceNotFound`; sem bypass |
| POST /v1/rebanhos/manejos | [MREB-POST-14] B tenta criar manejo com `rebanhoId` de A | B autenticado, `rebanhoId` de A | HTTP 404; `tipo: resourceNotFound` |
| POST /v1/rebanhos/manejos | [MREB-POST-15] `rebanhoId` inexistente | `rebanhoId` = UUID válido sem registro | HTTP 404; `tipo: resourceNotFound` |
| POST /v1/rebanhos/manejos | [MREB-POST-16] rebanho inativo | rebanho de A com `ativo:false` | HTTP 400; `errors[0].path: rebanhoId`, mensagem "rebanho inativo" |
| POST /v1/rebanhos/manejos | [MREB-POST-17] `tipoManejoId` inexistente ou inativo | body com `tipoManejoId` inválido | HTTP 404; `tipo: resourceNotFound`; `errors[0].path: tipoManejoId` |
| POST /v1/rebanhos/manejos | [MREB-POST-18] item com `insumoId` inexistente/de outra propriedade | `itens[0].insumoId` inválido | HTTP 400; `errors[0].path: itens` |
| POST /v1/rebanhos/manejos | [MREB-POST-19] item com insumo de `destino: "Pasto"` (incompatível com rebanho) | `itens[0].insumoId` incompatível | HTTP 400; `errors[0].path: itens`, mensagem "não é destinado ao rebanho" |
| POST /v1/rebanhos/manejos | [MREB-POST-20] item válido cria movimentação de insumo `Saida` | `insumoA` com destino `Rebanho`/`Ambos` | HTTP 201; `data.itens[0]` reflete a movimentação; no banco, `MovimentacaoInsumo.manejoRebanhoId` = id do manejo, `tipo: Saida`, `origem: ManejoRebanho` |
| POST /v1/rebanhos/manejos | [MREB-POST-21] item preserva `id` enviado pelo cliente (offline-first) | `itens[0].id` UUID do cliente | HTTP 201; movimentação de insumo criada com esse `id` |
| POST /v1/rebanhos/manejos | [MREB-POST-22] item sem `id` | `itens[0]` sem `id` | HTTP 201; movimentação de insumo criada com `id` gerado pelo banco |
| POST /v1/rebanhos/manejos | [MREB-POST-23] saída deixaria o saldo do insumo negativo | saldo atual menor que a quantidade retirada | HTTP 201; não bloqueia; `data.avisos` contém aviso de estoque insuficiente; movimentação é criada mesmo assim |
| POST /v1/rebanhos/manejos | [MREB-POST-24] `pesoRegistrado` informado, é a pesagem mais recente do rebanho | nenhuma pesagem posterior já registrada | HTTP 201; `GET /rebanhos/:id` do rebanho mostra `pesoMedioAtual` atualizado |
| POST /v1/rebanhos/manejos | [MREB-POST-25] `pesoRegistrado` informado, mas já existe pesagem mais recente (`dataAtividade` maior) | pesagem existente com data futura em relação à nova | HTTP 201; manejo é criado, mas `rebanho.pesoMedioAtual` não muda — limitação conhecida (ver Divergências) |
| POST /v1/rebanhos/manejos | [MREB-POST-26] item inválido no meio da criação | 1º item válido, 2º com insumo incompatível | HTTP 400; nenhum manejo é persistido (nada visível em `GET /rebanhos/manejos`) — validação roda toda antes de abrir a transação |

## GET /v1/rebanhos/manejos

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/rebanhos/manejos | [MREB-GET-01] lista manejos ativos de A | 2+ manejos ativos | HTTP 200; `data.docs` só manejos de A |
| GET /v1/rebanhos/manejos | [MREB-GET-02] usuário sem manejos | usuário A autenticado, sem manejos | HTTP 200; `message`: "Nenhum manejo de rebanho cadastrado." |
| GET /v1/rebanhos/manejos | [MREB-GET-03] filtro sem resultado | query sem correspondência | HTTP 200; `message`: "Nenhum manejo encontrado com os filtros informados." |
| GET /v1/rebanhos/manejos | [MREB-GET-04] filtro `rebanhoId` | query `?rebanhoId=...` | HTTP 200; só manejos daquele rebanho |
| GET /v1/rebanhos/manejos | [MREB-GET-05] filtro `tipoManejoId` | query `?tipoManejoId=...` | HTTP 200; só manejos daquele tipo |
| GET /v1/rebanhos/manejos | [MREB-GET-06] filtro `propriedadeId` | query `?propriedadeId=...` | HTTP 200; só manejos de rebanhos daquela propriedade |
| GET /v1/rebanhos/manejos | [MREB-GET-07] filtro `dataInicio`/`dataFim` | query com intervalo | HTTP 200; só manejos no intervalo |
| GET /v1/rebanhos/manejos | [MREB-GET-08] `ativo=false` | manejo excluído existente | HTTP 200; retorna só os excluídos |
| GET /v1/rebanhos/manejos | [MREB-GET-09] `atualizadoDesde` (delta) | 1 manejo vigente e 1 excluído atualizados após a marca | HTTP 200; `data.docs` traz os dois; cada item tem `ativo` e `updatedAt` |
| GET /v1/rebanhos/manejos | [MREB-GET-10] paginação | 3+ manejos, `limit=2` | HTTP 200; `data.docs.length` = 2 |
| GET /v1/rebanhos/manejos | [MREB-GET-11] `limit` acima de 100 | `limit=101` | HTTP 400; validação Zod |
| GET /v1/rebanhos/manejos | [MREB-GET-12] query com campo extra | query com campo não previsto | HTTP 400; `tipo: validationError` |
| GET /v1/rebanhos/manejos | [MREB-GET-13] sem token | sem header `Authorization` | HTTP 401; `tipo: unauthorized` |
| GET /v1/rebanhos/manejos | [MREB-GET-14] admin (não dono) lista | token admin | HTTP 200; `data.docs` não inclui manejos de A/B |
| GET /v1/rebanhos/manejos | [MREB-GET-15] multi-tenancy: B não vê manejos de A | A e B com manejos próprios | HTTP 200; `data.docs` de B não contém IDs de A |

## GET /v1/rebanhos/manejos/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/rebanhos/manejos/:id | [MREB-GET-ID-01] busca manejo de A com itens | manejo com 1+ item de insumo | HTTP 200; `data.itens` traz os itens ativos com `insumo` aninhado |
| GET /v1/rebanhos/manejos/:id | [MREB-GET-ID-02] id não é UUID | `:id` = string não-UUID | HTTP 400; erro de validação |
| GET /v1/rebanhos/manejos/:id | [MREB-GET-ID-03] id inexistente | `:id` = UUID válido sem registro | HTTP 404; `tipo: resourceNotFound` |
| GET /v1/rebanhos/manejos/:id | [MREB-GET-ID-04] sem token | sem header `Authorization` | HTTP 401; `tipo: unauthorized` |
| GET /v1/rebanhos/manejos/:id | [MREB-GET-ID-05] multi-tenancy: B busca manejo de A | B autenticado, `:id` de manejo de A | HTTP 404; mesmo erro de "não encontrado" |
| GET /v1/rebanhos/manejos/:id | [MREB-GET-ID-06] admin (não dono) busca manejo de A | token admin | HTTP 404; sem bypass |

## PATCH /v1/rebanhos/manejos/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| PATCH /v1/rebanhos/manejos/:id | [MREB-PATCH-ID-01] atualiza `medicamentoVacina`/`observacoes` | body com esses campos | HTTP 200; campos refletidos |
| PATCH /v1/rebanhos/manejos/:id | [MREB-PATCH-ID-02] corpo vazio | body `{}` | HTTP 400; `errors[0].path: body` |
| PATCH /v1/rebanhos/manejos/:id | [MREB-PATCH-ID-03] campo extra (`.strict()`) | body com campo não previsto | HTTP 400; `tipo: validationError` |
| PATCH /v1/rebanhos/manejos/:id | [MREB-PATCH-ID-04] `dataAtividade` no futuro | body com `dataAtividade` futura | HTTP 400; mensagem "não pode ser no futuro" |
| PATCH /v1/rebanhos/manejos/:id | [MREB-PATCH-ID-05] id não é UUID | `:id` = string não-UUID | HTTP 400; erro de validação |
| PATCH /v1/rebanhos/manejos/:id | [MREB-PATCH-ID-06] id inexistente | `:id` = UUID válido sem registro | HTTP 404; `tipo: resourceNotFound` |
| PATCH /v1/rebanhos/manejos/:id | [MREB-PATCH-ID-07] `tipoManejoId` inexistente ou inativo | body com `tipoManejoId` inválido | HTTP 404; `tipo: resourceNotFound`; `errors[0].path: tipoManejoId` |
| PATCH /v1/rebanhos/manejos/:id | [MREB-PATCH-ID-08] atualiza `pesoRegistrado` | manejo já criado; body `{ pesoRegistrado }` | HTTP 200; `data.pesoRegistrado` muda, mas `rebanho.pesoMedioAtual` não é recalculado (ver Divergências) |
| PATCH /v1/rebanhos/manejos/:id | [MREB-PATCH-ID-09] sem token | sem header `Authorization` | HTTP 401; `tipo: unauthorized` |
| PATCH /v1/rebanhos/manejos/:id | [MREB-PATCH-ID-10] multi-tenancy: B tenta atualizar manejo de A | B autenticado, `:id` de manejo de A | HTTP 404; `tipo: resourceNotFound` |
| PATCH /v1/rebanhos/manejos/:id | [MREB-PATCH-ID-11] admin (não dono) tenta atualizar manejo de A | token admin | HTTP 404; sem bypass |

## DELETE /v1/rebanhos/manejos/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| DELETE /v1/rebanhos/manejos/:id | [MREB-DELETE-ID-01] remove manejo de A | usuário A autenticado, `:id` próprio | HTTP 200; `message`: "Manejo de rebanho excluído com sucesso."; no banco a linha continua existindo com `ativo:false` (soft-delete, não hard-delete — ver Divergências) |
| DELETE /v1/rebanhos/manejos/:id | [MREB-DELETE-ID-02] manejo tinha itens de insumo vinculados | manejo com 1+ movimentação de insumo ativa | HTTP 200; as `MovimentacaoInsumo` vinculadas (`manejoRebanhoId`) ficam com `ativo:false` no banco |
| DELETE /v1/rebanhos/manejos/:id | [MREB-DELETE-ID-03] id não é UUID | `:id` = string não-UUID | HTTP 400; erro de validação |
| DELETE /v1/rebanhos/manejos/:id | [MREB-DELETE-ID-04] id inexistente | `:id` = UUID válido sem registro | HTTP 404; `tipo: resourceNotFound` |
| DELETE /v1/rebanhos/manejos/:id | [MREB-DELETE-ID-05] sem token | sem header `Authorization` | HTTP 401; `tipo: unauthorized` |
| DELETE /v1/rebanhos/manejos/:id | [MREB-DELETE-ID-06] multi-tenancy: B tenta remover manejo de A | B autenticado, `:id` de manejo de A | HTTP 404; `tipo: resourceNotFound` |
| DELETE /v1/rebanhos/manejos/:id | [MREB-DELETE-ID-07] admin (não dono) tenta remover manejo de A | token admin | HTTP 404; sem bypass |

## Bugs conhecidos

- **`DELETE /v1/rebanhos/manejos/:id` é soft-delete, não hard-delete.** `documentacao/rotas/rotas_pastolivre.md` §7.5 e `CLAUDE.md` ("Manejos são excluídos de verdade") descrevem exclusão física, mas `ManejoRebanhoRepository.remove` (`src/repository/ManejoRebanhoRepository.js:152-157`) faz `update({ data: { ativo: false } })` — a linha permanece no banco, só marcada inativa. Confirmado por `test/manejoSoftDelete.test.js`. Afeta MREB-DELETE-ID-01.
- **`PATCH /v1/rebanhos/manejos/:id` não recalcula `rebanho.pesoMedioAtual`.** `ManejoRebanhoService.update` (`src/service/ManejoRebanhoService.js:137-146`) chama `this.repository.update` direto — só `create`, via `createComAtualizacaoPeso` (`src/repository/ManejoRebanhoRepository.js:111-132`), atualiza o peso do rebanho. Corrigir `pesoRegistrado` de um manejo já lançado, por PATCH, não reflete no peso atual do lote. Não documentado em `rotas_pastolivre.md` §7.4. Afeta MREB-PATCH-ID-08.
- A limitação de pesagem retroativa (peso mais recente por sincronização tardia sobrescreve o peso atual — MREB-POST-25) já está registrada em `rotas_pastolivre.md` §7.1; mantida aqui apenas para apontar o teste que a confirma.
