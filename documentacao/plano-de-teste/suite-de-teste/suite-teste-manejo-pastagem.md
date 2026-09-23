# /pastagens/manejos

Controller `ManejoPastoController` · Service `ManejoPastoService` · Repository
`ManejoPastoRepository` · Schemas `ManejoPastoCreateSchema`, `ManejoPastoUpdateSchema`,
`ManejoPastoQuerySchema`, `ManejoPastoIdSchema` · Regras: `documentacao/rotas/rotas_pastolivre.md` § 4

Pré-condições comuns: usuário A e usuário B autenticados via BetterAuth, cada um com
propriedade, pasto ativo e (quando o cenário envolver itens) insumo com `destino` compatível
cadastrados. Catálogo `tipoManejoPasto` é global e compartilhado entre usuários. Nenhuma rota
de `/pastagens/manejos` usa `AdminMiddleware` — sem categoria 403 admin aqui.

**Ordem de registro de rota:** `manejoPastoRoutes` é montado antes de `pastoRoutes` em
`src/routes/index.js:84-98` justamente para que `/pastagens/manejos` não seja capturado por
`/pastagens/:id`. O teste específico dessa armadilha vive em `transversal.md` (substitui
`test/ordemDeRotas.test.js`); aqui os cenários de `GET`/`POST` já assumem o roteamento correto.

## POST /pastagens/manejos

Arquivo: `test/endpoints/pastagens-manejos/post-pastagens-manejos.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MPAS-POST-01 | cria manejo sem `itens` | pasto ativo de A, tipo de manejo ativo | 201 | envelope; `data.itens` = `[]` |
| MPAS-POST-02 | cria manejo com 1 item de insumo `destino: "Pasto"` | insumo da mesma propriedade do pasto | 201 | `data.itens[0]` presente; DB: `movimentacaoInsumo` criada com `tipo: "Saida"`, `origem: "ManejoPasto"`, `manejoPastoId` = id do manejo, `pastoId` = pasto informado |
| MPAS-POST-03 | cria manejo com item de insumo `destino: "Ambos"` | — | 201 | mesma verificação do cenário anterior — `destino` aceito quando é `"Pasto"` ou `"Ambos"` |
| MPAS-POST-04 | aceita `id` do manejo gerado pelo cliente (offline-first) | — | 201 | `data.id` igual ao enviado |
| MPAS-POST-05 | aceita `id` do item gerado pelo cliente | — | 201 | a movimentação de saída criada no banco tem o mesmo `id` do item enviado |
| MPAS-POST-06 | corpo vazio (`{}`) | — | 400 | `errors[0].path` = `body`; `message` = "Forneça os dados do manejo de pasto." |
| MPAS-POST-07 | sem `pastoId` | — | 400 | issue `pastoId` |
| MPAS-POST-08 | sem `tipoManejoId` | — | 400 | issue `tipoManejoId` |
| MPAS-POST-09 | sem `dataAtividade` | — | 400 | issue `dataAtividade` |
| MPAS-POST-10 | `dataAtividade` no futuro | — | 400 | issue `dataAtividade`, mensagem "não pode ser no futuro" |
| MPAS-POST-11 | campo extra no corpo (`.strict()`) | — | 400 | issue `unrecognized_keys` |
| MPAS-POST-12 | item de `itens` com campo extra (`.strict()` no item) | — | 400 | issue `unrecognized_keys` dentro de `itens[0]` |
| MPAS-POST-13 | mais de 50 itens em `itens` | — | 400 | issue "No máximo 50 itens de insumo por manejo." |
| MPAS-POST-14 | item com `quantidade` zero ou negativa | — | 400 | issue `itens[0].quantidade` |
| MPAS-POST-15 | `pastoId` inexistente | — | 404 | `tipo` = `resourceNotFound`; `message` = "Pastagem não encontrada ou não pertence ao usuário autenticado." |
| MPAS-POST-16 | multi-tenancy: B tenta criar manejo em pasto de A | — | 404 | mesma resposta do cenário anterior — `ensurePastoExists` filtra por `usuarioId` |
| MPAS-POST-17 | `pastoId` aponta para pasto inativo | — | 400 | `tipo` = `validationError`; `errors[0].path` = `pastoId`; `message` = "Pasto está inativo." |
| MPAS-POST-18 | `tipoManejoId` inexistente ou inativo no catálogo | — | 404 | `tipo` = `resourceNotFound`; `errors[0].path` = `tipoManejoId` |
| MPAS-POST-19 | item com `insumoId` que não existe na propriedade do pasto | — | 400 | `tipo` = `validationError`; `errors[0].path` = `itens`; `message` inclui "não encontrado nesta propriedade" |
| MPAS-POST-20 | item com `insumoId` de outra propriedade do mesmo usuário | A tem insumo em propriedade diferente da do pasto | 400 | mesma resposta do cenário anterior (`insumo.propriedadeId !== pasto.propriedadeId`) |
| MPAS-POST-21 | item com `insumoId` de insumo `destino: "Rebanho"` | — | 400 | `errors[0].path` = `itens`; `message` inclui "não é destinado ao pasto" |
| MPAS-POST-22 | dois itens com o mesmo `insumoId` repetido | quantidades 1 e 2 | 201 | funde numa **única** movimentação de saída, com quantidade somada (3) |
| MPAS-POST-23 | saída deixa o saldo do insumo negativo | insumo com pouco saldo disponível | 201 | manejo é criado mesmo assim; `data.avisos` contém mensagem "Estoque insuficiente de ... — saldo ficará negativo." — a regra avisa, não bloqueia |
| MPAS-POST-24 | sem token | — | 401 | `tipo` = `unauthorized` |

## GET /pastagens/manejos

Arquivo: `test/endpoints/pastagens-manejos/get-pastagens-manejos.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MPAS-GET-01 | usuário sem nenhum manejo cadastrado | — | 200 | `message` = "Nenhum manejo de pasto cadastrado."; `data.docs` = `[]` |
| MPAS-GET-02 | lista manejos do usuário autenticado | A tem 2 manejos | 200 | `data.docs.length` = 2; ordenado por `dataAtividade` desc; cada item inclui `tipoManejo.{id,nome}`, `pasto.{id,nome,propriedade.{id,nome}}`, `itens` = `[]` |
| MPAS-GET-03 | filtro `pastoId` | — | 200 | só devolve manejos daquele pasto |
| MPAS-GET-04 | filtro `propriedadeId` | manejos em pastos de propriedades diferentes | 200 | só devolve manejos de pastos daquela propriedade |
| MPAS-GET-05 | filtro `tipoManejoId` | — | 200 | só devolve manejos daquele tipo |
| MPAS-GET-06 | filtro `dataInicio`/`dataFim` | — | 200 | só devolve manejos com `dataAtividade` no intervalo |
| MPAS-GET-07 | filtros sem nenhum resultado | — | 200 | `message` = "Nenhum manejo de pasto encontrado com os filtros informados." |
| MPAS-GET-08 | paginação `page=2` | A tem 15 manejos | 200 | `data.page` = 2 |
| MPAS-GET-09 | `limit` acima de 100 é recusado | — | 400 | `tipo` = `validationError`; issue `limit` |
| MPAS-GET-10 | `?ativo=false` filtra só os manejos excluídos | A tem manejo excluído (soft-delete) | 200 | `data.docs` tem 1 item; só contém `ativo: false` |
| MPAS-GET-11 | multi-tenancy: B não vê manejos de pastos de A | — | 200 | `data.docs` de B não contém manejos de pastos de A |
| MPAS-GET-12 | leitura por diferença: `atualizadoDesde` traz vigentes e excluídos juntos | manejo de A excluído após a marca de tempo | 200 | `data.docs` inclui o manejo com `ativo: false` e `updatedAt`; filtro padrão de `ativo` não é aplicado |
| MPAS-GET-13 | query inválida (`dataInicio` malformada) | — | 400 | issue `dataInicio` |
| MPAS-GET-14 | sem token | — | 401 | `tipo` = `unauthorized` |

