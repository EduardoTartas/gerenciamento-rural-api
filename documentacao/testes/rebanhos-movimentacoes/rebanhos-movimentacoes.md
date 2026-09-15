# /rebanhos/movimentacoes

Controller `MovimentacaoController` · Service `MovimentacaoService` ·
Repository `MovimentacaoRepository` · Schema `MovimentacaoCreateSchema` (única — recurso é
imutável), `MovimentacaoQuerySchema`, `MovimentacaoIdSchema` · Regras: rotas_pastolivre.md § 6

Pré-condições comuns: usuário A e usuário B autenticados via BetterAuth. A tem um rebanho ativo
(`rebanhoA`) alocado num pasto (`pastoOrigemA`) e outro pasto livre na mesma propriedade
(`pastoDestinoA`).

**Recurso imutável**: não existe rota `PATCH /rebanhos/movimentacoes/:id` — o histórico não
pode ser editado (ver `documentacao/testes/transversal.md` para o teste de que essa rota não
existe). O `DELETE` não apaga o registro: desfaz apenas a última movimentação do rebanho.

Nenhuma das rotas abaixo usa `AdminMiddleware`. Um usuário com `user.admin = true` não tem
acesso especial: os cenários "403 admin" verificam que ele recebe o mesmo 404 que qualquer
usuário não-dono ao mexer em recurso de outro usuário.

## POST /rebanhos/movimentacoes

