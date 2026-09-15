# /rebanhos

Controller `RebanhoController` · Service `RebanhoService` · Repository `RebanhoRepository` ·
Schemas `RebanhoCreateSchema`, `RebanhoUpdateSchema`, `RebanhoQuerySchema`, `RebanhoIdSchema` ·
Regras: rotas_pastolivre.md § 5

Pré-condições comuns: usuário A e usuário B autenticados via BetterAuth. A tem uma propriedade
ativa com um pasto ativo (`pastoA`). Onde necessário, B também tem sua própria propriedade/pasto.

Nenhuma das rotas abaixo usa `AdminMiddleware` — um usuário com `user.admin = true` não tem
nenhum acesso especial aqui. Ele é tratado como qualquer usuário autenticado: sujeito às mesmas
regras de multi-tenancy. Os cenários "403 admin" descritos abaixo verificam exatamente isso —
que um admin não-dono recebe o mesmo 404 que qualquer outro usuário não-dono (ver Divergências).

## POST /rebanhos

Arquivo: `test/endpoints/rebanhos/post-rebanhos.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| REB-POST-01 | cria com dados válidos | propriedade+pasto ativos de A | 201 | envelope `{message,data,errors}`; `data.id`; `data.propriedade.id` = propriedade de A |
| REB-POST-02 | aceita `id` gerado pelo cliente (offline-first) | — | 201 | `data.id` igual ao enviado |
| REB-POST-03 | corpo vazio | — | 400 | `tipo: validationError`, `errors[0].path: body` |
| REB-POST-04 | campo extra no corpo (`.strict()`) | — | 400 | `tipo: validationError` |
| REB-POST-05 | falta `propriedadeId` | — | 400 | validação Zod, `path` inclui `propriedadeId` |
| REB-POST-06 | falta `nomeRebanho` | — | 400 | validação Zod |
| REB-POST-07 | falta `pastoAtualId` | — | 400 | validação Zod |
| REB-POST-08 | `propriedadeId` não é UUID | — | 400 | validação Zod |
| REB-POST-09 | `quantidadeCabecas` zero ou negativo | — | 400 | validação Zod |
| REB-POST-10 | `pesoMedioAtual` negativo | — | 400 | validação Zod |
| REB-POST-11 | sem token | — | 401 | `tipo: unauthorized` |
| REB-POST-12 | token inválido/expirado | — | 401 | `tipo: unauthorized` |
| REB-POST-13 | admin (não dono) cria rebanho em propriedade de A | token admin, `propriedadeId` de A | 404 | `tipo: resourceNotFound`; sem bypass de multi-tenancy |
| REB-POST-14 | B tenta criar rebanho com `propriedadeId` de A | — | 404 | `tipo: resourceNotFound`; `message` "Propriedade não encontrada ou não pertence ao usuário autenticado." |
| REB-POST-15 | `propriedadeId` inexistente | — | 404 | `tipo: resourceNotFound` |
| REB-POST-16 | propriedade inativa | propriedade de A com `ativo:false` | 400 | `tipo: validationError`, `errors[0].path: propriedadeId` |
| REB-POST-17 | `nomeRebanho` duplicado (ativo) na mesma propriedade | já existe rebanho ativo com o nome | 409 | `tipo: conflict`, `errors[0].path: nomeRebanho` |
| REB-POST-18 | `nomeRebanho` igual a um rebanho **inativo** existente | rebanho homônimo com `ativo:false` | 201 | cria normalmente — `findByNome` só considera ativos |
| REB-POST-19 | `pastoAtualId` inexistente | — | 404 | `tipo: resourceNotFound` |
| REB-POST-20 | `pastoAtualId` pertence a B | B tem pasto próprio | 404 | `tipo: resourceNotFound` (mesmo com A autenticado) |
| REB-POST-21 | pasto inativo | pasto de A com `ativo:false` | 400 | `tipo: validationError`, `errors[0].path: pastoAtualId` |
| REB-POST-22 | pasto pertence a outra propriedade do próprio A | `propriedadeId` ≠ propriedade do pasto | 400 | `errors[0].path: pastoAtualId`, mensagem "não pertence à mesma propriedade" |
| REB-POST-23 | pasto já ocupado por outro rebanho ativo, sem `permitirLotacaoConjunta` | 1 rebanho ativo no pasto | 400 | `errors[0].path: pastoAtualId`, mensagem "já tem outro lote" |
| REB-POST-24 | pasto ocupado, com `permitirLotacaoConjunta: true` | 1 rebanho ativo no pasto | 201 | cria; os dois rebanhos ficam ativos no mesmo pasto |
| REB-POST-25 | transação: cria rebanho e marca pasto como `Ocupado` | pasto estava `Vazio` | 201 | `GET /pastagens/:id` do pasto mostra `status: "Ocupado"` |
| REB-POST-26 | `dataEntradaPastoAtual` omitida | — | 201 | `data.dataEntradaPastoAtual` ≈ agora |
| REB-POST-27 | `dataEntradaPastoAtual` informada | — | 201 | `data.dataEntradaPastoAtual` igual ao enviado |

## GET /rebanhos

Arquivo: `test/endpoints/rebanhos/get-rebanhos.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| REB-GET-01 | lista rebanhos ativos de A | 2+ rebanhos ativos de A | 200 | `data.docs` só rebanhos de A; `data.totalDocs` |
| REB-GET-02 | usuário sem rebanhos | — | 200 | `message`: "Nenhum rebanho cadastrado."; `data.docs: []` |
| REB-GET-03 | filtro sem resultado | filtro `nomeRebanho` que não bate | 200 | `message`: "Nenhum rebanho encontrado com os filtros informados." |
| REB-GET-04 | filtro `nomeRebanho` (contains, case-insensitive) | — | 200 | só rebanhos cujo nome contém o termo, ignorando maiúsculas |
| REB-GET-05 | filtro `propriedadeId` | — | 200 | só rebanhos da propriedade |
| REB-GET-06 | filtro `pastoAtualId` | — | 200 | só rebanhos daquele pasto |
| REB-GET-07 | filtro `racaId` | — | 200 | só rebanhos daquela raça |
| REB-GET-08 | filtro `sistemaProducaoId` | — | 200 | só rebanhos daquele sistema |
| REB-GET-09 | filtro `regimeAlimentarId` | — | 200 | só rebanhos daquele regime |
| REB-GET-10 | `ativo=false` | rebanho inativo existente | 200 | retorna só os inativos |
| REB-GET-11 | `atualizadoDesde` (delta) | 1 rebanho ativo e 1 inativo atualizados após a marca | 200 | `data.docs` traz os dois; cada item tem `ativo` e `updatedAt` |
| REB-GET-12 | paginação (`page`, `limit`) | 3+ rebanhos, `limit=2` | 200 | `data.docs.length` = 2; `data.totalPages` correto |
| REB-GET-13 | `limit` acima de 100 | `limit=101` | 400 | validação Zod (`max(100)`) |
| REB-GET-14 | query com campo extra (`.strict()`) | — | 400 | `tipo: validationError` |
| REB-GET-15 | sem token | — | 401 | `tipo: unauthorized` |
| REB-GET-16 | admin (não dono) lista | token admin, sem rebanhos próprios | 200 | `data.docs` não inclui rebanhos de A/B — sem bypass |
| REB-GET-17 | multi-tenancy: B não vê rebanhos de A | A e B com rebanhos próprios | 200 | `data.docs` de B não contém IDs de A |

