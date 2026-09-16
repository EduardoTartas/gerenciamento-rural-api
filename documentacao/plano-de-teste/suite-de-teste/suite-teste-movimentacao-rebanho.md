# Plano de Teste para Endpoints de Movimentação de Rebanho

Histórico imutável de troca de pasto de um rebanho (não existe `PATCH`; `DELETE` apenas desfaz a última movimentação). Fonte técnica: `documentacao/testes/rebanhos-movimentacoes/rebanhos-movimentacoes.md`. Suíte automatizada: `test/endpoints/rebanhos-movimentacoes/`.

## POST /v1/rebanhos/movimentacoes

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-01] registra movimentação válida | `rebanhoA` em `pastoOrigemA`, destino `pastoDestinoA` livre | HTTP 201; envelope; `data.pastoOrigemId` = pasto atual anterior do rebanho; `data.pastoDestinoId` = enviado |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-02] aceita `id` gerado pelo cliente (offline-first) | body com `id` UUID do cliente | HTTP 201; `data.id` igual ao enviado |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-03] corpo vazio | body `{}` | HTTP 400; `errors[0].path: body` |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-04] campo extra no corpo (`.strict()`) | body com campo não previsto | HTTP 400; `tipo: validationError` |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-05] falta `rebanhoId` | body sem `rebanhoId` | HTTP 400; validação Zod |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-06] falta `pastoDestinoId` | body sem `pastoDestinoId` | HTTP 400; validação Zod |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-07] `dataMovimentacao` no futuro | body com `dataMovimentacao` futura | HTTP 400; mensagem "não pode ser no futuro" |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-08] sem token | sem header `Authorization` | HTTP 401; `tipo: unauthorized` |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-09] admin (não dono) tenta mover rebanho de A | token admin, `rebanhoId` de A | HTTP 404; `tipo: resourceNotFound`; sem bypass |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-10] B tenta mover rebanho de A (`rebanhoId` de A) | B autenticado | HTTP 404; `tipo: resourceNotFound` |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-11] `rebanhoId` inexistente | `rebanhoId` = UUID válido sem registro | HTTP 404; `tipo: resourceNotFound` |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-12] rebanho inativo | rebanho de A com `ativo:false` | HTTP 400; `errors[0].path: rebanhoId`, mensagem "Rebanho está inativo" |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-13] `pastoDestinoId` inexistente | `pastoDestinoId` = UUID válido sem registro | HTTP 404; `tipo: resourceNotFound` |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-14] `pastoDestinoId` pertence a B | B com pasto próprio, A autenticado | HTTP 404; `tipo: resourceNotFound` |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-15] pasto de destino inativo | `pastoDestinoId` com `ativo:false` | HTTP 400; `errors[0].path: pastoDestinoId`, mensagem "Pasto de destino está inativo" |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-16] destino igual ao pasto atual do rebanho | `pastoDestinoId` = `pastoOrigemA` | HTTP 400; `errors[0].path: pastoDestinoId`, mensagem "já está neste pasto" |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-17] destino de propriedade diferente da do rebanho | `pastoDestinoId` de outra propriedade | HTTP 400; `errors[0].path: pastoDestinoId`, mensagem "não pertence à mesma propriedade" |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-18] destino ocupado por outro rebanho ativo, sem `permitirLotacaoConjunta` | 1 rebanho ativo no destino | HTTP 400; `errors[0].path: pastoDestinoId`, mensagem "já tem outro lote" |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-19] destino ocupado, com `permitirLotacaoConjunta: true` | 1 rebanho ativo no destino; body `{ permitirLotacaoConjunta: true }` | HTTP 201; cria; os dois rebanhos ficam ativos no mesmo pasto |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-20] destino em status `Descanso` | pasto vazio recém-desocupado | HTTP 201; não bloqueia — regra explícita de `rotas_pastolivre.md` §6.1 |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-21] transação: atualiza `rebanho.pastoAtualId` e `dataEntradaPastoAtual` | — | HTTP 201; `GET /rebanhos/:id` mostra `pastoAtualId` = destino, `dataEntradaPastoAtual` = `dataMovimentacao` |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-22] transação: pasto de destino vira `Ocupado` | destino estava `Vazio`/`Descanso` | HTTP 201; `GET /pastagens/:id` do destino mostra `status: "Ocupado"` |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-23] transação: pasto de origem esvazia | rebanho era o único ativo na origem | HTTP 201; `GET /pastagens/:id` da origem mostra `status: "Descanso"` e `dataUltimaSaida` preenchida |
| POST /v1/rebanhos/movimentacoes | [MOV-POST-24] transação: pasto de origem não esvazia | outro rebanho ativo continua na origem | HTTP 201; `status` da origem permanece `Ocupado`; `dataUltimaSaida` não muda |

