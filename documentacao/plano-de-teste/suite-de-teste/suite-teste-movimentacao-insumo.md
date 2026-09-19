# Plano de Teste para Endpoints de Movimentação de Insumo

Rota de lançamentos do ledger de um insumo (entrada, saída, ajuste de contagem), recurso imutável
(sem PATCH). Fonte técnica: `documentacao/testes/insumos-movimentacoes/insumos-movimentacoes.md`.
Suíte automatizada: `test/endpoints/insumos-movimentacoes/`.

## POST /v1/insumos/movimentacoes

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/insumos/movimentacoes | [MINS-POST-01] cria movimentação `Entrada` válida | insumo de A | HTTP 201, envelope; `data.id`; `data.tipo` = "Entrada"; `data.ativo` = true |
| POST /v1/insumos/movimentacoes | [MINS-POST-02] cria movimentação `Saida` válida | body com `tipo: "Saida"` | HTTP 201, `data.tipo` = "Saida" |
| POST /v1/insumos/movimentacoes | [MINS-POST-03] cria `Ajuste` com quantidade negativa (contagem para baixo) | body com `tipo: "Ajuste"`, quantidade negativa | HTTP 201, `data.quantidade` negativa aceita |
| POST /v1/insumos/movimentacoes | [MINS-POST-04] aceita `id` gerado pelo cliente (offline-first) | body com `id` UUID definido pelo cliente | HTTP 201, `data.id` igual ao UUID enviado |
| POST /v1/insumos/movimentacoes | [MINS-POST-05] aceita `rebanhoId` da mesma propriedade do insumo | rebanho de A na propriedade do insumo | HTTP 201, `data.rebanhoId` refletido |
| POST /v1/insumos/movimentacoes | [MINS-POST-06] aceita `pastoId` da mesma propriedade do insumo | pasto de A na propriedade do insumo | HTTP 201, `data.pastoId` refletido |
| POST /v1/insumos/movimentacoes | [MINS-POST-07] aceita `observacoes` (até 500 caracteres) | body com `observacoes` | HTTP 201, `data.observacoes` refletido |
| POST /v1/insumos/movimentacoes | [MINS-POST-08] corpo vazio | body `{}` | HTTP 400, `message` = "Forneça os dados da movimentação." |
| POST /v1/insumos/movimentacoes | [MINS-POST-09] campo extra no corpo (`.strict()`) | body com campo desconhecido | HTTP 400, validationError |
| POST /v1/insumos/movimentacoes | [MINS-POST-10] `insumoId` ausente | body sem `insumoId` | HTTP 400, validationError; `errors[].path` = `insumoId` |
| POST /v1/insumos/movimentacoes | [MINS-POST-11] `tipo` ausente ou fora do enum | body sem `tipo` ou `tipo` inválido | HTTP 400, validationError; `errors[].path` = `tipo` |
| POST /v1/insumos/movimentacoes | [MINS-POST-12] `quantidade` ausente ou não numérica | body sem `quantidade` ou com valor não numérico | HTTP 400, validationError; `errors[].path` = `quantidade` |
| POST /v1/insumos/movimentacoes | [MINS-POST-13] `quantidade` = 0 | body com `quantidade: 0` | HTTP 400, `errors[0].message` = "A quantidade não pode ser zero."; `errors[].path` = `quantidade` |
| POST /v1/insumos/movimentacoes | [MINS-POST-14] `quantidade` negativa em `Entrada` | body `tipo: "Entrada"`, quantidade negativa | HTTP 400, `errors[0].message` = "Quantidade deve ser maior que zero para Entrada e Saída." |
| POST /v1/insumos/movimentacoes | [MINS-POST-15] `quantidade` negativa em `Saida` | body `tipo: "Saida"`, quantidade negativa | HTTP 400, mesma mensagem de MINS-POST-14 |
| POST /v1/insumos/movimentacoes | [MINS-POST-16] `data` no futuro (mais de 5 minutos) | body com `data` futura | HTTP 400, `errors[0].message` = "A data não pode ser no futuro." |
| POST /v1/insumos/movimentacoes | [MINS-POST-17] `data` até 5 minutos no futuro (tolerância do relógio do app offline) | body com `data` levemente futura | HTTP 201, cria normalmente |
| POST /v1/insumos/movimentacoes | [MINS-POST-18] `origem` fora do enum (`Compra`, `CadastroInicial`, `ConsumoRebanho`, `AjusteContagem`, `Perda`) | body com `origem` inválida | HTTP 400, validationError; `errors[].path` = `origem` |
| POST /v1/insumos/movimentacoes | [MINS-POST-19] `origem` = `ManejoRebanho` ou `ManejoPasto` | body com essas origens | HTTP 400, recusada — essas origens só nascem pelo fluxo de manejo |
| POST /v1/insumos/movimentacoes | [MINS-POST-20] `rebanhoId` com formato inválido (não UUID) | body com `rebanhoId` malformado | HTTP 400, validationError |
| POST /v1/insumos/movimentacoes | [MINS-POST-21] sem token | sem header Authorization | HTTP 401, `tipo` = unauthorized |
| POST /v1/insumos/movimentacoes | [MINS-POST-22] `insumoId` de A, logado como B | B autenticado | HTTP 404, `message` = "Insumo não encontrado ou não pertence ao usuário autenticado."; multi-tenancy — B não lança movimentação sob insumo de A |
| POST /v1/insumos/movimentacoes | [MINS-POST-23] `insumoId` inexistente | UUID válido, sem registro | HTTP 404, mesma mensagem de MINS-POST-22 |
| POST /v1/insumos/movimentacoes | [MINS-POST-24] `rebanhoId` de outro usuário (B) | insumo de A, rebanho de B | HTTP 400, `tipo` = validationError; `message` = "Rebanho não encontrado ou não pertence ao usuário autenticado."; `errors[].path` = `rebanhoId` |
| POST /v1/insumos/movimentacoes | [MINS-POST-25] `rebanhoId` de propriedade diferente da do insumo | rebanho e insumo de A, propriedades diferentes | HTTP 400, `message` = "O rebanho pertence a outra propriedade."; `errors[].path` = `rebanhoId` |
| POST /v1/insumos/movimentacoes | [MINS-POST-26] `pastoId` de outro usuário (B) | body com pastoId de B | HTTP 400, `message` = "Pasto não encontrado ou não pertence ao usuário autenticado."; `errors[].path` = `pastoId` |
| POST /v1/insumos/movimentacoes | [MINS-POST-27] `pastoId` de propriedade diferente da do insumo | pasto e insumo de A, propriedades diferentes | HTTP 400, `message` = "O pasto pertence a outra propriedade."; `errors[].path` = `pastoId` |