## GET /pastagens/manejos/:id

Arquivo: `test/endpoints/pastagens-manejos/get-pastagens-manejos-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MPAS-GET-ID-01 | retorna manejo existente do usuário autenticado | — | 200 | `message` = "Manejo de pasto encontrado com sucesso."; `data.itens` = `[]` |
| MPAS-GET-ID-02 | manejo inativo (soft-deleted) ainda pode ser lido por id | — | 200 | `data.ativo` = `false` |
| MPAS-GET-ID-03 | id inexistente | — | 404 | `tipo` = `resourceNotFound`; `message` = "Recurso não encontrado em Manejo de Pasto." |
| MPAS-GET-ID-04 | multi-tenancy: B tenta ler manejo de A | — | 404 | mesma resposta do cenário anterior |
| MPAS-GET-ID-05 | `:id` não é UUID válido | — | 400 | mensagem "ID de manejo de pasto inválido. Deve ser um UUID válido." |
| MPAS-GET-ID-06 | sem token | — | 401 | `tipo` = `unauthorized` |

## PATCH /pastagens/manejos/:id

Arquivo: `test/endpoints/pastagens-manejos/patch-pastagens-manejos-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MPAS-PATCH-ID-01 | atualiza `tipoManejoId` para outro tipo válido | — | 200 | `data.tipoManejoId` atualizado |
| MPAS-PATCH-ID-02 | atualiza `dataAtividade` | data no passado | 200 | `data.dataAtividade` atualizado |
| MPAS-PATCH-ID-03 | atualiza `observacoes` | — | 200 | `data.observacoes` atualizado |
| MPAS-PATCH-ID-04 | corpo vazio (`{}`) | — | 400 | `message` = "Forneça pelo menos um campo para atualizar." |
| MPAS-PATCH-ID-05 | campo extra no corpo (`.strict()`) | — | 400 | issue `unrecognized_keys` |
| MPAS-PATCH-ID-06 | `itens: []` com manejo já tendo um item ativo | 1 movimentação `Saida` ativa vinculada ao manejo | 200 | `data.itens = []`; a movimentação antiga vira `ativo = false`, nenhuma nova é criada |
| MPAS-PATCH-ID-06b | atualiza só `observacoes`, sem enviar `itens` | 1 movimentação `Saida` ativa vinculada ao manejo | 200 | `data.itens` mostra o item já ativo (resposta sempre reflete o estado atual); a movimentação antiga continua `ativo = true` — troca só ocorre quando `itens` é enviado |
| MPAS-PATCH-ID-06c | `itens` com um insumo novo, manejo já tendo item de outro insumo | 1 movimentação `Saida` ativa (insumo A) | 200 | `data.itens` traz só o item novo (insumo B); no banco a `Saida` do insumo A vira `ativo = false` e a do insumo B é criada `ativo = true` — troca por completo, não acumula |
| MPAS-PATCH-ID-06d | `itens` com insumo de outra propriedade | — | 400 | issue no campo `itens`; nenhuma movimentação é criada ou desativada (validação antes da transação) |
| MPAS-PATCH-ID-07 | `dataAtividade` no futuro | — | 400 | issue `dataAtividade` |
| MPAS-PATCH-ID-08 | id inexistente | — | 404 | `tipo` = `resourceNotFound` |
| MPAS-PATCH-ID-09 | multi-tenancy: B tenta editar manejo de A | — | 404 | mesma resposta do cenário anterior; manejo de A permanece inalterado no banco |
| MPAS-PATCH-ID-10 | `tipoManejoId` inexistente ou inativo | — | 404 | `tipo` = `resourceNotFound`; `errors[0].path` = `tipoManejoId` |
| MPAS-PATCH-ID-11 | `:id` não é UUID válido | — | 400 | issue de `ManejoPastoIdSchema` |
| MPAS-PATCH-ID-12 | sem token | — | 401 | `tipo` = `unauthorized` |

