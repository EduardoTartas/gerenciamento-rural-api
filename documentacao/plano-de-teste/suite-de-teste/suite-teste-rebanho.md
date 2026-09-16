# Plano de Teste para Endpoints de Rebanho

Cadastro, listagem, edição, inativação e reativação de lotes de gado vinculados a uma propriedade e um pasto do usuário autenticado. Fonte técnica: `documentacao/testes/rebanhos/rebanhos.md`. Suíte automatizada: `test/endpoints/rebanhos/`.

## POST /v1/rebanhos

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/rebanhos | [REB-POST-01] cria com dados válidos | propriedade+pasto ativos de A; body completo | HTTP 201; envelope `{message,data,errors}`; `data.id`; `data.propriedadeId` = propriedade de A (o POST devolve o registro cru, sem relações — ver Bugs conhecidos); rebanho gravado no banco |
| POST /v1/rebanhos | [REB-POST-02] aceita `id` gerado pelo cliente (offline-first) | body com `id` UUID do cliente | HTTP 201; `data.id` igual ao enviado |
| POST /v1/rebanhos | [REB-POST-03] corpo vazio | body `{}` | HTTP 400; `tipo: validationError`; `errors[0].path: body` |
| POST /v1/rebanhos | [REB-POST-04] campo extra no corpo (`.strict()`) | body com campo não previsto | HTTP 400; `tipo: validationError` |
| POST /v1/rebanhos | [REB-POST-05] falta `propriedadeId` | body sem `propriedadeId` | HTTP 400; validação Zod, `path` inclui `propriedadeId` |
| POST /v1/rebanhos | [REB-POST-06] falta `nomeRebanho` | body sem `nomeRebanho` | HTTP 400; validação Zod |
| POST /v1/rebanhos | [REB-POST-07] falta `pastoAtualId` | body sem `pastoAtualId` | HTTP 400; validação Zod |
| POST /v1/rebanhos | [REB-POST-08] `propriedadeId` não é UUID | body com `propriedadeId` inválido | HTTP 400; validação Zod |
| POST /v1/rebanhos | [REB-POST-09] `quantidadeCabecas` zero ou negativo | body com `quantidadeCabecas` <= 0 | HTTP 400; validação Zod |
| POST /v1/rebanhos | [REB-POST-10] `pesoMedioAtual` negativo | body com `pesoMedioAtual` < 0 | HTTP 400; validação Zod |
| POST /v1/rebanhos | [REB-POST-11] sem token | sem header `Authorization` | HTTP 401; `tipo: unauthorized` |
| POST /v1/rebanhos | [REB-POST-12] token inválido/expirado | header `Authorization` com token inválido/expirado | HTTP 401; `tipo: unauthorized` |
| POST /v1/rebanhos | [REB-POST-13] admin (não dono) cria rebanho em propriedade de A | token admin, `propriedadeId` de A | HTTP 404; `tipo: resourceNotFound`; sem bypass de multi-tenancy |
| POST /v1/rebanhos | [REB-POST-14] B tenta criar rebanho com `propriedadeId` de A | B autenticado, `propriedadeId` de A | HTTP 404; `tipo: resourceNotFound`; `message` "Propriedade não encontrada ou não pertence ao usuário autenticado." |
| POST /v1/rebanhos | [REB-POST-15] `propriedadeId` inexistente | `propriedadeId` = UUID válido sem registro | HTTP 404; `tipo: resourceNotFound` |
| POST /v1/rebanhos | [REB-POST-16] propriedade inativa | propriedade de A com `ativo:false` | HTTP 400; `tipo: validationError`; `errors[0].path: propriedadeId` |
| POST /v1/rebanhos | [REB-POST-17] `nomeRebanho` duplicado (ativo) na mesma propriedade | já existe rebanho ativo com o nome | HTTP 409; `tipo: conflict`; `errors[0].path: nomeRebanho` |
| POST /v1/rebanhos | [REB-POST-18] `nomeRebanho` igual a um rebanho inativo existente | rebanho homônimo com `ativo:false` | HTTP 201; cria normalmente — `findByNome` só considera ativos |
| POST /v1/rebanhos | [REB-POST-19] `pastoAtualId` inexistente | `pastoAtualId` = UUID válido sem registro | HTTP 404; `tipo: resourceNotFound` |
| POST /v1/rebanhos | [REB-POST-20] `pastoAtualId` pertence a B | B tem pasto próprio; body usa esse `pastoAtualId` | HTTP 404; `tipo: resourceNotFound` (mesmo com A autenticado) |
| POST /v1/rebanhos | [REB-POST-21] pasto inativo | pasto de A com `ativo:false` | HTTP 400; `tipo: validationError`; `errors[0].path: pastoAtualId` |
| POST /v1/rebanhos | [REB-POST-22] pasto pertence a outra propriedade do próprio A | `propriedadeId` ≠ propriedade do pasto | HTTP 400; `errors[0].path: pastoAtualId`, mensagem "não pertence à mesma propriedade" |
| POST /v1/rebanhos | [REB-POST-23] pasto já ocupado por outro rebanho ativo, sem `permitirLotacaoConjunta` | 1 rebanho ativo no pasto | HTTP 400; `errors[0].path: pastoAtualId`, mensagem "já tem outro lote" |
| POST /v1/rebanhos | [REB-POST-24] pasto ocupado, com `permitirLotacaoConjunta: true` | 1 rebanho ativo no pasto; body `{ permitirLotacaoConjunta: true }` | HTTP 201; cria; os dois rebanhos ficam ativos no mesmo pasto |
| POST /v1/rebanhos | [REB-POST-25] transação: cria rebanho e marca pasto como `Ocupado` | pasto estava `Vazio` | HTTP 201; `GET /pastagens/:id` do pasto mostra `status: "Ocupado"` |
| POST /v1/rebanhos | [REB-POST-26] `dataEntradaPastoAtual` omitida | body sem `dataEntradaPastoAtual` | HTTP 201; `data.dataEntradaPastoAtual` ≈ agora |
| POST /v1/rebanhos | [REB-POST-27] `dataEntradaPastoAtual` informada | body com `dataEntradaPastoAtual` | HTTP 201; `data.dataEntradaPastoAtual` igual ao enviado |