## GET /rebanhos/:id

Arquivo: `test/endpoints/rebanhos/get-rebanhos-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| REB-GET-ID-01 | busca rebanho de A | — | 200 | `message`: "Rebanho encontrado com sucesso."; `data` inclui `propriedade`, `pastoAtual`, `raca`, `sistemaProducao`, `regimeAlimentar` aninhados |
| REB-GET-ID-02 | id não é UUID | `id=abc` | 400 | erro de validação (Zod) |
| REB-GET-ID-03 | id inexistente | — | 404 | `tipo: resourceNotFound` |
| REB-GET-ID-04 | sem token | — | 401 | `tipo: unauthorized` |
| REB-GET-ID-05 | multi-tenancy: B busca rebanho de A | — | 404 | mesmo erro de "não encontrado", nunca 403 |
| REB-GET-ID-06 | admin (não dono) busca rebanho de A | token admin | 404 | sem bypass de multi-tenancy |

## PATCH /rebanhos/:id

Arquivo: `test/endpoints/rebanhos/patch-rebanhos-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| REB-PATCH-ID-01 | atualiza `nomeRebanho` | — | 200 | `data.nomeRebanho` atualizado |
| REB-PATCH-ID-02 | atualiza `quantidadeCabecas`/`pesoMedioAtual` | — | 200 | campos refletidos |
| REB-PATCH-ID-03 | corpo vazio | — | 400 | `errors[0].path: body` |
| REB-PATCH-ID-04 | campo extra (`.strict()`) | — | 400 | `tipo: validationError` |
| REB-PATCH-ID-05 | id não é UUID | — | 400 | erro de validação |
| REB-PATCH-ID-06 | id inexistente | — | 404 | `tipo: resourceNotFound` |
| REB-PATCH-ID-07 | `nomeRebanho` duplicado com outro rebanho ativo da mesma propriedade | — | 409 | `tipo: conflict` |
| REB-PATCH-ID-08 | tenta alterar `pastoAtualId` de rebanho ativo | — | 400 | `errors[0].path: pastoAtualId`, mensagem "deve ser feita através da rota de movimentação" |
| REB-PATCH-ID-09 | envia `ativo: false` (inativação) | rebanho ativo de A | **500** | **bug atual** — `tipo: serverError`; ver Divergências. Documentado assim porque é o comportamento real do código |
| REB-PATCH-ID-10 | reativa (`ativo: true`) sem informar `pastoAtualId` | rebanho inativo de A | 400 | `errors[0].path: pastoAtualId`, mensagem "Informe o pasto atual para reativar" — validado ANTES da transação, não atinge o bug |
| REB-PATCH-ID-11 | reativa com `pastoAtualId` válido | rebanho inativo, pasto ativo da mesma propriedade | **500** | **bug atual** — `tipo: serverError`; ver Divergências |
| REB-PATCH-ID-12 | reativa com pasto inativo | — | 400 | `errors[0].path: pastoAtualId` — validado antes da transação |
| REB-PATCH-ID-13 | reativa com pasto de outra propriedade | — | 400 | `errors[0].path: pastoAtualId` — validado antes da transação |
| REB-PATCH-ID-14 | sem token | — | 401 | `tipo: unauthorized` |
| REB-PATCH-ID-15 | multi-tenancy: B tenta atualizar rebanho de A | — | 404 | `tipo: resourceNotFound` |
| REB-PATCH-ID-16 | admin (não dono) tenta atualizar rebanho de A | token admin | 404 | sem bypass |