## GET /v1/insumos/movimentacoes

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/insumos/movimentacoes | [MINS-GET-01] lista com `insumoId` | 2+ movimentações do insumo | HTTP 200, envelope; `data.docs` só do insumo; ordenado por `data` desc |
| GET /v1/insumos/movimentacoes | [MINS-GET-02] sem `insumoId` e sem `atualizadoDesde` | sem query | HTTP 400, `tipo` = validationError; `message` = "Informe o insumo."; `errors[].path` = `insumoId` |
| GET /v1/insumos/movimentacoes | [MINS-GET-03] sem `insumoId`, com `atualizadoDesde` | movimentações de vários insumos de A; query `atualizadoDesde` | HTTP 200, leitura por diferença — retorna movimentações de todos os insumos da propriedade do usuário num único request |
| GET /v1/insumos/movimentacoes | [MINS-GET-04] `atualizadoDesde` + `propriedadeId` | A com 2 propriedades | HTTP 200, restringe o delta à propriedade filtrada |
| GET /v1/insumos/movimentacoes | [MINS-GET-05] filtro `tipo` | query `tipo` | HTTP 200, só movimentações do tipo filtrado |
| GET /v1/insumos/movimentacoes | [MINS-GET-06] filtro `origem` | query `origem` | HTTP 200, só movimentações da origem filtrada |
| GET /v1/insumos/movimentacoes | [MINS-GET-07] filtro `dataInicio`/`dataFim` | query com intervalo | HTTP 200, só movimentações no intervalo |
| GET /v1/insumos/movimentacoes | [MINS-GET-08] filtro `ativo=false` | 1 movimentação estornada | HTTP 200, só as estornadas |
| GET /v1/insumos/movimentacoes | [MINS-GET-09] sem query além de `insumoId` | query só com `insumoId` | HTTP 200, `page` = 1, `limit` = 10 (default) |
| GET /v1/insumos/movimentacoes | [MINS-GET-10] `limit` > 100 | query `limit=101` | HTTP 400, validationError (Zod `max(100)`) |
| GET /v1/insumos/movimentacoes | [MINS-GET-11] campo extra na query (`.strict()`) | query com campo desconhecido | HTTP 400, validationError |
| GET /v1/insumos/movimentacoes | [MINS-GET-12] sem token | sem header Authorization | HTTP 401, `tipo` = unauthorized |
| GET /v1/insumos/movimentacoes | [MINS-GET-13] multi-tenancy: `insumoId` de A, logado como B | logado como B | HTTP 404, `message` = "Insumo não encontrado ou não pertence ao usuário autenticado." |
| GET /v1/insumos/movimentacoes | [MINS-GET-14] multi-tenancy: `propriedadeId` de A + `atualizadoDesde`, logado como B | logado como B | HTTP 200, `data.docs` = [] — nunca vaza dado de outro tenant (o `where` permanece escopado a `insumo.propriedade.usuarioId` do requisitante) |
| GET /v1/insumos/movimentacoes | [MINS-GET-15] lista vazia | nenhuma movimentação | HTTP 200, `message` = "Nenhuma movimentação encontrada." |