## GET /v1/rebanhos/movimentacoes

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/rebanhos/movimentacoes | [MOV-GET-01] lista movimentações ativas de A | 2+ movimentações | HTTP 200; `data.docs` só de A |
| GET /v1/rebanhos/movimentacoes | [MOV-GET-02] usuário sem movimentações | usuário A autenticado, sem movimentações | HTTP 200; `message`: "Nenhuma movimentação registrada." |
| GET /v1/rebanhos/movimentacoes | [MOV-GET-03] filtro sem resultado | query sem correspondência | HTTP 200; `message`: "Nenhuma movimentação encontrada com os filtros informados." |
| GET /v1/rebanhos/movimentacoes | [MOV-GET-04] ordenação | 3+ movimentações em datas diferentes | HTTP 200; `data.docs` ordenado por `dataMovimentacao` decrescente |
| GET /v1/rebanhos/movimentacoes | [MOV-GET-05] filtro `rebanhoId` | query `?rebanhoId=...` | HTTP 200; só movimentações daquele rebanho |
| GET /v1/rebanhos/movimentacoes | [MOV-GET-06] filtro `propriedadeId` | query `?propriedadeId=...` | HTTP 200; só movimentações de rebanhos daquela propriedade |
| GET /v1/rebanhos/movimentacoes | [MOV-GET-07] filtro `pastoOrigemId` | query `?pastoOrigemId=...` | HTTP 200; só movimentações com aquela origem |
| GET /v1/rebanhos/movimentacoes | [MOV-GET-08] filtro `pastoDestinoId` | query `?pastoDestinoId=...` | HTTP 200; só movimentações com aquele destino |
| GET /v1/rebanhos/movimentacoes | [MOV-GET-09] filtro `dataInicio`/`dataFim` | query com intervalo | HTTP 200; só movimentações no intervalo |
| GET /v1/rebanhos/movimentacoes | [MOV-GET-10] `ativo=false` | movimentação desfeita existente | HTTP 200; retorna só as desfeitas |
| GET /v1/rebanhos/movimentacoes | [MOV-GET-11] `atualizadoDesde` (delta) | 1 movimentação válida e 1 desfeita atualizadas após a marca | HTTP 200; `data.docs` traz as duas; cada item tem `ativo` e `updatedAt` |
| GET /v1/rebanhos/movimentacoes | [MOV-GET-12] paginação | 3+ movimentações, `limit=2` | HTTP 200; `data.docs.length` = 2 |
| GET /v1/rebanhos/movimentacoes | [MOV-GET-13] `limit` acima de 100 | `limit=101` | HTTP 400; validação Zod |
| GET /v1/rebanhos/movimentacoes | [MOV-GET-14] query com campo extra | query com campo não previsto | HTTP 400; `tipo: validationError` |
| GET /v1/rebanhos/movimentacoes | [MOV-GET-15] sem token | sem header `Authorization` | HTTP 401; `tipo: unauthorized` |
| GET /v1/rebanhos/movimentacoes | [MOV-GET-16] admin (não dono) lista | token admin | HTTP 200; `data.docs` não inclui movimentações de A/B |
| GET /v1/rebanhos/movimentacoes | [MOV-GET-17] multi-tenancy: B não vê movimentações de A | A e B com movimentações próprias | HTTP 200; `data.docs` de B não contém IDs de A |

## GET /v1/rebanhos/movimentacoes/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/rebanhos/movimentacoes/:id | [MOV-GET-ID-01] busca movimentação de A | usuário A autenticado, `:id` próprio | HTTP 200; `data` traz `rebanho`, `pastoOrigem`, `pastoDestino` aninhados |
| GET /v1/rebanhos/movimentacoes/:id | [MOV-GET-ID-02] id não é UUID | `:id` = string não-UUID | HTTP 400; erro de validação |
| GET /v1/rebanhos/movimentacoes/:id | [MOV-GET-ID-03] id inexistente | `:id` = UUID válido sem registro | HTTP 404; `tipo: resourceNotFound` |
| GET /v1/rebanhos/movimentacoes/:id | [MOV-GET-ID-04] sem token | sem header `Authorization` | HTTP 401; `tipo: unauthorized` |
| GET /v1/rebanhos/movimentacoes/:id | [MOV-GET-ID-05] multi-tenancy: B busca movimentação de A | B autenticado, `:id` de movimentação de A | HTTP 404; mesmo erro de "não encontrado" |
| GET /v1/rebanhos/movimentacoes/:id | [MOV-GET-ID-06] admin (não dono) busca movimentação de A | token admin | HTTP 404; sem bypass |