## GET /v1/rebanhos

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/rebanhos | [REB-GET-01] lista rebanhos ativos de A | 2+ rebanhos ativos de A | HTTP 200; `data.docs` só rebanhos de A; `data.totalDocs` |
| GET /v1/rebanhos | [REB-GET-02] usuário sem rebanhos | usuário A autenticado, sem rebanhos | HTTP 200; `message`: "Nenhum rebanho cadastrado."; `data.docs: []` |
| GET /v1/rebanhos | [REB-GET-03] filtro sem resultado | query `nomeRebanho` que não bate | HTTP 200; `message`: "Nenhum rebanho encontrado com os filtros informados." |
| GET /v1/rebanhos | [REB-GET-04] filtro `nomeRebanho` (contains, case-insensitive) | query `?nomeRebanho=...` | HTTP 200; só rebanhos cujo nome contém o termo, ignorando maiúsculas |
| GET /v1/rebanhos | [REB-GET-05] filtro `propriedadeId` | query `?propriedadeId=...` | HTTP 200; só rebanhos da propriedade |
| GET /v1/rebanhos | [REB-GET-06] filtro `pastoAtualId` | query `?pastoAtualId=...` | HTTP 200; só rebanhos daquele pasto |
| GET /v1/rebanhos | [REB-GET-07] filtro `racaId` | query `?racaId=...` | HTTP 200; só rebanhos daquela raça |
| GET /v1/rebanhos | [REB-GET-08] filtro `sistemaProducaoId` | query `?sistemaProducaoId=...` | HTTP 200; só rebanhos daquele sistema |
| GET /v1/rebanhos | [REB-GET-09] filtro `regimeAlimentarId` | query `?regimeAlimentarId=...` | HTTP 200; só rebanhos daquele regime |
| GET /v1/rebanhos | [REB-GET-10] `ativo=false` | rebanho inativo existente | HTTP 200; retorna só os inativos |
| GET /v1/rebanhos | [REB-GET-11] `atualizadoDesde` (delta) | 1 rebanho ativo e 1 inativo atualizados após a marca | HTTP 200; `data.docs` traz os dois; cada item tem `ativo` e `updatedAt` |
| GET /v1/rebanhos | [REB-GET-12] paginação (`page`, `limit`) | 3+ rebanhos, `limit=2` | HTTP 200; `data.docs.length` = 2; `data.totalPages` correto |
| GET /v1/rebanhos | [REB-GET-13] `limit` acima de 100 | `limit=101` | HTTP 400; validação Zod (`max(100)`) |
| GET /v1/rebanhos | [REB-GET-14] query com campo extra (`.strict()`) | query com campo não previsto | HTTP 400; `tipo: validationError` |
| GET /v1/rebanhos | [REB-GET-15] sem token | sem header `Authorization` | HTTP 401; `tipo: unauthorized` |
| GET /v1/rebanhos | [REB-GET-16] admin (não dono) lista | token admin, sem rebanhos próprios | HTTP 200; `data.docs` não inclui rebanhos de A/B — sem bypass |
| GET /v1/rebanhos | [REB-GET-17] multi-tenancy: B não vê rebanhos de A | A e B com rebanhos próprios | HTTP 200; `data.docs` de B não contém IDs de A |