## GET /v1/insumos/movimentacoes/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/insumos/movimentacoes/:id | [MINS-GET-ID-01] encontra por id | movimentação de A | HTTP 200, `message` = "Movimentação encontrada com sucesso."; `data.insumo.{id,nome,unidadeMedida}` |
| GET /v1/insumos/movimentacoes/:id | [MINS-GET-ID-02] `id` não é UUID | `/insumos/movimentacoes/abc` | HTTP 400, validationError |
| GET /v1/insumos/movimentacoes/:id | [MINS-GET-ID-03] sem token | sem header Authorization | HTTP 401, `tipo` = unauthorized |
| GET /v1/insumos/movimentacoes/:id | [MINS-GET-ID-04] `id` inexistente | UUID válido, sem registro | HTTP 404, `message` = "Recurso não encontrado em Movimentação de Insumo." |
| GET /v1/insumos/movimentacoes/:id | [MINS-GET-ID-05] multi-tenancy: B lê `id` de movimentação de A | logado como B | HTTP 404, mesma mensagem de MINS-GET-ID-04 |

## DELETE /v1/insumos/movimentacoes/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| DELETE /v1/insumos/movimentacoes/:id | [MINS-DELETE-ID-01] estorna (soft-delete) | movimentação `Entrada` ativa de A | HTTP 200, `message` = "Movimentação excluída com sucesso."; banco: `ativo=false`; `GET /insumos/:id` do mesmo insumo não conta mais essa linha no `saldoReal` |
| DELETE /v1/insumos/movimentacoes/:id | [MINS-DELETE-ID-02] `id` não é UUID | `/insumos/movimentacoes/abc` | HTTP 400, validationError |
| DELETE /v1/insumos/movimentacoes/:id | [MINS-DELETE-ID-03] sem token | sem header Authorization | HTTP 401, `tipo` = unauthorized |
| DELETE /v1/insumos/movimentacoes/:id | [MINS-DELETE-ID-04] `id` inexistente | UUID válido, sem registro | HTTP 404, `message` = "Recurso não encontrado em Movimentação de Insumo." |
| DELETE /v1/insumos/movimentacoes/:id | [MINS-DELETE-ID-05] multi-tenancy: B exclui `id` de movimentação de A | logado como B | HTTP 404, mesma mensagem de MINS-DELETE-ID-04 |

## Bugs conhecidos

- `MovimentacaoInsumoCreateSchema` lança `ZodError` bruto (`.parse()` no controller, não `CustomError`) para as validações de `.refine()` (quantidade zero/negativa, data futura): o `message` do envelope fica genérico ("Erro de validação. N campo(s) inválido(s)."), e o texto específico do `.refine()` só aparece em `errors[0].message` — não é bug, é o mesmo comportamento de qualquer violação de schema Zod nesta API (MINS-POST-13/14/15/16 verificam `errors[0].message`).
- Não há `AdminMiddleware` nas rotas `/insumos/movimentacoes*` — a categoria "403 admin" não se aplica a este arquivo.
- Não há `PATCH /insumos/movimentacoes/:id` — recurso imutável por design, comportamento documentado e intencional, não uma lacuna de cobertura.
