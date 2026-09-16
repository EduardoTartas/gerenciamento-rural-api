# /rebanhos/manejos

Controller `ManejoRebanhoController` · Service `ManejoRebanhoService` ·
Repository `ManejoRebanhoRepository` · Schemas `ManejoRebanhoCreateSchema`,
`ManejoRebanhoUpdateSchema`, `ManejoRebanhoQuerySchema`, `ManejoRebanhoIdSchema` ·
Regras: rotas_pastolivre.md § 7

Pré-condições comuns: usuário A e usuário B autenticados via BetterAuth. A tem um rebanho ativo
(`rebanhoA`) numa propriedade com um insumo ativo destinado a `Rebanho` ou `Ambos`
(`insumoA`), e um tipo de manejo de rebanho ativo no catálogo (`tipoManejoA`).

Nenhuma das rotas abaixo usa `AdminMiddleware`. Um usuário com `user.admin = true` não tem
acesso especial: os cenários "403 admin" verificam que ele recebe o mesmo 404 que qualquer
usuário não-dono ao mexer em recurso de outro usuário.

## POST /rebanhos/manejos

Arquivo: `test/endpoints/rebanhos-manejos/post-rebanhos-manejos.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MREB-POST-01 | cria manejo sem itens | rebanho e tipo de manejo válidos | 201 | envelope; `data.id`; `data.itens: []` |
| MREB-POST-02 | aceita `id` gerado pelo cliente (offline-first) | — | 201 | `data.id` igual ao enviado |
| MREB-POST-03 | corpo vazio | — | 400 | `errors[0].path: body` |
| MREB-POST-04 | campo extra no corpo (`.strict()`) | — | 400 | `tipo: validationError` |
| MREB-POST-05 | falta `rebanhoId` | — | 400 | validação Zod |
| MREB-POST-06 | falta `tipoManejoId` | — | 400 | validação Zod |
| MREB-POST-07 | falta `dataAtividade` | — | 400 | validação Zod |
| MREB-POST-08 | `dataAtividade` no futuro | — | 400 | mensagem "não pode ser no futuro" |
| MREB-POST-09 | `pesoRegistrado` zero ou negativo | — | 400 | validação Zod |
| MREB-POST-10 | item com campo extra (`.strict()` do item) | — | 400 | validação Zod |
| MREB-POST-11 | mais de 50 itens | 51 itens no array | 400 | mensagem "No máximo 50 itens" |
| MREB-POST-12 | sem token | — | 401 | `tipo: unauthorized` |
| MREB-POST-13 | admin (não dono) cria manejo em rebanho de A | token admin | 404 | `tipo: resourceNotFound`; sem bypass |
| MREB-POST-14 | B tenta criar manejo com `rebanhoId` de A | — | 404 | `tipo: resourceNotFound` |
| MREB-POST-15 | `rebanhoId` inexistente | — | 404 | `tipo: resourceNotFound` |
| MREB-POST-16 | rebanho inativo | rebanho de A com `ativo:false` | 400 | `errors[0].path: rebanhoId`, mensagem "rebanho inativo" |
| MREB-POST-17 | `tipoManejoId` inexistente ou inativo | — | 404 | `tipo: resourceNotFound`; `errors[0].path: tipoManejoId` |
| MREB-POST-18 | item com `insumoId` inexistente/de outra propriedade | — | 400 | `errors[0].path: itens` |
| MREB-POST-19 | item com insumo de `destino: "Pasto"` (incompatível com rebanho) | — | 400 | `errors[0].path: itens`, mensagem "não é destinado ao rebanho" |
| MREB-POST-20 | item válido cria movimentação de insumo `Saida` | `insumoA` com destino `Rebanho`/`Ambos` | 201 | `data.itens[0]` reflete a movimentação; no banco, `MovimentacaoInsumo.manejoRebanhoId` = id do manejo, `tipo: Saida`, `origem: ManejoRebanho` |
| MREB-POST-21 | item preserva `id` enviado pelo cliente (offline-first) | item com `id` no corpo | 201 | movimentação de insumo criada com esse `id` |
| MREB-POST-22 | item sem `id` | — | 201 | movimentação de insumo criada com `id` gerado pelo banco |
| MREB-POST-23 | saída deixaria o saldo do insumo negativo | saldo atual menor que a quantidade retirada | 201 | não bloqueia; `data.avisos` contém aviso de estoque insuficiente; movimentação é criada mesmo assim |
| MREB-POST-24 | `pesoRegistrado` informado, é a pesagem mais recente do rebanho | nenhuma pesagem posterior já registrada | 201 | `GET /rebanhos/:id` do rebanho mostra `pesoMedioAtual` atualizado |
| MREB-POST-25 | `pesoRegistrado` informado, mas já existe pesagem mais recente (`dataAtividade` maior) | pesagem existente com data futura em relação à nova | 201 | manejo é criado, mas `rebanho.pesoMedioAtual` **não muda** — limitação conhecida (rotas_pastolivre.md §7.1) |
| MREB-POST-26 | item inválido no meio da criação | 1º item válido, 2º com insumo incompatível | 400 | nenhum manejo é persistido (nada visível em `GET /rebanhos/manejos`) — validação roda toda antes de abrir a transação |

## GET /rebanhos/manejos

Arquivo: `test/endpoints/rebanhos-manejos/get-rebanhos-manejos.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MREB-GET-01 | lista manejos ativos de A | 2+ manejos ativos | 200 | `data.docs` só manejos de A |
| MREB-GET-02 | usuário sem manejos | — | 200 | `message`: "Nenhum manejo de rebanho cadastrado." |
| MREB-GET-03 | filtro sem resultado | — | 200 | `message`: "Nenhum manejo encontrado com os filtros informados." |
| MREB-GET-04 | filtro `rebanhoId` | — | 200 | só manejos daquele rebanho |
| MREB-GET-05 | filtro `tipoManejoId` | — | 200 | só manejos daquele tipo |
| MREB-GET-06 | filtro `propriedadeId` | — | 200 | só manejos de rebanhos daquela propriedade |
| MREB-GET-07 | filtro `dataInicio`/`dataFim` | — | 200 | só manejos no intervalo |
| MREB-GET-08 | `ativo=false` | manejo excluído existente | 200 | retorna só os excluídos |
| MREB-GET-09 | `atualizadoDesde` (delta) | 1 manejo vigente e 1 excluído atualizados após a marca | 200 | `data.docs` traz os dois; cada item tem `ativo` e `updatedAt` |
| MREB-GET-10 | paginação | 3+ manejos, `limit=2` | 200 | `data.docs.length` = 2 |
| MREB-GET-11 | `limit` acima de 100 | `limit=101` | 400 | validação Zod |
| MREB-GET-12 | query com campo extra | — | 400 | `tipo: validationError` |
| MREB-GET-13 | sem token | — | 401 | `tipo: unauthorized` |
| MREB-GET-14 | admin (não dono) lista | token admin | 200 | `data.docs` não inclui manejos de A/B |
| MREB-GET-15 | multi-tenancy: B não vê manejos de A | — | 200 | `data.docs` de B não contém IDs de A |