## GET /v1/rebanhos/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/rebanhos/:id | [REB-GET-ID-01] busca rebanho de A | usuário A autenticado, `:id` próprio | HTTP 200; `message`: "Rebanho encontrado com sucesso."; `data` inclui `propriedade`, `pastoAtual`, `raca`, `sistemaProducao`, `regimeAlimentar` aninhados |
| GET /v1/rebanhos/:id | [REB-GET-ID-02] id não é UUID | `:id=abc` | HTTP 400; erro de validação (Zod) |
| GET /v1/rebanhos/:id | [REB-GET-ID-03] id inexistente | `:id` = UUID válido sem registro | HTTP 404; `tipo: resourceNotFound` |
| GET /v1/rebanhos/:id | [REB-GET-ID-04] sem token | sem header `Authorization` | HTTP 401; `tipo: unauthorized` |
| GET /v1/rebanhos/:id | [REB-GET-ID-05] multi-tenancy: B busca rebanho de A | B autenticado, `:id` de rebanho de A | HTTP 404; mesmo erro de "não encontrado", nunca 403 |
| GET /v1/rebanhos/:id | [REB-GET-ID-06] admin (não dono) busca rebanho de A | token admin | HTTP 404; sem bypass de multi-tenancy |

## PATCH /v1/rebanhos/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| PATCH /v1/rebanhos/:id | [REB-PATCH-ID-01] atualiza `nomeRebanho` | body `{ nomeRebanho }` | HTTP 200; `data.nomeRebanho` atualizado |
| PATCH /v1/rebanhos/:id | [REB-PATCH-ID-02] atualiza `quantidadeCabecas`/`pesoMedioAtual` | body com esses campos | HTTP 200; campos refletidos |
| PATCH /v1/rebanhos/:id | [REB-PATCH-ID-03] corpo vazio | body `{}` | HTTP 400; `errors[0].path: body` |
| PATCH /v1/rebanhos/:id | [REB-PATCH-ID-04] campo extra (`.strict()`) | body com campo não previsto | HTTP 400; `tipo: validationError` |
| PATCH /v1/rebanhos/:id | [REB-PATCH-ID-05] id não é UUID | `:id` = string não-UUID | HTTP 400; erro de validação |
| PATCH /v1/rebanhos/:id | [REB-PATCH-ID-06] id inexistente | `:id` = UUID válido sem registro | HTTP 404; `tipo: resourceNotFound` |
| PATCH /v1/rebanhos/:id | [REB-PATCH-ID-07] `nomeRebanho` duplicado com outro rebanho ativo da mesma propriedade | body renomeia para nome já usado | HTTP 409; `tipo: conflict` |
| PATCH /v1/rebanhos/:id | [REB-PATCH-ID-08] tenta alterar `pastoAtualId` de rebanho ativo | body `{ pastoAtualId }` | HTTP 400; `errors[0].path: pastoAtualId`, mensagem "deve ser feita através da rota de movimentação" |
| PATCH /v1/rebanhos/:id | [REB-PATCH-ID-09] envia `ativo: false` (inativação) | rebanho ativo de A com pasto vinculado; body `{ ativo: false }` | comportamento correto esperado (`rotas_pastolivre.md` §5.4/5.5): HTTP 200; `data.ativo:false`, `data.pastoAtualId:null` **(bug conhecido — ver Divergências, hoje responde 500)** |
| PATCH /v1/rebanhos/:id | [REB-PATCH-ID-10] reativa (`ativo: true`) sem informar `pastoAtualId` | rebanho inativo de A; body `{ ativo: true }` sem `pastoAtualId` | HTTP 400; `errors[0].path: pastoAtualId`, mensagem "Informe o pasto atual para reativar" — validado antes da transação, não atinge o bug |
| PATCH /v1/rebanhos/:id | [REB-PATCH-ID-11] reativa com `pastoAtualId` válido | rebanho inativo, pasto ativo da mesma propriedade; body `{ ativo: true, pastoAtualId }` | comportamento correto esperado (`rotas_pastolivre.md` §5.4): HTTP 200; `data.ativo:true`, `data.pastoAtualId` igual ao enviado **(bug conhecido — ver Divergências, hoje responde 500)** |
| PATCH /v1/rebanhos/:id | [REB-PATCH-ID-12] reativa com pasto inativo | body `{ ativo: true, pastoAtualId }` de pasto inativo | HTTP 400; `errors[0].path: pastoAtualId` — validado antes da transação |
| PATCH /v1/rebanhos/:id | [REB-PATCH-ID-13] reativa com pasto de outra propriedade | body `{ ativo: true, pastoAtualId }` de outra propriedade | HTTP 400; `errors[0].path: pastoAtualId` — validado antes da transação |
| PATCH /v1/rebanhos/:id | [REB-PATCH-ID-14] sem token | sem header `Authorization` | HTTP 401; `tipo: unauthorized` |
| PATCH /v1/rebanhos/:id | [REB-PATCH-ID-15] multi-tenancy: B tenta atualizar rebanho de A | B autenticado, `:id` de rebanho de A | HTTP 404; `tipo: resourceNotFound` |
| PATCH /v1/rebanhos/:id | [REB-PATCH-ID-16] admin (não dono) tenta atualizar rebanho de A | token admin | HTTP 404; sem bypass |

