# /insumos/movimentacoes

Controller `MovimentacaoInsumoController` · Service `MovimentacaoInsumoService` · Repository
`MovimentacaoInsumoRepository` · Schemas `MovimentacaoInsumoCreateSchema`,
`MovimentacaoInsumoQuerySchema`, `MovimentacaoInsumoIdSchema` · Regras: `rotas_pastolivre.md` §
13.6–13.9

Pré-condições comuns: usuário A e usuário B autenticados via BetterAuth, cada um com uma propriedade e
ao menos um insumo cadastrado. Recurso **imutável**: não existe `PATCH /insumos/movimentacoes/:id`.

Nota de roteamento: `/insumos/movimentacoes` e `/insumos/movimentacoes/:id` são registradas em
`src/routes/insumoRoutes.js` **antes** de `/insumos/:id`, para que o literal `movimentacoes` não seja
capturado como `:id` de insumo — cenário coberto em `transversal.md`, não repetido aqui.

## POST /insumos/movimentacoes

Arquivo: `test/endpoints/insumos-movimentacoes/post-insumos-movimentacoes.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MINS-POST-01 | cria movimentação `Entrada` válida | insumo de A | 201 | envelope; `data.id`; `data.tipo` = "Entrada"; `data.ativo` = true |
| MINS-POST-02 | cria movimentação `Saida` válida | — | 201 | `data.tipo` = "Saida" |
| MINS-POST-03 | cria `Ajuste` com quantidade negativa (contagem para baixo) | — | 201 | `data.quantidade` negativa aceita |
| MINS-POST-04 | aceita `id` gerado pelo cliente (offline-first) | — | 201 | `data.id` igual ao UUID enviado |
| MINS-POST-05 | aceita `rebanhoId` da mesma propriedade do insumo | rebanho de A na propriedade do insumo | 201 | `data.rebanhoId` refletido |
| MINS-POST-06 | aceita `pastoId` da mesma propriedade do insumo | pasto de A na propriedade do insumo | 201 | `data.pastoId` refletido |
| MINS-POST-07 | aceita `observacoes` (até 500 caracteres) | — | 201 | `data.observacoes` refletido |
| MINS-POST-08 | corpo vazio | — | 400 | mensagem "Forneça os dados da movimentação." |
| MINS-POST-09 | campo extra no corpo (`.strict()`) | — | 400 | validationError |
| MINS-POST-10 | `insumoId` ausente | — | 400 | validationError; path `insumoId` |
| MINS-POST-11 | `tipo` ausente ou fora do enum | — | 400 | validationError; path `tipo` |
| MINS-POST-12 | `quantidade` ausente ou não numérica | — | 400 | validationError; path `quantidade` |
| MINS-POST-13 | `quantidade` = 0 | — | 400 | mensagem "A quantidade não pode ser zero."; path `quantidade` |
| MINS-POST-14 | `quantidade` negativa em `Entrada` | — | 400 | mensagem "Quantidade deve ser maior que zero para Entrada e Saída." |
| MINS-POST-15 | `quantidade` negativa em `Saida` | — | 400 | mesma mensagem de MINS-POST-14 |
| MINS-POST-16 | `data` no futuro (mais de 5 minutos) | — | 400 | mensagem "A data não pode ser no futuro." |
| MINS-POST-17 | `data` até 5 minutos no futuro (tolerância do relógio do app offline) | — | 201 | cria normalmente |
| MINS-POST-18 | `origem` fora do enum (`Compra`, `CadastroInicial`, `ConsumoRebanho`, `AjusteContagem`, `Perda`) | — | 400 | validationError; path `origem` |
| MINS-POST-19 | `origem` = `ManejoRebanho` ou `ManejoPasto` | — | 400 | recusada — essas origens só nascem pelo fluxo de manejo (`MovimentacaoInsumoSchema.js:7`) |
| MINS-POST-20 | `rebanhoId` com formato inválido (não UUID) | — | 400 | validationError |
| MINS-POST-21 | sem token | — | 401 | `tipo` = unauthorized |
| MINS-POST-22 | `insumoId` de A, logado como B | B autenticado | 404 | mensagem "Insumo não encontrado ou não pertence ao usuário autenticado."; multi-tenancy — B não lança movimentação sob insumo de A |
| MINS-POST-23 | `insumoId` inexistente | UUID válido, sem registro | 404 | mesma mensagem de MINS-POST-22 |
| MINS-POST-24 | `rebanhoId` de outro usuário (B) | insumo de A, rebanho de B | 400 | `tipo` = validationError; mensagem "Rebanho não encontrado ou não pertence ao usuário autenticado."; path `rebanhoId` |
| MINS-POST-25 | `rebanhoId` de propriedade diferente da do insumo | rebanho e insumo de A, propriedades diferentes | 400 | mensagem "O rebanho pertence a outra propriedade."; path `rebanhoId` |
| MINS-POST-26 | `pastoId` de outro usuário (B) | — | 400 | mensagem "Pasto não encontrado ou não pertence ao usuário autenticado."; path `pastoId` |
| MINS-POST-27 | `pastoId` de propriedade diferente da do insumo | — | 400 | mensagem "O pasto pertence a outra propriedade."; path `pastoId` |

## GET /insumos/movimentacoes

Arquivo: `test/endpoints/insumos-movimentacoes/get-insumos-movimentacoes.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MINS-GET-01 | lista com `insumoId` | 2+ movimentações do insumo | 200 | envelope; `data.docs` só do insumo; ordenado por `data` desc |
| MINS-GET-02 | sem `insumoId` e sem `atualizadoDesde` | — | 400 | `tipo` = validationError; mensagem "Informe o insumo."; path `insumoId` |
| MINS-GET-03 | sem `insumoId`, com `atualizadoDesde` | movimentações de vários insumos de A | 200 | leitura por diferença — retorna movimentações de todos os insumos da propriedade do usuário num único request |
| MINS-GET-04 | `atualizadoDesde` + `propriedadeId` | A com 2 propriedades | 200 | restringe o delta à propriedade filtrada |
| MINS-GET-05 | filtro `tipo` | — | 200 | só movimentações do tipo filtrado |
| MINS-GET-06 | filtro `origem` | — | 200 | só movimentações da origem filtrada |
| MINS-GET-07 | filtro `dataInicio`/`dataFim` | — | 200 | só movimentações no intervalo |
| MINS-GET-08 | filtro `ativo=false` | 1 movimentação estornada | 200 | só as estornadas |
| MINS-GET-09 | sem query além de `insumoId` | — | 200 | `page` = 1, `limit` = 10 (default) |
| MINS-GET-10 | `limit` > 100 | — | 400 | validationError (Zod `max(100)`) |
| MINS-GET-11 | campo extra na query (`.strict()`) | — | 400 | validationError |
| MINS-GET-12 | sem token | — | 401 | `tipo` = unauthorized |
| MINS-GET-13 | multi-tenancy: `insumoId` de A, logado como B | — | 404 | mensagem "Insumo não encontrado ou não pertence ao usuário autenticado." |
| MINS-GET-14 | multi-tenancy: `propriedadeId` de A + `atualizadoDesde`, logado como B | — | 200 | `data.docs` = [] — nunca vaza dado de outro tenant (o `where` permanece escopado a `insumo.propriedade.usuarioId` do requisitante) |
| MINS-GET-15 | lista vazia | — | 200 | mensagem "Nenhuma movimentação encontrada." |