Arquivo: `test/endpoints/rebanhos-movimentacoes/post-rebanhos-movimentacoes.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MOV-POST-01 | registra movimentação válida | `rebanhoA` em `pastoOrigemA`, destino `pastoDestinoA` livre | 201 | envelope; `data.pastoOrigemId` = pasto atual anterior do rebanho; `data.pastoDestinoId` = enviado |
| MOV-POST-02 | aceita `id` gerado pelo cliente (offline-first) | — | 201 | `data.id` igual ao enviado |
| MOV-POST-03 | corpo vazio | — | 400 | `errors[0].path: body` |
| MOV-POST-04 | campo extra no corpo (`.strict()`) | — | 400 | `tipo: validationError` |
| MOV-POST-05 | falta `rebanhoId` | — | 400 | validação Zod |
| MOV-POST-06 | falta `pastoDestinoId` | — | 400 | validação Zod |
| MOV-POST-07 | `dataMovimentacao` no futuro | — | 400 | mensagem "não pode ser no futuro" |
| MOV-POST-08 | sem token | — | 401 | `tipo: unauthorized` |
| MOV-POST-09 | admin (não dono) tenta mover rebanho de A | token admin | 404 | `tipo: resourceNotFound`; sem bypass |
| MOV-POST-10 | B tenta mover rebanho de A (`rebanhoId` de A) | — | 404 | `tipo: resourceNotFound` |
| MOV-POST-11 | `rebanhoId` inexistente | — | 404 | `tipo: resourceNotFound` |
| MOV-POST-12 | rebanho inativo | rebanho de A com `ativo:false` | 400 | `errors[0].path: rebanhoId`, mensagem "Rebanho está inativo" |
| MOV-POST-13 | `pastoDestinoId` inexistente | — | 404 | `tipo: resourceNotFound` |
| MOV-POST-14 | `pastoDestinoId` pertence a B | B com pasto próprio, A autenticado | 404 | `tipo: resourceNotFound` |
| MOV-POST-15 | pasto de destino inativo | — | 400 | `errors[0].path: pastoDestinoId`, mensagem "Pasto de destino está inativo" |
| MOV-POST-16 | destino igual ao pasto atual do rebanho | `pastoDestinoId` = `pastoOrigemA` | 400 | `errors[0].path: pastoDestinoId`, mensagem "já está neste pasto" |
| MOV-POST-17 | destino de propriedade diferente da do rebanho | — | 400 | `errors[0].path: pastoDestinoId`, mensagem "não pertence à mesma propriedade" |
| MOV-POST-18 | destino ocupado por outro rebanho ativo, sem `permitirLotacaoConjunta` | 1 rebanho ativo no destino | 400 | `errors[0].path: pastoDestinoId`, mensagem "já tem outro lote" |
| MOV-POST-19 | destino ocupado, com `permitirLotacaoConjunta: true` | 1 rebanho ativo no destino | 201 | cria; os dois rebanhos ficam ativos no mesmo pasto |
| MOV-POST-20 | destino em status `Descanso` | pasto vazio recém-desocupado | 201 | não bloqueia — regra explícita de rotas_pastolivre.md §6.1 |
| MOV-POST-21 | transação: atualiza `rebanho.pastoAtualId` e `dataEntradaPastoAtual` | — | 201 | `GET /rebanhos/:id` mostra `pastoAtualId` = destino, `dataEntradaPastoAtual` = `dataMovimentacao` |
| MOV-POST-22 | transação: pasto de destino vira `Ocupado` | destino estava `Vazio`/`Descanso` | 201 | `GET /pastagens/:id` do destino mostra `status: "Ocupado"` |
| MOV-POST-23 | transação: pasto de origem esvazia | rebanho era o único ativo na origem | 201 | `GET /pastagens/:id` da origem mostra `status: "Descanso"` e `dataUltimaSaida` preenchida |
| MOV-POST-24 | transação: pasto de origem não esvazia | outro rebanho ativo continua na origem | 201 | `status` da origem permanece `Ocupado`; `dataUltimaSaida` não muda |

## GET /rebanhos/movimentacoes

Arquivo: `test/endpoints/rebanhos-movimentacoes/get-rebanhos-movimentacoes.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MOV-GET-01 | lista movimentações ativas de A | 2+ movimentações | 200 | `data.docs` só de A |
| MOV-GET-02 | usuário sem movimentações | — | 200 | `message`: "Nenhuma movimentação registrada." |
| MOV-GET-03 | filtro sem resultado | — | 200 | `message`: "Nenhuma movimentação encontrada com os filtros informados." |
| MOV-GET-04 | ordenação | 3+ movimentações em datas diferentes | 200 | `data.docs` ordenado por `dataMovimentacao` decrescente |
| MOV-GET-05 | filtro `rebanhoId` | — | 200 | só movimentações daquele rebanho |
| MOV-GET-06 | filtro `propriedadeId` | — | 200 | só movimentações de rebanhos daquela propriedade |
| MOV-GET-07 | filtro `pastoOrigemId` | — | 200 | só movimentações com aquela origem |
| MOV-GET-08 | filtro `pastoDestinoId` | — | 200 | só movimentações com aquele destino |
| MOV-GET-09 | filtro `dataInicio`/`dataFim` | — | 200 | só movimentações no intervalo |
| MOV-GET-10 | `ativo=false` | movimentação desfeita existente | 200 | retorna só as desfeitas |
| MOV-GET-11 | `atualizadoDesde` (delta) | 1 movimentação válida e 1 desfeita atualizadas após a marca | 200 | `data.docs` traz as duas; cada item tem `ativo` e `updatedAt` |
| MOV-GET-12 | paginação | 3+ movimentações, `limit=2` | 200 | `data.docs.length` = 2 |
| MOV-GET-13 | `limit` acima de 100 | `limit=101` | 400 | validação Zod |
| MOV-GET-14 | query com campo extra | — | 400 | `tipo: validationError` |
| MOV-GET-15 | sem token | — | 401 | `tipo: unauthorized` |
| MOV-GET-16 | admin (não dono) lista | token admin | 200 | `data.docs` não inclui movimentações de A/B |
| MOV-GET-17 | multi-tenancy: B não vê movimentações de A | — | 200 | `data.docs` de B não contém IDs de A |

## GET /rebanhos/movimentacoes/:id