## DELETE /v1/rebanhos/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| DELETE /v1/rebanhos/:id | [REB-DELETE-ID-01] inativa rebanho ativo de A | rebanho ativo com pasto vinculado | comportamento correto esperado (`rotas_pastolivre.md` §5.5): HTTP 200; soft-delete efetivo — `data.ativo:false`, `data.pastoAtualId:null`; se o pasto ficou sem outros rebanhos ativos, `status: "Descanso"` **(bug conhecido — ver Divergências, hoje responde 500)** |
| DELETE /v1/rebanhos/:id | [REB-DELETE-ID-02] id não é UUID | `:id` = string não-UUID | HTTP 400; erro de validação |
| DELETE /v1/rebanhos/:id | [REB-DELETE-ID-03] id inexistente | `:id` = UUID válido sem registro | HTTP 404; `tipo: resourceNotFound` — este check roda antes do trecho com bug |
| DELETE /v1/rebanhos/:id | [REB-DELETE-ID-04] sem token | sem header `Authorization` | HTTP 401; `tipo: unauthorized` |
| DELETE /v1/rebanhos/:id | [REB-DELETE-ID-05] multi-tenancy: B tenta remover rebanho de A | B autenticado, `:id` de rebanho de A | HTTP 404; `tipo: resourceNotFound` |
| DELETE /v1/rebanhos/:id | [REB-DELETE-ID-06] admin (não dono) tenta remover rebanho de A | token admin | HTTP 404; sem bypass |

## Bugs conhecidos

- **Bug crítico — `DELETE /v1/rebanhos/:id` e `PATCH /v1/rebanhos/:id` com `ativo:false`/reativação (`ativo:true`) sempre retornam 500.** `RebanhoService._inativar` (`src/service/RebanhoService.js:184-215`) e `_reativar` (`:223-270`) chamam `comTransacao(this.prisma, executor, ...)` sem que `executor` esteja declarado como parâmetro em nenhum dos dois métodos, nem repassado por `remove()` (`:174-178`) ou `update()` (`:156-163`). A chamada lança `ReferenceError: executor is not defined`, tratado como 500 (`tipo: serverError`) — nunca chega a rodar `prisma.$transaction`. Na prática, nenhum rebanho pode ser inativado nem reativado por essas rotas hoje. As validações que rodam antes da chamada a `comTransacao` continuam funcionando normalmente. Testes correspondentes marcados `it.fails` na suíte automatizada (`test/endpoints/rebanhos/patch-rebanhos-id.test.js`, `delete-rebanhos-id.test.js`) até a correção; as linhas REB-PATCH-ID-09, REB-PATCH-ID-11 e REB-DELETE-ID-01 acima descrevem o comportamento correto esperado (`rotas_pastolivre.md` §5.4/§5.5), a ser validado contra o banco quando o bug for corrigido.
- **`POST /v1/rebanhos` devolve uma forma diferente de `GET`/`PATCH`.** `RebanhoService.create` (`src/service/RebanhoService.js:118-128`) grava com `tx.rebanho.create({ data })` dentro da transação, sem o `select: REBANHO_SELECT` que `RebanhoRepository.create` (`:100-102`) aplica. O corpo da criação traz só as colunas da tabela, enquanto a leitura e a atualização trazem as relações aninhadas (`propriedade`, `pastoAtual`, `raca`, ...). O app precisa tratar as duas formas. REB-POST-01 asserta o comportamento atual.
- `RebanhoRepository.findByNome` (`:83-91`) só considera rebanhos ativos — nome duplicado com um rebanho inativo é permitido (REB-POST-18). Coerente com a "reciclagem de nome" já documentada para pastos, mas não estava explícito em §5.