## DELETE /rebanhos/:id

Arquivo: `test/endpoints/rebanhos/delete-rebanhos-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| REB-DELETE-ID-01 | inativa rebanho ativo de A | rebanho ativo com pasto vinculado | **500** | **bug atual** — `serverError`; o soft-delete descrito em rotas_pastolivre.md §5.5 nunca é alcançado. Ver Divergências |
| REB-DELETE-ID-02 | id não é UUID | — | 400 | erro de validação |
| REB-DELETE-ID-03 | id inexistente | — | 404 | `tipo: resourceNotFound` — este check roda antes do trecho com bug |
| REB-DELETE-ID-04 | sem token | — | 401 | `tipo: unauthorized` |
| REB-DELETE-ID-05 | multi-tenancy: B tenta remover rebanho de A | — | 404 | `tipo: resourceNotFound` |
| REB-DELETE-ID-06 | admin (não dono) tenta remover rebanho de A | token admin | 404 | sem bypass |

## Divergências

- **Bug crítico — `DELETE /rebanhos/:id`, `PATCH /rebanhos/:id` com `ativo:false` e
  reativação (`ativo:true`) sempre retornam 500.** `RebanhoService._inativar`
  (`src/service/RebanhoService.js:184-215`) e `RebanhoService._reativar` (`:223-270`) chamam
  `comTransacao(this.prisma, executor, ...)`, mas nenhum dos dois métodos declara `executor`
  como parâmetro. `remove()` (`:174-178`) chama `this._inativar(rebanho)` sem repassar seu
  próprio `executor`; `update()` (`:156-163`) faz o mesmo para `_inativar` e `_reativar`. Como
  `executor` não existe em nenhum escopo alcançável a partir desses métodos, a chamada lança
  `ReferenceError: executor is not defined`, tratado pelo `errorHandler` como erro interno
  (500, `tipo: serverError`) — nunca chega a rodar `prisma.$transaction`. Na prática:
  **nenhum rebanho pode ser inativado nem reativado por essas rotas hoje.** As validações que
  rodam *antes* da chamada a `comTransacao` (rebanho/pasto inexistente, pasto inativo, pasto de
  outra propriedade, falta de `pastoAtualId` na reativação) continuam funcionando normalmente,
  porque só o trecho de escrita transacional está quebrado. Antes de escrever os testes da
  Task correspondente, confirmar em execução real contra o banco — se o bug for corrigido no
  meio do trabalho, os status REB-PATCH-ID-09/11 e REB-DELETE-ID-01 passam a refletir o
  comportamento descrito em rotas_pastolivre.md §5.4/§5.5 (200, soft-delete/reativação
  efetivos) em vez de 500.
- `RebanhoRepository.findByNome` (`:83-91`) só considera rebanhos ativos — nome duplicado com
  um rebanho inativo é permitido (REB-POST-18). Coerente com o comportamento de "reciclagem de
  nome" já documentado para pastos (rotas_pastolivre.md §3.1), mas não estava explícito em §5.