Arquivo: `test/endpoints/rebanhos-movimentacoes/get-rebanhos-movimentacoes-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MOV-GET-ID-01 | busca movimentação de A | — | 200 | `data` traz `rebanho`, `pastoOrigem`, `pastoDestino` aninhados |
| MOV-GET-ID-02 | id não é UUID | — | 400 | erro de validação |
| MOV-GET-ID-03 | id inexistente | — | 404 | `tipo: resourceNotFound` |
| MOV-GET-ID-04 | sem token | — | 401 | `tipo: unauthorized` |
| MOV-GET-ID-05 | multi-tenancy: B busca movimentação de A | — | 404 | mesmo erro de "não encontrado" |
| MOV-GET-ID-06 | admin (não dono) busca movimentação de A | token admin | 404 | sem bypass |

## DELETE /rebanhos/movimentacoes/:id

Desfaz a última movimentação do rebanho (ver `src/repository/MovimentacaoRepository.js`,
métodos `createComTransacao` e `desfazerComTransacao`, e `test/desfazerMovimentacao.test.js`).

Arquivo: `test/endpoints/rebanhos-movimentacoes/delete-rebanhos-movimentacoes-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MOV-DELETE-ID-01 | desfaz a última movimentação do rebanho | movimentação é a mais recente ativa do rebanho | 200 | `message`: "Movimentação desfeita com sucesso."; no banco, movimentação fica `ativo:false`; `rebanho.pastoAtualId` volta ao `pastoOrigemId`; `rebanho.dataEntradaPastoAtual` = `dataMovimentacao` da desfeita |
| MOV-DELETE-ID-02 | tenta desfazer uma movimentação que não é a última | rebanho tem 2+ movimentações, alvo não é a mais recente | 409 | `tipo: conflict`, `errors[0].path: id`, mensagem cita o id da última válida |
| MOV-DELETE-ID-03 | pasto de origem fica sem rebanhos ativos após a reversão | rebanho volta a ser o único que ocupava a origem | 200 | `GET /pastagens/:id` da origem mostra `status: "Descanso"`, `dataUltimaSaida` atualizada |
| MOV-DELETE-ID-04 | pasto de origem continua ocupado após a reversão | outro rebanho ativo já estava na origem | 200 | `status` da origem permanece/volta a `Ocupado` |
| MOV-DELETE-ID-05 | pasto de destino (de onde o lote saiu ao desfazer) fica sem rebanhos ativos | rebanho desfeito era o único no destino | 200 | `status` do destino recalculado para `Descanso`, `dataUltimaSaida` atualizada |
| MOV-DELETE-ID-06 | pasto de destino continua ocupado após a reversão | outro rebanho ativo permanece no destino | 200 | `status` do destino permanece `Ocupado` |
| MOV-DELETE-ID-07 | id não é UUID | — | 400 | erro de validação |
| MOV-DELETE-ID-08 | id inexistente | — | 404 | `tipo: resourceNotFound` |
| MOV-DELETE-ID-09 | sem token | — | 401 | `tipo: unauthorized` |
| MOV-DELETE-ID-10 | multi-tenancy: B tenta desfazer movimentação de A | — | 404 | `tipo: resourceNotFound` |
| MOV-DELETE-ID-11 | admin (não dono) tenta desfazer movimentação de A | token admin | 404 | sem bypass |

## Divergências

Nenhuma divergência de comportamento encontrada entre o código, `rotas_pastolivre.md` § 6 e
`CLAUDE.md` para esta rota — `createComTransacao` e `desfazerComTransacao` implementam
exatamente as regras documentadas (transação atômica, contagem de ocupantes dentro da
transação, reconferência da "última movimentação" com o cliente transacional).

Observação de escopo: a reconferência dentro da transação existe especificamente para cobrir
uma corrida entre o `findFirst` externo (`MovimentacaoService.remove`) e a abertura da
transação (`MovimentacaoRepository.desfazerComTransacao`) — ver comentário em
`src/repository/MovimentacaoRepository.js:140-149` e o teste
"reconfere dentro da transação" em `test/desfazerMovimentacao.test.js`. Não é prático forçar
essa corrida de verdade sobre HTTP; a garantia estrutural já está coberta pelo teste unitário
existente e não precisa de um cenário HTTP dedicado — MOV-DELETE-ID-02 já cobre o caso
observável (tentar desfazer algo que não é mais a última) pela via normal.