## GET /insumos/movimentacoes/:id

Arquivo: `test/endpoints/insumos-movimentacoes/get-insumos-movimentacoes-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MINS-GET-ID-01 | encontra por id | movimentação de A | 200 | mensagem "Movimentação encontrada com sucesso."; `data.insumo.{id,nome,unidadeMedida}` |
| MINS-GET-ID-02 | `id` não é UUID | — | 400 | validationError |
| MINS-GET-ID-03 | sem token | — | 401 | `tipo` = unauthorized |
| MINS-GET-ID-04 | `id` inexistente | — | 404 | mensagem "Recurso não encontrado em Movimentação de Insumo." |
| MINS-GET-ID-05 | multi-tenancy: B lê `id` de movimentação de A | — | 404 | mesma mensagem de MINS-GET-ID-04 |

## DELETE /insumos/movimentacoes/:id

Arquivo: `test/endpoints/insumos-movimentacoes/delete-insumos-movimentacoes-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MINS-DELETE-ID-01 | estorna (soft-delete) | movimentação `Entrada` ativa de A | 200 | mensagem "Movimentação excluída com sucesso."; banco: `ativo=false`; `GET /insumos/:id` do mesmo insumo não conta mais essa linha no `saldoReal` |
| MINS-DELETE-ID-02 | `id` não é UUID | — | 400 | validationError |
| MINS-DELETE-ID-03 | sem token | — | 401 | `tipo` = unauthorized |
| MINS-DELETE-ID-04 | `id` inexistente | — | 404 | mensagem "Recurso não encontrado em Movimentação de Insumo." |
| MINS-DELETE-ID-05 | multi-tenancy: B exclui `id` de movimentação de A | — | 404 | mesma mensagem de MINS-DELETE-ID-04 |

## Divergências

- Não há `AdminMiddleware` nas rotas `/insumos/movimentacoes*` — a categoria "403 admin" não se aplica a este arquivo.
- Não há `PATCH /insumos/movimentacoes/:id` — recurso imutável por design (`src/routes/insumoRoutes.js:14-18`, confirmado por `rotas_pastolivre.md:460`). Não é uma divergência, é a regra documentada; registrado aqui só para deixar claro que a ausência é intencional e não um cenário faltante.
- Nenhuma outra divergência relevante entre código e `rotas_pastolivre.md` §13.6–§13.9 foi encontrada.