## GET /rebanhos/manejos/:id

Arquivo: `test/endpoints/rebanhos-manejos/get-rebanhos-manejos-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MREB-GET-ID-01 | busca manejo de A com itens | manejo com 1+ item de insumo | 200 | `data.itens` traz os itens ativos com `insumo` aninhado |
| MREB-GET-ID-02 | id não é UUID | — | 400 | erro de validação |
| MREB-GET-ID-03 | id inexistente | — | 404 | `tipo: resourceNotFound` |
| MREB-GET-ID-04 | sem token | — | 401 | `tipo: unauthorized` |
| MREB-GET-ID-05 | multi-tenancy: B busca manejo de A | — | 404 | mesmo erro de "não encontrado" |
| MREB-GET-ID-06 | admin (não dono) busca manejo de A | token admin | 404 | sem bypass |

## PATCH /rebanhos/manejos/:id

Arquivo: `test/endpoints/rebanhos-manejos/patch-rebanhos-manejos-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MREB-PATCH-ID-01 | atualiza `medicamentoVacina`/`observacoes` | — | 200 | campos refletidos |
| MREB-PATCH-ID-02 | corpo vazio | — | 400 | `errors[0].path: body` |
| MREB-PATCH-ID-03 | campo extra (`.strict()`) | — | 400 | `tipo: validationError` |
| MREB-PATCH-ID-04 | `dataAtividade` no futuro | — | 400 | mensagem "não pode ser no futuro" |
| MREB-PATCH-ID-05 | id não é UUID | — | 400 | erro de validação |
| MREB-PATCH-ID-06 | id inexistente | — | 404 | `tipo: resourceNotFound` |
| MREB-PATCH-ID-07 | `tipoManejoId` inexistente ou inativo | — | 404 | `tipo: resourceNotFound`; `errors[0].path: tipoManejoId` |
| MREB-PATCH-ID-08 | atualiza `pesoRegistrado` | manejo já criado | 200 | `data.pesoRegistrado` muda, mas `rebanho.pesoMedioAtual` **não é recalculado** — divergência, ver abaixo |
| MREB-PATCH-ID-09 | sem token | — | 401 | `tipo: unauthorized` |
| MREB-PATCH-ID-10 | multi-tenancy: B tenta atualizar manejo de A | — | 404 | `tipo: resourceNotFound` |
| MREB-PATCH-ID-11 | admin (não dono) tenta atualizar manejo de A | token admin | 404 | sem bypass |