## DELETE /v1/rebanhos/movimentacoes/:id

Desfaz a última movimentação do rebanho (não apaga o registro); ver `src/repository/MovimentacaoRepository.js` (`createComTransacao`, `desfazerComTransacao`) e `test/desfazerMovimentacao.test.js`.

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| DELETE /v1/rebanhos/movimentacoes/:id | [MOV-DELETE-ID-01] desfaz a última movimentação do rebanho | movimentação é a mais recente ativa do rebanho | HTTP 200; `message`: "Movimentação desfeita com sucesso."; no banco, movimentação fica `ativo:false`; `rebanho.pastoAtualId` volta ao `pastoOrigemId`; `rebanho.dataEntradaPastoAtual` = `dataMovimentacao` da desfeita |
| DELETE /v1/rebanhos/movimentacoes/:id | [MOV-DELETE-ID-02] tenta desfazer uma movimentação que não é a última | rebanho tem 2+ movimentações, alvo não é a mais recente | HTTP 409; `tipo: conflict`, `errors[0].path: id`, mensagem cita o id da última válida |
| DELETE /v1/rebanhos/movimentacoes/:id | [MOV-DELETE-ID-03] pasto de origem volta a ficar ocupado após a reversão | pasto de origem estava vazio (`Descanso`) antes do desfazer — o rebanho volta a ser o único ocupante | HTTP 200; `GET /pastagens/:id` da origem mostra `status: "Ocupado"` |
| DELETE /v1/rebanhos/movimentacoes/:id | [MOV-DELETE-ID-04] pasto de origem continua ocupado após a reversão | outro rebanho ativo já estava na origem | HTTP 200; `status` da origem permanece/volta a `Ocupado` |
| DELETE /v1/rebanhos/movimentacoes/:id | [MOV-DELETE-ID-05] pasto de destino (de onde o lote saiu ao desfazer) fica sem rebanhos ativos | rebanho desfeito era o único no destino | HTTP 200; `status` do destino recalculado para `Descanso`, `dataUltimaSaida` atualizada |
| DELETE /v1/rebanhos/movimentacoes/:id | [MOV-DELETE-ID-06] pasto de destino continua ocupado após a reversão | outro rebanho ativo permanece no destino | HTTP 200; `status` do destino permanece `Ocupado` |
| DELETE /v1/rebanhos/movimentacoes/:id | [MOV-DELETE-ID-07] id não é UUID | `:id` = string não-UUID | HTTP 400; erro de validação |
| DELETE /v1/rebanhos/movimentacoes/:id | [MOV-DELETE-ID-08] id inexistente | `:id` = UUID válido sem registro | HTTP 404; `tipo: resourceNotFound` |
| DELETE /v1/rebanhos/movimentacoes/:id | [MOV-DELETE-ID-09] sem token | sem header `Authorization` | HTTP 401; `tipo: unauthorized` |
| DELETE /v1/rebanhos/movimentacoes/:id | [MOV-DELETE-ID-10] multi-tenancy: B tenta desfazer movimentação de A | B autenticado, `:id` de movimentação de A | HTTP 404; `tipo: resourceNotFound` |
| DELETE /v1/rebanhos/movimentacoes/:id | [MOV-DELETE-ID-11] admin (não dono) tenta desfazer movimentação de A | token admin | HTTP 404; sem bypass |

## Bugs conhecidos

- Correção de cenário (não é bug de código): a linha original de MOV-DELETE-ID-03 descrevia um caso logicamente impossível ("pasto de origem fica sem rebanhos ativos após a reversão"). Em `desfazerComTransacao` (`src/repository/MovimentacaoRepository.js:150-201`) o rebanho é devolvido ao `pastoOrigemId` da movimentação desfeita, então esse pasto sempre ganha um ocupante na reversão — nunca fica vazio por causa dela; quem pode ficar vazio é o `pastoDestinoId` (já coberto por MOV-DELETE-ID-05). O cenário acima já reflete o comportamento real.
- Nenhuma outra divergência de comportamento encontrada entre o código, `rotas_pastolivre.md` §6 e `CLAUDE.md` para esta rota — `createComTransacao` e `desfazerComTransacao` implementam exatamente as regras documentadas (transação atômica, contagem de ocupantes dentro da transação, reconferência da "última movimentação" com o cliente transacional).
- Observação de escopo: a reconferência dentro da transação (`src/repository/MovimentacaoRepository.js:140-149`) cobre uma corrida entre o `findFirst` externo (`MovimentacaoService.remove`) e a abertura da transação; não é prática forçar essa corrida via HTTP — já coberta por teste unitário em `test/desfazerMovimentacao.test.js` e por MOV-DELETE-ID-02 na via normal.
