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
| MINS-POST-03 | `Ajuste` legado negativo (app antigo) | `quantidade: -12`, `origem: AjusteContagem`, observação | 201 | gravado como `Saida`/`AjusteContagem`, `quantidade` 12, observação original |
| MINS-POST-04 | aceita `id` gerado pelo cliente (offline-first) | — | 201 | `data.id` igual ao UUID enviado |
| MINS-POST-05 | aceita `rebanhoId` da mesma propriedade do insumo | rebanho de A na propriedade do insumo | 201 | `data.rebanhoId` refletido |
| MINS-POST-06 | aceita `pastoId` da mesma propriedade do insumo | pasto de A na propriedade do insumo | 201 | `data.pastoId` refletido |
| MINS-POST-07 | aceita `observacoes` (até 500 caracteres) | — | 201 | `data.observacoes` refletido |
| MINS-POST-08 | corpo vazio | — | 400 | mensagem "Forneça os dados da movimentação." |
| MINS-POST-09 | campo extra no corpo (`.strict()`) | — | 400 | validationError |
| MINS-POST-10 | `insumoId` ausente | — | 400 | validationError; path `insumoId` |
| MINS-POST-11 | `tipo` ausente ou fora do enum | — | 400 | validationError; path `tipo` |
| MINS-POST-12 | `quantidade` ausente ou não numérica | — | 400 | validationError; path `quantidade` |
| MINS-POST-13 | `quantidade` = 0 | — | 400 | `errors[0].message` = "Quantidade deve ser maior que zero."; path `quantidade` |
| MINS-POST-14 | `quantidade` negativa em `Entrada` | — | 400 | `errors[0].message` = "Quantidade deve ser maior que zero." |
| MINS-POST-15 | `quantidade` negativa em `Saida` | — | 400 | mesma mensagem de MINS-POST-14 |
| MINS-POST-16 | `data` no futuro (mais de 5 minutos) | — | 400 | `errors[0].message` = "A data não pode ser no futuro." |
| MINS-POST-17 | `data` até 5 minutos no futuro (tolerância do relógio do app offline) | — | 201 | cria normalmente |
| MINS-POST-18 | `origem` fora do enum | — | 400 | validationError; path `origem` |
| MINS-POST-19 | `origem` = `ManejoRebanho` ou `ManejoPasto` | — | 400 | recusada — essas origens só nascem pelo fluxo de manejo (`ORIGENS_POR_TIPO` em `MovimentacaoInsumoSchema.js`) |
| MINS-POST-20 | `rebanhoId` com formato inválido (não UUID) | — | 400 | validationError |
| MINS-POST-21 | sem token | — | 401 | `tipo` = unauthorized |
| MINS-POST-22 | `insumoId` de A, logado como B | B autenticado | 404 | mensagem "Insumo não encontrado ou não pertence ao usuário autenticado."; multi-tenancy — B não lança movimentação sob insumo de A |
| MINS-POST-23 | `insumoId` inexistente | UUID válido, sem registro | 404 | mesma mensagem de MINS-POST-22 |
| MINS-POST-24 | `rebanhoId` de outro usuário (B) | insumo de A, rebanho de B | 400 | `tipo` = validationError; mensagem "Rebanho não encontrado ou não pertence ao usuário autenticado."; path `rebanhoId` |
| MINS-POST-25 | `rebanhoId` de propriedade diferente da do insumo | rebanho e insumo de A, propriedades diferentes | 400 | mensagem "O rebanho pertence a outra propriedade."; path `rebanhoId` |
| MINS-POST-26 | `pastoId` de outro usuário (B) | — | 400 | mensagem "Pasto não encontrado ou não pertence ao usuário autenticado."; path `pastoId` |
| MINS-POST-27 | `pastoId` de propriedade diferente da do insumo | — | 400 | mensagem "O pasto pertence a outra propriedade."; path `pastoId` |
| MINS-POST-28 | motivos aceitos por tipo | Entrada: Compra, CadastroInicial, Devolucao; Saída: ConsumoRebanho, Perda | 201 | `origem` gravada |
| MINS-POST-29 | motivo de outro tipo | Entrada/Perda, Entrada/ConsumoRebanho, Saida/Compra, Saida/Devolucao | 400 | path `origem`; "Motivo inválido para …" |
| MINS-POST-30 | `Outro` exige observação | sem observação ou só espaços | 400 / 201 | path `observacoes`; com observação, 201 |
| MINS-POST-31 | `Ajuste` legado positivo; `Ajuste` zerado | — | 201 / 400 | positivo vira `Entrada`/`AjusteContagem`, observação original; zero → "Ajuste sem quantidade não altera o estoque." |
| MINS-POST-32 | lançamento novo com `AjusteContagem` (fora do legado `tipo: Ajuste`) | `Entrada`/`AjusteContagem` | 400 | path `origem` |
| MINS-POST-33 | entrada com valor pago (issue #70) | `Entrada`/`Compra`, `valorTotal: 1250.5` | 201 | `data.valorTotal` = "1250.5"; banco grava o valor |
| MINS-POST-34 | valor é opcional | sem `valorTotal`; `CadastroInicial` com `valorTotal: null` | 201 | `valorTotal` nulo |
| MINS-POST-35 | saída com valor pago | `Saida`/`Perda`, `valorTotal: 50` | 400 | path `valorTotal`; "O valor pago só pode ser informado em entrada de estoque." |
| MINS-POST-36 | valor zero, negativo ou texto | `valorTotal` 0, -10, "100" | 400 | path `valorTotal` |

## Migration `estoque_sem_contagem`

Arquivo: `test/endpoints/insumos-movimentacoes/migracao-estoque-sem-contagem.test.js`. O banco de teste já
nasce migrado: o teste grava linhas no formato antigo e roda o SQL da própria migration sobre elas.

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MINS-MIG-01 | converte contagens sem mudar o saldo | compra 100, ajustes +5/−12/0, `Saida`/`AjusteContagem` 3 | — | +5 → `Entrada`, −12 → `Saida` 12, ambos com origem `AjusteContagem` e observação original; 0 → inativo; a que já era `Saida` e a compra ficam intocadas; saldo 90 antes e depois; nenhum `tipo: Ajuste` restante; `updatedAt` avança só nas convertidas |

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
| MINS-GET-16 | devolve `valorTotal` (issue #70) | entrada com valor e entrada sem valor | 200 | lista e leitura por diferença trazem `valorTotal` ("375.25") ou `null` |

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
| MINS-DELETE-ID-01 | lançamento sincronizado não se desfaz (issue #68) | movimentação `Entrada` ativa de A | 409 | `tipo` = conflict; mensagem "Lançamento sincronizado não pode ser desfeito; edite para corrigir."; banco: `ativo` segue true |
| MINS-DELETE-ID-02 | `id` não é UUID | — | 400 | validationError |
| MINS-DELETE-ID-03 | sem token | — | 401 | `tipo` = unauthorized |
| MINS-DELETE-ID-04 | `id` inexistente | — | 404 | mensagem "Recurso não encontrado em Movimentação de Insumo." |
| MINS-DELETE-ID-05 | multi-tenancy: B exclui `id` de movimentação de A | — | 404 | mesma mensagem de MINS-DELETE-ID-04 |

## PATCH /insumos/movimentacoes/:id

Edição de lançamento (issue #68). Arquivo: `patch-insumos-movimentacoes-id.test.js`.

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| MINS-PATCH-ID-01 | edita quantidade, data, motivo e observação | `Entrada`/`Compra` 100 de A | 200 | mensagem "Movimentação atualizada com sucesso."; campos refletidos; `tipo` e `insumoId` intactos; `saldoReal` do insumo recalculado |
| MINS-PATCH-ID-02 | avança `updatedAt` | — | 200 | `updatedAt` posterior ao anterior |
| MINS-PATCH-ID-03 | campo fora do schema (`tipo`, `insumoId`) | — | 400 | validationError; nada gravado |
| MINS-PATCH-ID-04 | corpo vazio | — | 400 | validationError |
| MINS-PATCH-ID-05 | motivo de outro tipo | `Entrada` → `origem: Perda` | 400 | path `origem`; "Motivo inválido para entrada…" |
| MINS-PATCH-ID-06 | "Outro" sem observação | `origem: Outro` sem observação; ou apagar a observação de um "Outro" | 400 | path `observacoes` |
| MINS-PATCH-ID-07 | `quantidade` ≤ 0 ou `data` no futuro | — | 400 | validationError |
| MINS-PATCH-ID-08 | gerada por manejo | `Saida`/`ManejoRebanho` | 400 | "Lançamento gerado por manejo: edite pelo manejo." |
| MINS-PATCH-ID-09 | contagem antiga | `Entrada`/`AjusteContagem` | 400 | "Contagem antiga não pode ser editada." |
| MINS-PATCH-ID-10 | multi-tenancy: B edita movimentação de A | — | 404 | "Recurso não encontrado em Movimentação de Insumo."; nada gravado |
| MINS-PATCH-ID-11 | movimentação inativa | `ativo=false` | 404 | mesma mensagem |
| MINS-PATCH-ID-12 | sem token | — | 401 | `tipo` = unauthorized |
| MINS-PATCH-ID-13 | `observacoes: null` limpa a observação | `Compra` com observação | 200 / 400 | gravada como `null`; com `origem: Outro` no mesmo envio → 400, path `observacoes` |
| MINS-PATCH-ID-14 | edita e limpa o valor pago (issue #70) | `Entrada`/`Compra` | 200 | `valorTotal: 480` gravado; `valorTotal: null` limpa |
| MINS-PATCH-ID-15 | valor pago em saída ou inválido | `Saida`/`Perda`; entrada com `valorTotal: 0` | 400 | path `valorTotal`; nada gravado |

## Divergências

- `MovimentacaoInsumoCreateSchema` lança `ZodError` bruto (`.parse()` no controller, não `CustomError`) para as validações de `.refine()` (quantidade zero/negativa, data futura). O `errorHandler` trata isso como qualquer outro erro de Zod: `message` do envelope fica genérica ("Erro de validação. N campo(s) inválido(s)."), e o texto específico do `.refine()` só aparece em `errors[0].message`. As linhas MINS-POST-13/14/15/16 foram ajustadas para verificar `errors[0].message` em vez de `message` — não é um bug, é o mesmo comportamento de qualquer violação de schema Zod nesta API.

- Não há `AdminMiddleware` nas rotas `/insumos/movimentacoes*` — a categoria "403 admin" não se aplica a este arquivo.
- Não há `PATCH /insumos/movimentacoes/:id` — recurso imutável por design (`src/routes/insumoRoutes.js:14-18`, confirmado por `rotas_pastolivre.md:460`). Não é uma divergência, é a regra documentada; registrado aqui só para deixar claro que a ausência é intencional e não um cenário faltante.
- Nenhuma outra divergência relevante entre código e `rotas_pastolivre.md` §13.6–§13.9 foi encontrada.