## DELETE /pastagens/manejos/:id

Arquivo: `test/endpoints/pastagens-manejos/delete-pastagens-manejos-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MPAS-DELETE-ID-01 | exclui manejo sem itens | — | 200 | DB: `ativo` = `false` — a linha **continua existindo** (soft-delete, não remoção física) |
| MPAS-DELETE-ID-02 | exclui manejo com itens de insumo vinculados | manejo com 1+ movimentações de saída | 200 | DB: `movimentacaoInsumo` das movimentações originadas desse manejo também fica `ativo: false` (`movimentacaoInsumoRepository.desativarPorManejo`) — o saldo do insumo deixa de ser debitado por elas |
| MPAS-DELETE-ID-03 | id inexistente | — | 404 | `tipo` = `resourceNotFound` |
| MPAS-DELETE-ID-04 | multi-tenancy: B tenta excluir manejo de A | — | 404 | mesma resposta do cenário anterior |
| MPAS-DELETE-ID-05 | `:id` não é UUID válido | — | 400 | issue de `ManejoPastoIdSchema` |
| MPAS-DELETE-ID-06 | sem token | — | 401 | `tipo` = `unauthorized` |

## Divergências

- MPAS-POST-15/16 (`pastoId` inexistente): a mensagem real de
  `ManejoPastoService.ensurePastoExists` (`src/service/ManejoPastoService.js:194-206`) é
  "Pastagem não encontrada ou não pertence ao usuário autenticado.", não o texto genérico
  de `messages.error.resourceNotFound('Pastagem')` ("Recurso não encontrado em
  Pastagem.") que a linha original do `.md` assumia. Corrigido nas duas linhas.
- MPAS-POST-02/03/DELETE-ID-02: o `.md` original citava a tabela `historicoMovimentacao`
  como destino da movimentação de saída — essa tabela é exclusiva de
  `rebanhos/movimentacoes` (troca de pasto do rebanho). O ledger de insumo usado aqui é
  `movimentacaoInsumo` (`prisma/schema.prisma:345`). Corrigido nas três linhas.
- Aviso de saldo negativo (`data.avisos`, `src/service/ManejoPastoService.js:137-139`) nunca
  bloqueia a criação do manejo — é informativo.