## DELETE /rebanhos/manejos/:id

Arquivo: `test/endpoints/rebanhos-manejos/delete-rebanhos-manejos-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MREB-DELETE-ID-01 | remove manejo de A | — | 200 | `message`: "Manejo de rebanho excluído com sucesso."; **no banco a linha continua existindo com `ativo:false`** (soft-delete, não hard-delete — ver Divergências) |
| MREB-DELETE-ID-02 | manejo tinha itens de insumo vinculados | manejo com 1+ movimentação de insumo ativa | 200 | as `MovimentacaoInsumo` vinculadas (`manejoRebanhoId`) ficam com `ativo:false` no banco |
| MREB-DELETE-ID-03 | id não é UUID | — | 400 | erro de validação |
| MREB-DELETE-ID-04 | id inexistente | — | 404 | `tipo: resourceNotFound` |
| MREB-DELETE-ID-05 | sem token | — | 401 | `tipo: unauthorized` |
| MREB-DELETE-ID-06 | multi-tenancy: B tenta remover manejo de A | — | 404 | `tipo: resourceNotFound` |
| MREB-DELETE-ID-07 | admin (não dono) tenta remover manejo de A | token admin | 404 | sem bypass |

## Divergências

- **`DELETE /rebanhos/manejos/:id` é soft-delete, não hard-delete.**
  `documentacao/rotas/rotas_pastolivre.md` §7.5 e `CLAUDE.md` ("Manejos são excluídos de
  verdade (não têm dependentes)") descrevem exclusão física, mas
  `ManejoRebanhoRepository.remove` (`src/repository/ManejoRebanhoRepository.js:152-157`) faz
  `update({ data: { ativo: false } })` — a linha permanece no banco, só marcada inativa. Já
  confirmado por `test/manejoSoftDelete.test.js`. O `select` da listagem inclui `ativo` e
  `updatedAt` justamente para sustentar a leitura por diferença (`atualizadoDesde`) sobre
  manejos excluídos — típico de soft-delete, incompatível com "excluído de verdade". Documentar
  o comportamento real (soft-delete) na tabela acima; os dois documentos-fonte estão
  desatualizados nesse ponto.
- **`PATCH /rebanhos/manejos/:id` não recalcula `rebanho.pesoMedioAtual`.**
  `ManejoRebanhoService.update` (`src/service/ManejoRebanhoService.js:137-146`) chama
  `this.repository.update` direto — só `create`, via `createComAtualizacaoPeso`
  (`src/repository/ManejoRebanhoRepository.js:111-132`), atualiza o peso do rebanho. Corrigir
  `pesoRegistrado` de um manejo já lançado, por PATCH, não reflete no peso atual do lote. Não
  documentado em rotas_pastolivre.md §7.4.
- A limitação de pesagem retroativa (peso mais recente por sincronização tardia sobrescreve o
  peso atual — MREB-POST-25) já está registrada em rotas_pastolivre.md §7.1; mantida aqui
  apenas para apontar o teste que a confirma.
